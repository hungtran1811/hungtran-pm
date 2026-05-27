import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseServices } from '../../config/firebase.js';
import { toAppError } from '../../utils/firebase-error.js';
import { isCurriculumQuizActivity } from '../../utils/curriculum-program.js';
import {
  buildQuizAttemptId,
  buildQuizLiveAttemptId,
  formatQuizReadinessRequirement,
  getQuizReadiness,
  QUIZ_MODE_OFFICIAL,
} from '../../utils/quiz.js';
import {
  buildStartedQuizVariant,
  canAccessQuizForStudent,
  canWriteCurrentQuizAttempt,
  getNextSubmissionNumber,
  getQuizAttemptState,
  getReadyPublicQuizPool,
  getValidatedClass,
  getValidatedStudent,
  normalizeDraftAnswers,
  normalizeText,
  resolveClassQuizActivity,
} from './shared.js';

export async function saveStudentQuizDraft(payload = {}) {
  const classCode = String(payload.classCode ?? '').trim().toUpperCase();
  const studentId = normalizeText(payload.studentId);

  try {
    const classItem = await getValidatedClass(classCode);
    const resolvedActivity = await resolveClassQuizActivity(classItem);
    const { sessionNumber, sessionActivity, program } = resolvedActivity;

    if (resolvedActivity.reason || !isCurriculumQuizActivity(sessionActivity?.activityType)) {
      throw new Error(resolvedActivity.reason || 'Lớp này hiện chưa mở bài kiểm tra.');
    }

    await getValidatedStudent(studentId, classItem.classCode);
    const attemptState = await getQuizAttemptState(classItem.classCode, studentId, sessionNumber);

    if (!canWriteCurrentQuizAttempt(attemptState)) {
      throw new Error('Bạn đã nộp bài kiểm tra này rồi.');
    }

    if (!canAccessQuizForStudent(classItem, sessionNumber, attemptState)) {
      throw new Error('Bài kiểm tra hiện chưa mở hoặc đã kết thúc.');
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
    const attemptId = buildQuizAttemptId(classItem.classCode, studentId, sessionNumber);
    const liveAttemptId = buildQuizLiveAttemptId(attemptId, submissionNumber);
    const quizVariant = buildStartedQuizVariant(
      { ...quizPool, quizMode: QUIZ_MODE_OFFICIAL },
      classItem,
      studentId,
      submissionNumber,
      attemptState?.reopenedAt || null,
    );
    const answers = normalizeDraftAnswers(quizVariant, payload.answers || {});
    const { db } = getFirebaseServices();
    const liveAttemptRef = doc(db, 'quizLiveAttempts', liveAttemptId);
    const liveAttemptSnapshot = await getDoc(liveAttemptRef);
    const writePayload = {
      attemptId,
      classCode: classItem.classCode,
      studentId,
      subject: program.subject || '',
      level: program.level || '',
      bankId: quizVariant.bankId || quizPool.bankId || '',
      sessionNumber,
      quizMode: QUIZ_MODE_OFFICIAL,
      submissionNumber,
      questionCount: quizVariant.questionCount,
      questionIds: quizVariant.questionIds,
      answers,
      status: 'draft',
      updatedAt: serverTimestamp(),
    };

    if (!liveAttemptSnapshot.exists()) {
      writePayload.createdAt = serverTimestamp();
    }

    await setDoc(liveAttemptRef, writePayload, { merge: true });

    return {
      success: true,
      submissionNumber,
      savedAnswerCount: Object.keys(answers).length,
    };
  } catch (error) {
    throw toAppError(error, 'Không thể lưu tạm bài làm lúc này.');
  }
}
