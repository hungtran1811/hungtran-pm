import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseServices } from '../config/firebase.js';
import { getAuthState } from '../state/auth.store.js';
import { toAppError } from '../utils/firebase-error.js';
import {
  buildQuizAttemptId,
  buildQuizAttemptSubmissionId,
  gradeQuizAnswerMap,
  QUIZ_ATTEMPT_STATUS_SUBMITTED,
  QUIZ_MODE_OFFICIAL,
} from '../utils/quiz.js';

export const ADMIN_QUIZ_PREVIEW_STUDENT_ID = '__admin_quiz_preview_student__';
export const ADMIN_QUIZ_PREVIEW_STUDENT_NAME = 'Học sinh mẫu (Admin test)';

export function isAdminQuizPreviewRecord(record = {}) {
  return (
    String(record?.source || '').trim() === 'admin-preview' ||
    String(record?.studentId || '').trim() === ADMIN_QUIZ_PREVIEW_STUDENT_ID
  );
}

export async function recordAdminQuizPreviewSubmission({
  classItem = null,
  program = null,
  quizConfig = null,
  quizVariant = null,
  answers = {},
} = {}) {
  const normalizedClassCode = String(classItem?.classCode ?? '').trim().toUpperCase();
  const normalizedStudentId = ADMIN_QUIZ_PREVIEW_STUDENT_ID;
  const sessionNumber = Number(quizVariant?.sessionNumber || quizConfig?.sessionNumber || 0);

  if (!normalizedClassCode || !sessionNumber) {
    throw new Error('Hãy chọn lớp trước khi gửi kết quả test admin vào trung tâm điểm.');
  }

  if (!quizConfig || !quizVariant) {
    throw new Error('Chưa có đề quiz hợp lệ để ghi nhận kết quả.');
  }

  const { db } = getFirebaseServices();
  const attemptId = buildQuizAttemptId(normalizedClassCode, normalizedStudentId, sessionNumber);
  const attemptRef = doc(db, 'quizAttempts', attemptId);
  const attemptStateRef = doc(db, 'quizAttemptStates', attemptId);

  try {
    const attemptStateSnapshot = await getDoc(attemptStateRef);
    const previousSubmissionCount = attemptStateSnapshot.exists()
      ? Math.max(0, Number(attemptStateSnapshot.data().submissionCount || 0))
      : 0;
    const submissionNumber = previousSubmissionCount + 1;
    const grading = gradeQuizAnswerMap(quizConfig, answers, quizVariant.questionIds);
    const submittedAt = serverTimestamp();
    const authState = getAuthState();
    const submittedBy = authState.user?.email || '';
    const submissionRef = doc(
      db,
      'quizAttemptSubmissions',
      buildQuizAttemptSubmissionId(attemptId, submissionNumber),
    );
    const batch = writeBatch(db);
    const attemptPayload = {
      classCode: normalizedClassCode,
      className: classItem.className || '',
      studentId: normalizedStudentId,
      studentName: ADMIN_QUIZ_PREVIEW_STUDENT_NAME,
      curriculumProgramId: classItem.curriculumProgramId || program?.id || '',
      subject: program?.subject || quizConfig.subject || '',
      level: program?.level || quizConfig.level || '',
      bankId: quizConfig.bankId || quizVariant.bankId || '',
      sessionNumber,
      quizMode: QUIZ_MODE_OFFICIAL,
      quizTitle: quizVariant.title || quizConfig.title || `Kiểm tra buổi ${sessionNumber}`,
      questionCount: grading.questionCount,
      questionIds: quizVariant.questionIds || [],
      answers,
      gradedQuestions: grading.gradedQuestions,
      correctCount: grading.correctCount,
      score: grading.score,
      status: QUIZ_ATTEMPT_STATUS_SUBMITTED,
      submissionCount: submissionNumber,
      submittedAt,
      submittedBy,
      source: 'admin-preview',
      updatedAt: submittedAt,
    };
    const attemptStatePayload = {
      classCode: normalizedClassCode,
      studentId: normalizedStudentId,
      subject: program?.subject || quizConfig.subject || '',
      level: program?.level || quizConfig.level || '',
      bankId: quizConfig.bankId || quizVariant.bankId || '',
      sessionNumber,
      quizMode: QUIZ_MODE_OFFICIAL,
      status: QUIZ_ATTEMPT_STATUS_SUBMITTED,
      submissionCount: submissionNumber,
      submittedAt,
      submittedBy,
      source: 'admin-preview',
      updatedAt: submittedAt,
    };

    if (!attemptStateSnapshot.exists()) {
      attemptPayload.createdAt = submittedAt;
      attemptStatePayload.createdAt = submittedAt;
    }

    batch.set(attemptRef, attemptPayload, { merge: true });
    batch.set(attemptStateRef, attemptStatePayload, { merge: true });
    batch.set(submissionRef, {
      attemptId,
      classCode: normalizedClassCode,
      studentId: normalizedStudentId,
      subject: program?.subject || quizConfig.subject || '',
      level: program?.level || quizConfig.level || '',
      bankId: quizConfig.bankId || quizVariant.bankId || '',
      sessionNumber,
      quizMode: QUIZ_MODE_OFFICIAL,
      submissionNumber,
      questionCount: grading.questionCount,
      questionIds: quizVariant.questionIds || [],
      answers,
      correctCount: grading.correctCount,
      score: grading.score,
      gradedQuestions: grading.gradedQuestions,
      submittedAt,
      submittedBy,
      source: 'admin-preview',
      createdAt: submittedAt,
    });

    await batch.commit();

    return {
      attemptId,
      classCode: normalizedClassCode,
      studentId: normalizedStudentId,
      studentName: ADMIN_QUIZ_PREVIEW_STUDENT_NAME,
      sessionNumber,
      submissionNumber,
    };
  } catch (error) {
    throw toAppError(error, 'Không thể gửi kết quả quiz vào trung tâm điểm lúc này.');
  }
}
