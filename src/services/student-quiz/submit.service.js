import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getFirebaseServices } from '../../config/firebase.js';
import { toAppError } from '../../utils/firebase-error.js';
import { isAdminQuizPreviewRecord } from '../quizzes.service.js';
import { isCurriculumQuizActivity } from '../../utils/curriculum-program.js';
import {
  buildQuizAttemptId,
  buildQuizAttemptSubmissionId,
  buildQuizLiveAttemptId,
  formatQuizReadinessRequirement,
  getQuizReadiness,
  QUIZ_ATTEMPT_STATUS_REOPENED,
  QUIZ_ATTEMPT_STATUS_SUBMITTED,
  QUIZ_MODE_OFFICIAL,
  validateQuizAnswerMap,
} from '../../utils/quiz.js';
import {
  buildStartedQuizVariant,
  canAccessQuizForStudent,
  getNextSubmissionNumber,
  getReadyPublicQuizPool,
  getValidatedClass,
  getValidatedStudent,
  normalizeText,
  resolveClassQuizActivity,
} from './shared.js';

export async function submitStudentQuiz(payload = {}) {
  const classCode = String(payload.classCode ?? '').trim().toUpperCase();
  const studentId = normalizeText(payload.studentId);

  try {
    const classItem = await getValidatedClass(classCode);
    const resolvedActivity = await resolveClassQuizActivity(classItem);
    const { sessionNumber, sessionActivity, program } = resolvedActivity;

    if (resolvedActivity.reason || !isCurriculumQuizActivity(sessionActivity?.activityType)) {
      throw new Error(resolvedActivity.reason || 'Lớp này hiện chưa mở bài kiểm tra.');
    }

    const student = await getValidatedStudent(studentId, classItem.classCode);
    const { db } = getFirebaseServices();
    const attemptId = buildQuizAttemptId(classItem.classCode, studentId, sessionNumber);
    const attemptRef = doc(db, 'quizAttempts', attemptId);
    const attemptStateRef = doc(db, 'quizAttemptStates', attemptId);
    const attemptStateSnapshot = await getDoc(attemptStateRef);
    const attemptStateData = attemptStateSnapshot.exists() ? attemptStateSnapshot.data() : null;
    const isAdminPreviewAttemptState = isAdminQuizPreviewRecord(attemptStateData);
    const attemptState =
      attemptStateSnapshot.exists() && !isAdminPreviewAttemptState
        ? {
            status:
              attemptStateData.status === QUIZ_ATTEMPT_STATUS_REOPENED
                ? QUIZ_ATTEMPT_STATUS_REOPENED
                : QUIZ_ATTEMPT_STATUS_SUBMITTED,
            submissionCount: Math.max(0, Number(attemptStateData.submissionCount || 0)),
          }
        : null;

    if (!canAccessQuizForStudent(classItem, sessionNumber, attemptState)) {
      throw new Error('Bài kiểm tra này đã kết thúc. Các đáp án chưa nộp sẽ không được ghi nhận.');
    }

    const quizPool = await getReadyPublicQuizPool(program, sessionNumber);

    if (!quizPool || !quizPool.questions.length) {
      throw new Error('Đề kiểm tra hiện chưa được cấu hình đầy đủ.');
    }

    const readiness = getQuizReadiness(quizPool);

    if (!readiness.isReady) {
      throw new Error(
        `Ngân hàng câu hỏi chưa đủ tỉ lệ 4 dễ, 4 trung bình, 2 khó. ${formatQuizReadinessRequirement(readiness)}`,
      );
    }

    const submissionNumber = getNextSubmissionNumber(attemptState);
    const quizVariant = buildStartedQuizVariant(
      { ...quizPool, quizMode: QUIZ_MODE_OFFICIAL },
      classItem,
      studentId,
      submissionNumber,
    );
    const validation = validateQuizAnswerMap(quizVariant, payload.answers || {});

    if (!validation.isValid) {
      throw new Error('Bài làm chưa hợp lệ. Hãy trả lời đầy đủ trước khi nộp.');
    }

    if (attemptStateSnapshot.exists() && !isAdminPreviewAttemptState && attemptState?.status !== QUIZ_ATTEMPT_STATUS_REOPENED) {
      throw new Error('Bạn đã nộp bài kiểm tra này rồi.');
    }

    const submittedAt = serverTimestamp();
    const submissionCount = submissionNumber;
    const baseAttemptPayload = {
      classCode: classItem.classCode,
      className: classItem.className,
      studentId,
      studentName: student.fullName,
      curriculumProgramId: classItem.curriculumProgramId,
      subject: program.subject || '',
      level: program.level || '',
      bankId: quizVariant.bankId || quizPool.bankId || '',
      sessionNumber,
      quizMode: QUIZ_MODE_OFFICIAL,
      quizTitle: quizVariant.title,
      questionCount: quizVariant.questionCount,
      questionIds: quizVariant.questionIds,
      answers: payload.answers || {},
      status: QUIZ_ATTEMPT_STATUS_SUBMITTED,
      source: 'student',
    };
    const baseAttemptStatePayload = {
      classCode: classItem.classCode,
      studentId,
      subject: program.subject || '',
      level: program.level || '',
      bankId: quizVariant.bankId || quizPool.bankId || '',
      sessionNumber,
      quizMode: QUIZ_MODE_OFFICIAL,
      status: QUIZ_ATTEMPT_STATUS_SUBMITTED,
      source: 'student',
    };
    const attemptSubmissionRef = doc(
      db,
      'quizAttemptSubmissions',
      buildQuizAttemptSubmissionId(attemptId, submissionCount),
    );
    const liveAttemptRef = doc(
      db,
      'quizLiveAttempts',
      buildQuizLiveAttemptId(attemptId, submissionCount),
    );
    const liveAttemptSnapshot = await getDoc(liveAttemptRef);
    const attemptWritePayload = {
      ...baseAttemptPayload,
      submissionCount,
      submittedAt,
      updatedAt: serverTimestamp(),
    };
    const attemptStateWritePayload = {
      ...baseAttemptStatePayload,
      submissionCount,
      submittedAt,
      updatedAt: serverTimestamp(),
    };
    const batch = writeBatch(db);

    if (!attemptStateSnapshot.exists() || isAdminPreviewAttemptState) {
      attemptWritePayload.createdAt = submittedAt;
      attemptStateWritePayload.createdAt = submittedAt;
    }

    batch.set(attemptRef, attemptWritePayload, { merge: true });
    batch.set(attemptStateRef, attemptStateWritePayload, { merge: true });
    batch.set(attemptSubmissionRef, {
      attemptId,
      classCode: classItem.classCode,
      studentId,
      subject: program.subject || '',
      level: program.level || '',
      bankId: quizVariant.bankId || quizPool.bankId || '',
      sessionNumber,
      quizMode: QUIZ_MODE_OFFICIAL,
      submissionNumber: submissionCount,
      questionCount: quizVariant.questionCount,
      questionIds: quizVariant.questionIds,
      answers: payload.answers || {},
      source: 'student',
      submittedAt,
      createdAt: submittedAt,
    });

    if (liveAttemptSnapshot.exists()) {
      batch.set(
        liveAttemptRef,
        {
          status: 'submitted',
          updatedAt: submittedAt,
        },
        { merge: true },
      );
    }

    await batch.commit();

    return {
      success: true,
      sessionNumber,
      submissionNumber,
      quizMode: QUIZ_MODE_OFFICIAL,
    };
  } catch (error) {
    throw toAppError(error, 'Không thể nộp bài kiểm tra lúc này.');
  }
}
