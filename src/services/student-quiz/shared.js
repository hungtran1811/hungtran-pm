import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseServices } from '../../config/firebase.js';
import { toClassModel } from '../../models/class.model.js';
import { getCurriculumProgram } from '../curriculum.service.js';
import { getQuizConfigForProgramSession, isAdminQuizPreviewRecord } from '../quizzes.service.js';
import {
  getCurriculumActivityTypeLabel,
  getCurriculumSessionActivity,
  isCurriculumQuizActivity,
} from '../../utils/curriculum-program.js';
import {
  buildQuizAttemptId,
  buildQuizLiveAttemptId,
  buildStudentQuizVariant,
  QUIZ_ATTEMPT_STATUS_REOPENED,
  QUIZ_ATTEMPT_STATUS_SUBMITTED,
  QUIZ_MODE_OFFICIAL,
  QUIZ_QUESTION_LIMIT,
  normalizeQuizMode,
  normalizeQuizTimeLimitMinutes,
  isQuizStartedForClass,
} from '../../utils/quiz.js';

export function normalizeText(value) {
  return String(value ?? '').trim();
}

export function normalizeQuizContextRequest(payloadOrClassCode, studentId = '') {
  if (payloadOrClassCode && typeof payloadOrClassCode === 'object' && !Array.isArray(payloadOrClassCode)) {
    return {
      classCode: String(payloadOrClassCode.classCode ?? '').trim().toUpperCase(),
      studentId: normalizeText(payloadOrClassCode.studentId),
    };
  }

  return {
    classCode: String(payloadOrClassCode ?? '').trim().toUpperCase(),
    studentId: normalizeText(studentId),
  };
}

export function buildClassInfo(classItem) {
  return {
    classCode: classItem.classCode,
    className: classItem.className,
    curriculumProgramId: classItem.curriculumProgramId,
    currentSession: Number(classItem.curriculumCurrentSession || 0),
    curriculumPhase: classItem.curriculumPhase,
    activeQuizSessionNumber: Number(classItem.activeQuizSessionNumber || 0),
    activeQuizMode: QUIZ_MODE_OFFICIAL,
    quizStatus: classItem.quizStatus || 'idle',
    quizStartedAt: classItem.quizStartedAt || null,
    quizEndedAt: classItem.quizEndedAt || null,
  };
}

export function buildUnavailableQuizContext(classItem, reason, attempt = null, sessionActivity = null, program = null) {
  const sessionNumber = Number(classItem.curriculumCurrentSession || 0);
  const activityType = sessionActivity?.activityType || '';

  return {
    classInfo: buildClassInfo(classItem),
    availability: {
      isEligible: false,
      sessionNumber,
      activityType,
      quizMode: QUIZ_MODE_OFFICIAL,
      subject: program?.subject || '',
      level: program?.level || '',
      reason,
    },
    quiz: null,
    attempt,
  };
}

export function canAccessQuizForStudent(classItem, sessionNumber, attemptState = null) {
  return isQuizStartedForClass(classItem, sessionNumber) || attemptState?.status === QUIZ_ATTEMPT_STATUS_REOPENED;
}

export function canWriteCurrentQuizAttempt(attemptState = null) {
  return !attemptState || attemptState.status === QUIZ_ATTEMPT_STATUS_REOPENED;
}

export function getNextSubmissionNumber(attemptState = null) {
  const submissionCount = Math.max(0, Number(attemptState?.submissionCount || 0));
  return attemptState?.status === QUIZ_ATTEMPT_STATUS_REOPENED
    ? submissionCount + 1
    : Math.max(1, submissionCount || 1);
}

export function normalizeDraftAnswers(quiz = {}, answers = {}) {
  const source = answers && typeof answers === 'object' ? answers : {};

  return (quiz?.questions || []).reduce((result, question) => {
    const answerValue = normalizeText(source[question.id]);

    if (answerValue) {
      result[question.id] = answerValue;
    }

    return result;
  }, {});
}

export function toMillis(value) {
  if (!value) {
    return 0;
  }

  if (typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value.seconds === 'number') {
    return value.seconds * 1000;
  }

  return 0;
}

export async function getValidatedClass(classCode) {
  const { db } = getFirebaseServices();
  const normalizedClassCode = String(classCode ?? '').trim().toUpperCase();
  const classSnapshot = await getDoc(doc(db, 'classes', normalizedClassCode));

  if (!classSnapshot.exists()) {
    throw new Error('Không tìm thấy lớp học.');
  }

  const classItem = toClassModel(classSnapshot);

  if (classItem.status !== 'active' || classItem.hidden) {
    throw new Error('Lớp học hiện không mở để làm bài kiểm tra.');
  }

  return classItem;
}

export async function getValidatedStudent(studentId, classCode) {
  const { db } = getFirebaseServices();
  const normalizedStudentId = normalizeText(studentId);
  const studentSnapshot = await getDoc(doc(db, 'students', normalizedStudentId));

  if (!studentSnapshot.exists()) {
    throw new Error('Không tìm thấy học sinh.');
  }

  const studentData = studentSnapshot.data();

  if (!studentData.active || studentData.classId !== classCode) {
    throw new Error('Học sinh hiện không thuộc lớp được chọn hoặc đã bị khóa.');
  }

  return {
    id: studentSnapshot.id,
    fullName: studentData.fullName ?? '',
  };
}

export async function getQuizAttemptState(classCode, studentId, sessionNumber) {
  const { db } = getFirebaseServices();
  const attemptStateSnapshot = await getDoc(
    doc(db, 'quizAttemptStates', buildQuizAttemptId(classCode, studentId, sessionNumber)),
  );

  if (!attemptStateSnapshot.exists()) {
    return null;
  }

  const data = attemptStateSnapshot.data();

  if (isAdminQuizPreviewRecord(data)) {
    return null;
  }

  return {
    status:
      data.status === QUIZ_ATTEMPT_STATUS_REOPENED
        ? QUIZ_ATTEMPT_STATUS_REOPENED
        : QUIZ_ATTEMPT_STATUS_SUBMITTED,
    quizMode: normalizeQuizMode(data.quizMode || QUIZ_MODE_OFFICIAL),
    sessionNumber: Number(data.sessionNumber || sessionNumber || 0),
    submittedAt: data.submittedAt ?? null,
    submissionCount: Math.max(0, Number(data.submissionCount || 0)),
    reopenedAt: data.reopenedAt ?? null,
    reopenedBy: normalizeText(data.reopenedBy),
  };
}

export async function getQuizLiveAttempt(classCode, studentId, sessionNumber, submissionNumber) {
  const { db } = getFirebaseServices();
  const attemptId = buildQuizAttemptId(classCode, studentId, sessionNumber);
  const liveAttemptSnapshot = await getDoc(
    doc(db, 'quizLiveAttempts', buildQuizLiveAttemptId(attemptId, submissionNumber)),
  );

  if (!liveAttemptSnapshot.exists()) {
    return null;
  }

  const data = liveAttemptSnapshot.data();

  return {
    id: liveAttemptSnapshot.id,
    attemptId,
    submissionNumber: Math.max(1, Number(data.submissionNumber || submissionNumber || 1)),
    questionIds: Array.isArray(data.questionIds)
      ? data.questionIds.map((questionId) => normalizeText(questionId)).filter(Boolean)
      : [],
    answers: data.answers && typeof data.answers === 'object' ? data.answers : {},
    updatedAt: data.updatedAt ?? null,
  };
}

export function buildStartedQuizVariant(quizPool, classItem, studentId = '', submissionNumber = 1, timingStartAt = null) {
  const timeLimitMinutes = normalizeQuizTimeLimitMinutes(quizPool?.timeLimitMinutes);
  const startedAtValue = timingStartAt || classItem.quizStartedAt;
  const startedAtMs = toMillis(startedAtValue);
  const deadlineAtMs = startedAtMs > 0 ? startedAtMs + timeLimitMinutes * 60 * 1000 : 0;
  const variant = studentId
    ? buildStudentQuizVariant(quizPool, {
        classCode: classItem.classCode,
        studentId,
        sessionNumber: Number(classItem.curriculumCurrentSession || 0),
        submissionNumber,
        questionLimit: QUIZ_QUESTION_LIMIT,
      })
    : {
        subject: quizPool.subject || '',
        level: quizPool.level || '',
        bankId: quizPool.bankId || '',
        sessionNumber: Number(classItem.curriculumCurrentSession || 0),
        submissionNumber,
        quizMode: QUIZ_MODE_OFFICIAL,
        title: quizPool.title,
        description: quizPool.description,
        questionPickPolicy: quizPool.questionPickPolicy,
        questionCount: QUIZ_QUESTION_LIMIT,
        poolQuestionCount: quizPool.questions.length,
        questionIds: [],
        questions: [],
      };

  return {
    ...variant,
    timeLimitMinutes,
    startedAt: startedAtValue || null,
    deadlineAtMs,
  };
}

export function getUnavailableReason(sessionNumber, attemptState = null) {
  if (attemptState?.status === QUIZ_ATTEMPT_STATUS_SUBMITTED) {
    return `Bài kiểm tra buổi ${sessionNumber} đã kết thúc. Giáo viên chưa mở lại lượt làm cho bạn.`;
  }

  return `Giáo viên chưa bắt đầu hoặc đã kết thúc bài kiểm tra cho buổi ${sessionNumber}.`;
}

export async function resolveClassQuizActivity(classItem) {
  const sessionNumber = Number(classItem.curriculumCurrentSession || 0);

  if (!classItem.curriculumProgramId) {
    return {
      program: null,
      sessionActivity: null,
      sessionNumber,
      reason: 'Lớp này chưa được gắn chương trình học.',
    };
  }

  const program = await getCurriculumProgram(classItem.curriculumProgramId);

  if (!program) {
    return {
      program: null,
      sessionActivity: null,
      sessionNumber,
      reason: 'Chương trình học của lớp này hiện không khả dụng.',
    };
  }

  const sessionActivity = getCurriculumSessionActivity(program, sessionNumber);

  if (!isCurriculumQuizActivity(sessionActivity.activityType)) {
    return {
      program,
      sessionActivity,
      sessionNumber,
      reason: `Buổi ${sessionNumber || '?'} đang được cấu hình là ${getCurriculumActivityTypeLabel(sessionActivity.activityType)}, chưa phải buổi kiểm tra.`,
    };
  }

  return {
    program,
    sessionActivity,
    sessionNumber,
    reason: '',
  };
}

export async function getReadyPublicQuizPool(program, sessionNumber) {
  const quizPool = await getQuizConfigForProgramSession(program, sessionNumber, { publicOnly: true });

  return quizPool && Array.isArray(quizPool.questions) ? quizPool : null;
}
