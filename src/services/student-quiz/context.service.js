import { toAppError } from '../../utils/firebase-error.js';
import { formatQuizReadinessRequirement, getQuizReadiness, QUIZ_MODE_OFFICIAL } from '../../utils/quiz.js';
import {
  buildClassInfo,
  buildStartedQuizVariant,
  buildUnavailableQuizContext,
  canAccessQuizForStudent,
  canWriteCurrentQuizAttempt,
  getNextSubmissionNumber,
  getQuizAttemptState,
  getQuizLiveAttempt,
  getReadyPublicQuizPool,
  getUnavailableReason,
  getValidatedClass,
  getValidatedStudent,
  normalizeQuizContextRequest,
  resolveClassQuizActivity,
} from './shared.js';

export async function getStudentQuizContext(payloadOrClassCode, studentId = '') {
  try {
    const request = normalizeQuizContextRequest(payloadOrClassCode, studentId);
    const classItem = await getValidatedClass(request.classCode);
    const resolvedActivity = await resolveClassQuizActivity(classItem);
    const { sessionNumber, sessionActivity, program } = resolvedActivity;

    if (resolvedActivity.reason) {
      return buildUnavailableQuizContext(classItem, resolvedActivity.reason, null, sessionActivity, program);
    }

    let attemptState = null;

    if (request.studentId) {
      await getValidatedStudent(request.studentId, classItem.classCode);
      attemptState = await getQuizAttemptState(classItem.classCode, request.studentId, sessionNumber);
    }

    if (!canAccessQuizForStudent(classItem, sessionNumber, attemptState)) {
      return buildUnavailableQuizContext(
        classItem,
        getUnavailableReason(sessionNumber, attemptState),
        attemptState,
        sessionActivity,
        program,
      );
    }

    const quizPool = await getReadyPublicQuizPool(program, sessionNumber);

    if (!quizPool || !quizPool.questions.length) {
      return buildUnavailableQuizContext(
        classItem,
        `Chưa cấu hình ngân hàng câu hỏi cho ${program.subject} ${program.level} buổi ${sessionNumber}.`,
        attemptState,
        sessionActivity,
        program,
      );
    }

    const readiness = getQuizReadiness(quizPool);

    if (!readiness.isReady) {
      return buildUnavailableQuizContext(
        classItem,
        `Ngân hàng câu hỏi buổi ${sessionNumber} chưa đủ tỉ lệ 4 dễ, 4 trung bình, 2 khó. ${formatQuizReadinessRequirement(readiness)}`,
        attemptState,
        sessionActivity,
        program,
      );
    }

    const submissionNumber = getNextSubmissionNumber(attemptState);
    const liveAttempt =
      request.studentId && canWriteCurrentQuizAttempt(attemptState)
        ? await getQuizLiveAttempt(classItem.classCode, request.studentId, sessionNumber, submissionNumber)
        : null;

    return {
      classInfo: buildClassInfo(classItem),
      availability: {
        isEligible: true,
        sessionNumber,
        activityType: sessionActivity.activityType,
        quizMode: QUIZ_MODE_OFFICIAL,
        subject: program.subject || '',
        level: program.level || '',
        reason: '',
      },
      quiz: buildStartedQuizVariant(
        { ...quizPool, quizMode: QUIZ_MODE_OFFICIAL },
        classItem,
        request.studentId,
        submissionNumber,
      ),
      attempt: attemptState,
      liveAttempt,
    };
  } catch (error) {
    throw toAppError(error, 'Không tải được bài kiểm tra trắc nghiệm của lớp này.');
  }
}
