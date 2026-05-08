'use strict';

const { HttpsError, onCall } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { Timestamp, db } = require('./lib/firestore');
const { validateReportPayload } = require('./validators/report.validator');
const {
  QUIZ_ATTEMPT_STATUS_REOPENED,
  QUIZ_ATTEMPT_STATUS_SUBMITTED,
  QUIZ_SESSION_NUMBERS,
  normalizeQuizContextPayload,
  validateQuizSubmissionPayload,
} = require('./validators/quiz.validator');

const REGION = 'asia-southeast1';
const TIME_ZONE = 'Asia/Ho_Chi_Minh';

function formatDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function toMillis(value) {
  if (!value) {
    return null;
  }

  if (typeof value?.toMillis === 'function') {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return null;
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeQuizConfig(data = {}, fallbackSessionNumber = 0) {
  const sessionNumber = Number(data.sessionNumber || fallbackSessionNumber || 0);
  const questions = Array.isArray(data.questions)
    ? data.questions
        .map((question, questionIndex) => {
          const options = Array.isArray(question?.options)
            ? question.options
                .map((option, optionIndex) => ({
                  id: normalizeText(option?.id) || `option-${questionIndex + 1}-${optionIndex + 1}`,
                  text: normalizeText(option?.text),
                  order: Math.max(1, Number(option?.order || optionIndex + 1)),
                }))
                .filter((option) => option.text)
            : [];

          const correctOptionId = normalizeText(question?.correctOptionId);

          return {
            id: normalizeText(question?.id) || `question-${questionIndex + 1}`,
            prompt: normalizeText(question?.prompt),
            order: Math.max(1, Number(question?.order || questionIndex + 1)),
            options,
            correctOptionId,
          };
        })
        .filter((question) => question.prompt)
        .sort((left, right) => left.order - right.order)
    : [];

  return {
    sessionNumber,
    title: normalizeText(data.title),
    description: normalizeText(data.description),
    questions,
  };
}

function ensureQuizConfigReady(quiz) {
  if (!QUIZ_SESSION_NUMBERS.includes(Number(quiz?.sessionNumber))) {
    throw new HttpsError('failed-precondition', 'Buoi kiem tra nay chua duoc cau hinh hop le.');
  }

  if (!normalizeText(quiz?.title)) {
    throw new HttpsError('failed-precondition', 'De trac nghiem chua co tieu de hop le.');
  }

  if (!Array.isArray(quiz?.questions) || quiz.questions.length === 0) {
    throw new HttpsError('failed-precondition', 'De trac nghiem chua co cau hoi nao.');
  }

  quiz.questions.forEach((question, questionIndex) => {
    if (!question.prompt) {
      throw new HttpsError('failed-precondition', `Cau ${questionIndex + 1} chua co noi dung.`);
    }

    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new HttpsError(
        'failed-precondition',
        `Cau ${questionIndex + 1} can it nhat 2 lua chon hop le.`,
      );
    }

    if (!question.options.some((option) => option.id === question.correctOptionId)) {
      throw new HttpsError(
        'failed-precondition',
        `Cau ${questionIndex + 1} chua co dap an dung hop le.`,
      );
    }
  });
}

function buildStudentRosterItem(doc) {
  const data = doc.data();

  return {
    studentId: doc.id,
    fullName: data.fullName,
    projectName: data.projectName ?? '',
    lastReportedAt: data.lastReportedAt ?? null,
    latestReportId: data.latestReportId ?? '',
    currentProgressPercent: data.currentProgressPercent ?? 0,
    currentStage: data.currentStage ?? 'Y tuong',
    currentStatus: data.currentStatus ?? 'Chua bat dau',
    currentDifficulties: data.currentDifficulties ?? '',
  };
}

function buildQuizConfigDocId(sessionNumber) {
  return `session-${Number(sessionNumber || 0)}`;
}

function buildQuizAttemptId(classCode, studentId, sessionNumber) {
  return `${normalizeText(classCode).toUpperCase()}__${normalizeText(studentId)}__${Number(sessionNumber || 0)}`;
}

function buildPublicQuiz(quiz) {
  return {
    sessionNumber: Number(quiz.sessionNumber || 0),
    title: quiz.title,
    description: quiz.description,
    questionCount: quiz.questions.length,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      order: question.order,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        order: option.order,
      })),
    })),
  };
}

function buildQuizClassInfo(classCode, classData) {
  return {
    classCode,
    className: classData.className ?? '',
    curriculumProgramId: normalizeText(classData.curriculumProgramId),
    currentSession: Number(classData.curriculumCurrentSession ?? 0),
    curriculumPhase: classData.curriculumPhase === 'final' ? 'final' : 'learning',
  };
}

function buildAdminQuizConfigItem(docId, data) {
  const quiz = normalizeQuizConfig(data, data?.sessionNumber);
  ensureQuizConfigReady(quiz);

  return {
    id: docId,
    sessionNumber: quiz.sessionNumber,
    title: quiz.title,
    description: quiz.description,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      order: question.order,
      correctOptionId: question.correctOptionId,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        order: option.order,
      })),
    })),
  };
}

function buildAdminQuizAttemptItem(docId, data) {
  return {
    id: docId,
    classCode: normalizeText(data.classCode).toUpperCase(),
    className: normalizeText(data.className),
    studentId: normalizeText(data.studentId),
    studentName: normalizeText(data.studentName),
    curriculumProgramId: normalizeText(data.curriculumProgramId),
    sessionNumber: Number(data.sessionNumber || 0),
    quizTitle: normalizeText(data.quizTitle),
    questionCount: Number(data.questionCount || 0),
    correctCount: Number(data.correctCount || 0),
    score: Number(data.score || 0),
    submissionCount: Math.max(0, Number(data.submissionCount || 0)),
    status:
      data.status === QUIZ_ATTEMPT_STATUS_REOPENED
        ? QUIZ_ATTEMPT_STATUS_REOPENED
        : QUIZ_ATTEMPT_STATUS_SUBMITTED,
    answers: data.answers && typeof data.answers === 'object' ? data.answers : {},
    gradedQuestions: Array.isArray(data.gradedQuestions)
      ? data.gradedQuestions.map((item, index) => ({
          questionId: normalizeText(item.questionId),
          prompt: normalizeText(item.prompt),
          order: Math.max(1, Number(item.order || index + 1)),
          selectedOptionId: normalizeText(item.selectedOptionId),
          selectedOptionText: normalizeText(item.selectedOptionText),
          correctOptionId: normalizeText(item.correctOptionId),
          correctOptionText: normalizeText(item.correctOptionText),
          isCorrect: Boolean(item.isCorrect),
        }))
      : [],
    submittedAt:
      typeof data.submittedAt?.toDate === 'function' ? data.submittedAt.toDate().toISOString() : data.submittedAt ?? null,
    reopenedAt:
      typeof data.reopenedAt?.toDate === 'function' ? data.reopenedAt.toDate().toISOString() : data.reopenedAt ?? null,
    reopenedBy: normalizeText(data.reopenedBy),
    createdAt:
      typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate().toISOString() : data.createdAt ?? null,
    updatedAt:
      typeof data.updatedAt?.toDate === 'function' ? data.updatedAt.toDate().toISOString() : data.updatedAt ?? null,
  };
}

function buildUnavailableQuizContext(classCode, classData, reason) {
  return {
    classInfo: buildQuizClassInfo(classCode, classData),
    availability: {
      isEligible: false,
      sessionNumber: Number(classData.curriculumCurrentSession ?? 0),
      reason,
    },
    quiz: null,
    attempt: null,
  };
}

async function getValidatedActiveClass(classCode, purpose = 'gui bao cao') {
  const classRef = db.collection('classes').doc(classCode);
  const classSnap = await classRef.get();

  if (!classSnap.exists) {
    throw new HttpsError('not-found', 'Khong tim thay lop hoc.');
  }

  const classData = classSnap.data();

  if (classData.hidden || classData.status !== 'active') {
    throw new HttpsError('failed-precondition', `Lop hoc hien khong mo de ${purpose}.`);
  }

  return { ref: classRef, data: classData };
}

async function getValidatedStudent(studentId, classCode) {
  const studentRef = db.collection('students').doc(studentId);
  const studentSnap = await studentRef.get();

  if (!studentSnap.exists) {
    throw new HttpsError('not-found', 'Khong tim thay hoc sinh.');
  }

  const studentData = studentSnap.data();

  if (!studentData.active || studentData.classId !== classCode) {
    throw new HttpsError(
      'failed-precondition',
      'Hoc sinh hien khong thuoc lop duoc chon hoac da bi khoa.',
    );
  }

  return {
    ref: studentRef,
    data: studentData,
  };
}

async function getValidatedAdminRequest(request) {
  const email = normalizeText(request.auth?.token?.email).toLowerCase();

  if (!request.auth || !email) {
    throw new HttpsError('unauthenticated', 'Vui long dang nhap bang tai khoan admin.');
  }

  const adminSnap = await db.collection('admins').doc(email).get();

  if (!adminSnap.exists || adminSnap.data()?.active !== true) {
    throw new HttpsError('permission-denied', 'Ban khong co quyen thuc hien thao tac nay.');
  }

  return {
    email,
    profile: adminSnap.data(),
  };
}

async function resolveClassQuiz(classCode, classData) {
  const programId = normalizeText(classData.curriculumProgramId);
  const sessionNumber = Number(classData.curriculumCurrentSession ?? 0);

  if (!programId) {
    return {
      quiz: null,
      reason: 'Lop nay chua duoc gan chuong trinh hoc.',
      sessionNumber,
      programId: '',
    };
  }

  if (!QUIZ_SESSION_NUMBERS.includes(sessionNumber)) {
    return {
      quiz: null,
      reason: `Lop nay dang o buoi ${sessionNumber || '?'} nen chua mo bai kiem tra trac nghiem.`,
      sessionNumber,
      programId,
    };
  }

  const quizSnap = await db
    .collection('curriculumPrograms')
    .doc(programId)
    .collection('quizConfigs')
    .doc(buildQuizConfigDocId(sessionNumber))
    .get();

  if (!quizSnap.exists) {
    return {
      quiz: null,
      reason: `Chua cau hinh de trac nghiem cho buoi ${sessionNumber}.`,
      sessionNumber,
      programId,
    };
  }

  const quiz = normalizeQuizConfig(quizSnap.data(), sessionNumber);
  ensureQuizConfigReady(quiz);

  return {
    quiz,
    reason: '',
    sessionNumber,
    programId,
  };
}

function gradeQuizAnswers(quiz, answers) {
  return quiz.questions.map((question, questionIndex) => {
    const selectedOptionId = normalizeText(answers[question.id]);
    const selectedOption = question.options.find((option) => option.id === selectedOptionId) || null;
    const correctOption = question.options.find((option) => option.id === question.correctOptionId) || null;

    if (!selectedOption) {
      throw new HttpsError(
        'invalid-argument',
        `Can chon dap an hop le cho cau ${questionIndex + 1}.`,
      );
    }

    return {
      questionId: question.id,
      prompt: question.prompt,
      order: question.order,
      selectedOptionId,
      selectedOptionText: selectedOption.text,
      correctOptionId: correctOption?.id || '',
      correctOptionText: correctOption?.text || '',
      isCorrect: selectedOptionId === question.correctOptionId,
    };
  });
}

exports.listActiveClasses = onCall({ region: REGION, cors: true }, async () => {
  const snap = await db
    .collection('classes')
    .where('status', '==', 'active')
    .where('hidden', '==', false)
    .get();

  return {
    classes: snap.docs
      .map((doc) => {
        const data = doc.data();

        return {
          classId: doc.id,
          classCode: data.classCode,
          className: data.className,
        };
      })
      .sort((left, right) => left.className.localeCompare(right.className, 'vi')),
  };
});

exports.getClassRoster = onCall({ region: REGION, cors: true }, async (request) => {
  const classCode = String(request.data?.classCode ?? '').trim().toUpperCase();

  if (!classCode) {
    throw new HttpsError('invalid-argument', 'classCode la bat buoc.');
  }

  await getValidatedActiveClass(classCode, 'xem danh sach hoc sinh');

  const studentsSnap = await db
    .collection('students')
    .where('classId', '==', classCode)
    .where('active', '==', true)
    .get();

  return {
    students: studentsSnap.docs
      .map(buildStudentRosterItem)
      .sort((left, right) => left.fullName.localeCompare(right.fullName, 'vi')),
  };
});

exports.submitStudentReport = onCall({ region: REGION, cors: true }, async (request) => {
  const validation = validateReportPayload(request.data);

  if (!validation.isValid) {
    throw new HttpsError('invalid-argument', validation.errors.join(' '));
  }

  const { classCode, studentId, doneToday, nextGoal, difficulties, progressPercent, stage, status } =
    validation.value;

  await getValidatedActiveClass(classCode, 'gui bao cao');

  const { ref: studentRef, data: studentData } = await getValidatedStudent(studentId, classCode);

  const latestReportSnap = await db
    .collection('reports')
    .where('studentId', '==', studentId)
    .orderBy('submittedAt', 'desc')
    .limit(1)
    .get();

  const latestReport = latestReportSnap.empty ? null : latestReportSnap.docs[0].data();
  const latestProgress = latestReport?.progressPercent ?? null;
  const progressStalledCount =
    latestProgress === null ? 0 : progressPercent <= latestProgress ? (studentData.progressStalledCount ?? 0) + 1 : 0;
  const currentDifficulties = String(difficulties ?? '').trim();

  const submittedAt = Timestamp.now();
  const submittedDateKey = formatDateKey(new Date());
  const reportRef = db.collection('reports').doc();

  await db.runTransaction(async (transaction) => {
    transaction.set(reportRef, {
      classId: classCode,
      classCode,
      studentId,
      studentName: studentData.fullName,
      projectName: studentData.projectName ?? '',
      progressPercent,
      stage,
      status,
      doneToday,
      nextGoal,
      difficulties: currentDifficulties,
      submittedAt,
      submittedDateKey,
      source: 'student-form',
      createdAt: submittedAt,
    });

    transaction.update(studentRef, {
      currentProgressPercent: progressPercent,
      currentStage: stage,
      currentStatus: status,
      currentDifficulties,
      lastReportedAt: submittedAt,
      latestReportId: reportRef.id,
      progressStalledCount,
      updatedAt: submittedAt,
    });
  });

  logger.info('Student report submitted', {
    classCode,
    studentId,
    reportId: reportRef.id,
    progressPercent,
    progressStalledCount,
    submittedAtMillis: toMillis(submittedAt),
  });

  return {
    reportId: reportRef.id,
    submittedAt: submittedAt.toDate().toISOString(),
  };
});

exports.getStudentQuizContext = onCall({ region: REGION, cors: true }, async (request) => {
  const { classCode, studentId } = normalizeQuizContextPayload(request.data);

  if (!classCode) {
    throw new HttpsError('invalid-argument', 'classCode la bat buoc.');
  }

  const { data: classData } = await getValidatedActiveClass(classCode, 'lam bai kiem tra');
  const resolvedQuiz = await resolveClassQuiz(classCode, classData);

  if (!resolvedQuiz.quiz) {
    return buildUnavailableQuizContext(classCode, classData, resolvedQuiz.reason);
  }

  let attempt = null;

  if (studentId) {
    await getValidatedStudent(studentId, classCode);

    const attemptSnap = await db
      .collection('quizAttempts')
      .doc(buildQuizAttemptId(classCode, studentId, resolvedQuiz.sessionNumber))
      .get();

    if (attemptSnap.exists) {
      const attemptData = attemptSnap.data();

      attempt = {
        status:
          attemptData.status === QUIZ_ATTEMPT_STATUS_REOPENED
            ? QUIZ_ATTEMPT_STATUS_REOPENED
            : QUIZ_ATTEMPT_STATUS_SUBMITTED,
        submittedAt:
          typeof attemptData.submittedAt?.toDate === 'function'
            ? attemptData.submittedAt.toDate().toISOString()
            : attemptData.submittedAt ?? null,
        submissionCount: Number(attemptData.submissionCount ?? 0),
      };
    }
  }

  return {
    classInfo: buildQuizClassInfo(classCode, classData),
    availability: {
      isEligible: true,
      sessionNumber: resolvedQuiz.sessionNumber,
      reason: '',
    },
    quiz: buildPublicQuiz(resolvedQuiz.quiz),
    attempt,
  };
});

exports.listQuizConfigsAdmin = onCall({ region: REGION, cors: true }, async (request) => {
  await getValidatedAdminRequest(request);
  const programId = normalizeText(request.data?.programId);

  if (!programId) {
    throw new HttpsError('invalid-argument', 'programId la bat buoc.');
  }

  const programSnap = await db.collection('curriculumPrograms').doc(programId).get();

  if (!programSnap.exists) {
    throw new HttpsError('not-found', 'Khong tim thay chuong trinh hoc.');
  }

  const quizSnaps = await db.collection('curriculumPrograms').doc(programId).collection('quizConfigs').get();
  const quizConfigs = quizSnaps.docs
    .map((doc) => buildAdminQuizConfigItem(doc.id, doc.data()))
    .sort((left, right) => left.sessionNumber - right.sessionNumber);

  return {
    quizConfigs,
  };
});

exports.saveQuizConfigAdmin = onCall({ region: REGION, cors: true }, async (request) => {
  await getValidatedAdminRequest(request);
  const programId = normalizeText(request.data?.programId);

  if (!programId) {
    throw new HttpsError('invalid-argument', 'programId la bat buoc.');
  }

  const programRef = db.collection('curriculumPrograms').doc(programId);
  const programSnap = await programRef.get();

  if (!programSnap.exists) {
    throw new HttpsError('not-found', 'Khong tim thay chuong trinh hoc.');
  }

  const quiz = buildAdminQuizConfigItem(
    buildQuizConfigDocId(request.data?.sessionNumber),
    request.data,
  );
  const quizRef = programRef.collection('quizConfigs').doc(buildQuizConfigDocId(quiz.sessionNumber));
  const existingSnap = await quizRef.get();
  const now = Timestamp.now();

  await quizRef.set(
    {
      programId,
      sessionNumber: quiz.sessionNumber,
      title: quiz.title,
      description: quiz.description,
      questions: quiz.questions,
      createdAt: existingSnap.exists ? existingSnap.data()?.createdAt || now : now,
      updatedAt: now,
    },
    { merge: true },
  );

  logger.info('Quiz config saved by admin', {
    programId,
    sessionNumber: quiz.sessionNumber,
  });

  return {
    success: true,
    sessionNumber: quiz.sessionNumber,
  };
});

exports.listQuizAttemptsByClassAdmin = onCall({ region: REGION, cors: true }, async (request) => {
  await getValidatedAdminRequest(request);
  const classCode = normalizeText(request.data?.classCode).toUpperCase();

  if (!classCode) {
    throw new HttpsError('invalid-argument', 'classCode la bat buoc.');
  }

  const attemptsSnap = await db.collection('quizAttempts').where('classCode', '==', classCode).get();
  const attempts = attemptsSnap.docs
    .map((doc) => buildAdminQuizAttemptItem(doc.id, doc.data()))
    .sort((left, right) => {
      const leftTime = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
      const rightTime = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;

      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }

      if (left.sessionNumber !== right.sessionNumber) {
        return left.sessionNumber - right.sessionNumber;
      }

      return left.studentName.localeCompare(right.studentName, 'vi');
    });

  return {
    attempts,
  };
});

exports.reopenQuizAttemptAdmin = onCall({ region: REGION, cors: true }, async (request) => {
  const admin = await getValidatedAdminRequest(request);
  const attemptId = normalizeText(request.data?.attemptId);

  if (!attemptId) {
    throw new HttpsError('invalid-argument', 'attemptId la bat buoc.');
  }

  const attemptRef = db.collection('quizAttempts').doc(attemptId);
  const attemptStateRef = db.collection('quizAttemptStates').doc(attemptId);
  const attemptSnap = await attemptRef.get();

  if (!attemptSnap.exists) {
    throw new HttpsError('not-found', 'Khong tim thay bai nop can mo lai.');
  }

  const attemptData = attemptSnap.data();
  const reopenedAt = Timestamp.now();
  const batch = db.batch();

  batch.set(
    attemptRef,
    {
      status: QUIZ_ATTEMPT_STATUS_REOPENED,
      reopenedAt,
      reopenedBy: admin.email,
      updatedAt: reopenedAt,
    },
    { merge: true },
  );
  batch.set(
    attemptStateRef,
    {
      classCode: normalizeText(attemptData.classCode).toUpperCase(),
      studentId: normalizeText(attemptData.studentId),
      sessionNumber: Number(attemptData.sessionNumber || 0),
      status: QUIZ_ATTEMPT_STATUS_REOPENED,
      submissionCount: Math.max(0, Number(attemptData.submissionCount || 0)),
      submittedAt: attemptData.submittedAt ?? null,
      createdAt: attemptData.createdAt ?? reopenedAt,
      reopenedAt,
      reopenedBy: admin.email,
      updatedAt: reopenedAt,
    },
    { merge: true },
  );

  await batch.commit();

  logger.info('Quiz attempt reopened by admin', {
    attemptId,
    adminEmail: admin.email,
  });

  return {
    success: true,
    attemptId,
  };
});

exports.submitStudentQuiz = onCall({ region: REGION, cors: true }, async (request) => {
  const validation = validateQuizSubmissionPayload(request.data);

  if (!validation.isValid) {
    throw new HttpsError('invalid-argument', validation.errors.join(' '));
  }

  const { classCode, studentId, answers } = validation.value;
  const { data: classData } = await getValidatedActiveClass(classCode, 'lam bai kiem tra');
  const { data: studentData } = await getValidatedStudent(studentId, classCode);
  const resolvedQuiz = await resolveClassQuiz(classCode, classData);

  if (!resolvedQuiz.quiz) {
    throw new HttpsError('failed-precondition', resolvedQuiz.reason);
  }

  const attemptId = buildQuizAttemptId(classCode, studentId, resolvedQuiz.sessionNumber);
  const attemptRef = db.collection('quizAttempts').doc(attemptId);
  const submittedAt = Timestamp.now();
  const gradedQuestions = gradeQuizAnswers(resolvedQuiz.quiz, answers);
  const correctCount = gradedQuestions.filter((item) => item.isCorrect).length;
  const questionCount = gradedQuestions.length;
  const score = Math.round((correctCount / Math.max(1, questionCount)) * 100);

  await db.runTransaction(async (transaction) => {
    const attemptSnap = await transaction.get(attemptRef);
    const attemptData = attemptSnap.exists ? attemptSnap.data() : null;

    if (attemptData && attemptData.status !== QUIZ_ATTEMPT_STATUS_REOPENED) {
      throw new HttpsError('failed-precondition', 'Hoc sinh nay da nop bai cho buoi kiem tra hien tai.');
    }

    transaction.set(attemptRef, {
      classCode,
      className: classData.className ?? '',
      studentId,
      studentName: studentData.fullName ?? '',
      curriculumProgramId: resolvedQuiz.programId,
      sessionNumber: resolvedQuiz.sessionNumber,
      quizTitle: resolvedQuiz.quiz.title,
      answers,
      gradedQuestions,
      correctCount,
      questionCount,
      score,
      status: QUIZ_ATTEMPT_STATUS_SUBMITTED,
      submissionCount: attemptData ? Number(attemptData.submissionCount ?? 0) + 1 : 1,
      submittedAt,
      reopenedAt: attemptData?.reopenedAt ?? null,
      reopenedBy: attemptData?.reopenedBy ?? '',
      createdAt: attemptData?.createdAt ?? submittedAt,
      updatedAt: submittedAt,
    });
  });

  logger.info('Student quiz submitted', {
    classCode,
    studentId,
    sessionNumber: resolvedQuiz.sessionNumber,
    attemptId,
    correctCount,
    questionCount,
    score,
    submittedAtMillis: toMillis(submittedAt),
  });

  return {
    attemptId,
    submittedAt: submittedAt.toDate().toISOString(),
    questionCount,
  };
});
