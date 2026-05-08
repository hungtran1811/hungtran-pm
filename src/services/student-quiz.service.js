import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getFirebaseServices } from '../config/firebase.js';
import { toClassModel } from '../models/class.model.js';
import { getCurriculumProgram } from './curriculum.service.js';
import { getQuizConfigForProgramSession } from './quizzes.service.js';
import { toAppError } from '../utils/firebase-error.js';
import {
  getCurriculumActivityTypeLabel,
  getCurriculumSessionActivity,
  isCurriculumQuizActivity,
} from '../utils/curriculum-program.js';
import {
  buildQuizAttemptId,
  buildQuizAttemptSubmissionId,
  buildStudentQuizVariant,
  formatQuizReadinessRequirement,
  getQuizReadiness,
  isQuizStartedForClass,
  normalizeQuizMode,
  QUIZ_ATTEMPT_STATUS_REOPENED,
  QUIZ_ATTEMPT_STATUS_SUBMITTED,
  QUIZ_MODE_OFFICIAL,
  QUIZ_QUESTION_LIMIT,
  validateQuizAnswerMap,
} from '../utils/quiz.js';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeQuizContextRequest(payloadOrClassCode, studentId = '') {
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

function buildClassInfo(classItem) {
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

function buildUnavailableQuizContext(classItem, reason, attempt = null, sessionActivity = null, program = null) {
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

function canAccessQuizForStudent(classItem, sessionNumber, attemptState = null) {
  return (
    isQuizStartedForClass(classItem, sessionNumber) ||
    attemptState?.status === QUIZ_ATTEMPT_STATUS_REOPENED
  );
}

async function getValidatedClass(classCode) {
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

async function getValidatedStudent(studentId, classCode) {
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

async function getQuizAttemptState(classCode, studentId, sessionNumber) {
  const { db } = getFirebaseServices();
  const attemptStateSnapshot = await getDoc(
    doc(db, 'quizAttemptStates', buildQuizAttemptId(classCode, studentId, sessionNumber)),
  );

  if (!attemptStateSnapshot.exists()) {
    return null;
  }

  const data = attemptStateSnapshot.data();

  return {
    status:
      data.status === QUIZ_ATTEMPT_STATUS_REOPENED
        ? QUIZ_ATTEMPT_STATUS_REOPENED
        : QUIZ_ATTEMPT_STATUS_SUBMITTED,
    quizMode: normalizeQuizMode(data.quizMode || QUIZ_MODE_OFFICIAL),
    submittedAt: data.submittedAt ?? null,
    submissionCount: Math.max(0, Number(data.submissionCount || 0)),
    reopenedAt: data.reopenedAt ?? null,
    reopenedBy: normalizeText(data.reopenedBy),
  };
}

function buildStartedQuizVariant(quizPool, classItem, studentId = '') {
  const variant = studentId
    ? buildStudentQuizVariant(quizPool, {
        classCode: classItem.classCode,
        studentId,
        sessionNumber: Number(classItem.curriculumCurrentSession || 0),
        questionLimit: QUIZ_QUESTION_LIMIT,
      })
    : {
        subject: quizPool.subject || '',
        level: quizPool.level || '',
        bankId: quizPool.bankId || '',
        sessionNumber: Number(classItem.curriculumCurrentSession || 0),
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
    startedAt: classItem.quizStartedAt || null,
  };
}

function getUnavailableReason(sessionNumber, attemptState = null) {
  if (attemptState?.status === QUIZ_ATTEMPT_STATUS_SUBMITTED) {
    return `Bài kiểm tra buổi ${sessionNumber} đã kết thúc. Giáo viên chưa mở lại lượt làm cho bạn.`;
  }

  return `Giáo viên chưa bắt đầu hoặc đã kết thúc bài kiểm tra cho buổi ${sessionNumber}.`;
}

async function resolveClassQuizActivity(classItem) {
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

    const quizPool = await getQuizConfigForProgramSession(program, sessionNumber, { publicOnly: true });

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
      quiz: buildStartedQuizVariant({ ...quizPool, quizMode: QUIZ_MODE_OFFICIAL }, classItem, request.studentId),
      attempt: attemptState,
    };
  } catch (error) {
    throw toAppError(error, 'Không tải được bài kiểm tra trắc nghiệm của lớp này.');
  }
}

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
    const attemptState = attemptStateSnapshot.exists()
      ? {
          status:
            attemptStateSnapshot.data().status === QUIZ_ATTEMPT_STATUS_REOPENED
              ? QUIZ_ATTEMPT_STATUS_REOPENED
              : QUIZ_ATTEMPT_STATUS_SUBMITTED,
          submissionCount: Math.max(0, Number(attemptStateSnapshot.data().submissionCount || 0)),
        }
      : null;

    if (!canAccessQuizForStudent(classItem, sessionNumber, attemptState)) {
      throw new Error('Bài kiểm tra này đã kết thúc. Các đáp án chưa nộp sẽ không được ghi nhận.');
    }

    const quizPool = await getQuizConfigForProgramSession(program, sessionNumber, { publicOnly: true });

    if (!quizPool || !quizPool.questions.length) {
      throw new Error('Đề kiểm tra hiện chưa được cấu hình đầy đủ.');
    }

    const readiness = getQuizReadiness(quizPool);

    if (!readiness.isReady) {
      throw new Error(`Ngân hàng câu hỏi chưa đủ tỉ lệ 4 dễ, 4 trung bình, 2 khó. ${formatQuizReadinessRequirement(readiness)}`);
    }

    const quizVariant = buildStartedQuizVariant({ ...quizPool, quizMode: QUIZ_MODE_OFFICIAL }, classItem, studentId);
    const validation = validateQuizAnswerMap(quizVariant, payload.answers || {});

    if (!validation.isValid) {
      throw new Error('Bài làm chưa hợp lệ. Hãy trả lời đầy đủ trước khi nộp.');
    }

    if (attemptStateSnapshot.exists() && attemptState?.status !== QUIZ_ATTEMPT_STATUS_REOPENED) {
      throw new Error('Bạn đã nộp bài kiểm tra này rồi.');
    }

    const submittedAt = serverTimestamp();
    const submissionCount = attemptStateSnapshot.exists()
      ? Math.max(1, Number(attemptState?.submissionCount || 0) + 1)
      : 1;
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
    };
    const attemptSubmissionRef = doc(
      db,
      'quizAttemptSubmissions',
      buildQuizAttemptSubmissionId(attemptId, submissionCount),
    );
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

    if (!attemptStateSnapshot.exists()) {
      attemptWritePayload.createdAt = submittedAt;
      attemptStateWritePayload.createdAt = submittedAt;
    }

    batch.set(
      attemptRef,
      attemptWritePayload,
      { merge: true },
    );
    batch.set(
      attemptStateRef,
      attemptStateWritePayload,
      { merge: true },
    );
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
      submittedAt,
      createdAt: submittedAt,
    });

    await batch.commit();

    return {
      success: true,
      sessionNumber,
      quizMode: QUIZ_MODE_OFFICIAL,
    };
  } catch (error) {
    throw toAppError(error, 'Không thể nộp bài kiểm tra lúc này.');
  }
}
