import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseServices } from '../config/firebase.js';
import {
  getCurriculumSessionActivity,
  isCurriculumQuizActivity,
} from '../utils/curriculum-program.js';
import { toAppError } from '../utils/firebase-error.js';
import {
  buildQuizAttemptId,
  buildQuizAttemptSubmissionId,
  buildStudentQuizVariant,
  formatQuizReadinessRequirement,
  getQuizReadiness,
  gradeQuizAnswerMap,
  QUIZ_ATTEMPT_STATUS_REOPENED,
  QUIZ_ATTEMPT_STATUS_SUBMITTED,
  QUIZ_CLASS_STATUS_IDLE,
  QUIZ_CLASS_STATUS_STARTED,
  QUIZ_MODE_OFFICIAL,
} from '../utils/quiz.js';
import { getQuizConfigForProgramSession } from './quiz-bank.service.js';

async function finalizeLiveQuizAttemptsForClass(classCode, classData, sessionNumber) {
  const normalizedClassCode = String(classCode ?? '').trim().toUpperCase();
  const normalizedSessionNumber = Number(sessionNumber || 0);

  if (!normalizedClassCode || !normalizedSessionNumber || !classData?.curriculumProgramId) {
    return 0;
  }

  const { db } = getFirebaseServices();
  const programSnapshot = await getDoc(doc(db, 'curriculumPrograms', classData.curriculumProgramId));

  if (!programSnapshot.exists()) {
    return 0;
  }

  const program = {
    id: programSnapshot.id,
    ...programSnapshot.data(),
  };
  const quizConfig = await getQuizConfigForProgramSession(program, normalizedSessionNumber);

  if (!quizConfig) {
    return 0;
  }

  const liveAttemptsQuery = query(
    collection(db, 'quizLiveAttempts'),
    where('classCode', '==', normalizedClassCode),
    where('sessionNumber', '==', normalizedSessionNumber),
    where('status', '==', 'draft'),
  );
  const liveAttemptsSnapshot = await getDocs(liveAttemptsQuery);
  let finalizedCount = 0;

  for (const liveSnapshot of liveAttemptsSnapshot.docs) {
    const liveData = liveSnapshot.data();
    const studentId = String(liveData.studentId || '').trim();

    if (!studentId) {
      continue;
    }

    const attemptId = String(liveData.attemptId || '').trim()
      || buildQuizAttemptId(normalizedClassCode, studentId, normalizedSessionNumber);
    const attemptRef = doc(db, 'quizAttempts', attemptId);
    const attemptStateRef = doc(db, 'quizAttemptStates', attemptId);
    const [attemptSnapshot, attemptStateSnapshot, studentSnapshot] = await Promise.all([
      getDoc(attemptRef),
      getDoc(attemptStateRef),
      getDoc(doc(db, 'students', studentId)),
    ]);
    const attemptData = attemptSnapshot.exists() ? attemptSnapshot.data() : {};
    const attemptStateData = attemptStateSnapshot.exists() ? attemptStateSnapshot.data() : {};
    const previousStatus = String(attemptStateData.status || attemptData.status || '').trim();

    if (previousStatus && previousStatus !== QUIZ_ATTEMPT_STATUS_REOPENED) {
      const batch = writeBatch(db);
      batch.set(liveSnapshot.ref, { status: 'ignored', updatedAt: serverTimestamp() }, { merge: true });
      await batch.commit();
      continue;
    }

    const previousSubmissionCount = Math.max(
      0,
      Number(attemptStateData.submissionCount || attemptData.submissionCount || 0),
    );
    const submissionNumber = Math.max(
      previousSubmissionCount + 1,
      Number(liveData.submissionNumber || previousSubmissionCount + 1 || 1),
    );
    const quizVariant = buildStudentQuizVariant(quizConfig, {
      classCode: normalizedClassCode,
      studentId,
      sessionNumber: normalizedSessionNumber,
      submissionNumber,
    });
    const questionIds = Array.isArray(liveData.questionIds) && liveData.questionIds.length > 0
      ? liveData.questionIds.map((questionId) => String(questionId || '').trim()).filter(Boolean)
      : quizVariant.questionIds;
    const answers = liveData.answers && typeof liveData.answers === 'object' ? liveData.answers : {};
    const grading = gradeQuizAnswerMap(quizConfig, answers, questionIds);
    const submittedAt = serverTimestamp();
    const studentData = studentSnapshot.exists() ? studentSnapshot.data() : {};
    const submissionRef = doc(
      db,
      'quizAttemptSubmissions',
      buildQuizAttemptSubmissionId(attemptId, submissionNumber),
    );
    const batch = writeBatch(db);

    batch.set(
      attemptRef,
      {
        classCode: normalizedClassCode,
        className: classData.className || '',
        studentId,
        studentName: studentData.fullName || attemptData.studentName || '',
        curriculumProgramId: classData.curriculumProgramId,
        subject: program.subject || '',
        level: program.level || '',
        bankId: quizConfig.bankId || '',
        sessionNumber: normalizedSessionNumber,
        quizMode: QUIZ_MODE_OFFICIAL,
        quizTitle: quizConfig.title || `Kiểm tra buổi ${normalizedSessionNumber}`,
        questionCount: grading.questionCount,
        questionIds,
        answers,
        gradedQuestions: grading.gradedQuestions,
        correctCount: grading.correctCount,
        score: grading.score,
        status: QUIZ_ATTEMPT_STATUS_SUBMITTED,
        submissionCount: submissionNumber,
        submittedAt,
        createdAt: attemptData.createdAt || submittedAt,
        updatedAt: submittedAt,
      },
      { merge: true },
    );
    batch.set(
      attemptStateRef,
      {
        classCode: normalizedClassCode,
        studentId,
        subject: program.subject || '',
        level: program.level || '',
        bankId: quizConfig.bankId || '',
        sessionNumber: normalizedSessionNumber,
        quizMode: QUIZ_MODE_OFFICIAL,
        status: QUIZ_ATTEMPT_STATUS_SUBMITTED,
        submissionCount: submissionNumber,
        submittedAt,
        createdAt: attemptStateData.createdAt || submittedAt,
        updatedAt: submittedAt,
      },
      { merge: true },
    );
    batch.set(submissionRef, {
      attemptId,
      classCode: normalizedClassCode,
      studentId,
      subject: program.subject || '',
      level: program.level || '',
      bankId: quizConfig.bankId || '',
      sessionNumber: normalizedSessionNumber,
      quizMode: QUIZ_MODE_OFFICIAL,
      submissionNumber,
      questionCount: grading.questionCount,
      questionIds,
      answers,
      correctCount: grading.correctCount,
      score: grading.score,
      gradedQuestions: grading.gradedQuestions,
      submittedAt,
      createdAt: submittedAt,
    });
    batch.set(liveSnapshot.ref, { status: 'finalized', updatedAt: submittedAt }, { merge: true });

    await batch.commit();
    finalizedCount += 1;
  }

  return finalizedCount;
}

export async function setClassQuizStatus(classCode, { sessionNumber, isStarted }) {
  const { db } = getFirebaseServices();
  const normalizedClassCode = String(classCode ?? '').trim().toUpperCase();
  const classRef = doc(db, 'classes', normalizedClassCode);
  let finalizedCount = 0;

  try {
    if (isStarted) {
      const classSnapshot = await getDoc(classRef);

      if (!classSnapshot.exists()) {
        throw new Error('Không tìm thấy lớp cần mở kiểm tra.');
      }

      const classData = classSnapshot.data();
      const currentSession = Number(classData.curriculumCurrentSession || 0);

      if (currentSession !== Number(sessionNumber || 0)) {
        throw new Error(`Lớp hiện đang ở buổi ${currentSession || '?'}, chưa phải buổi ${Number(sessionNumber || 0)}.`);
      }

      if (!classData.curriculumProgramId) {
        throw new Error('Lớp này chưa được gắn chương trình học.');
      }

      const programSnapshot = await getDoc(doc(db, 'curriculumPrograms', classData.curriculumProgramId));

      if (!programSnapshot.exists()) {
        throw new Error('Không tìm thấy chương trình học của lớp này.');
      }

      const program = {
        id: programSnapshot.id,
        ...programSnapshot.data(),
      };
      const sessionActivity = getCurriculumSessionActivity(program, currentSession);

      if (!isCurriculumQuizActivity(sessionActivity.activityType)) {
        throw new Error('Buổi hiện tại chưa được cấu hình là Kiểm tra trong Học liệu.');
      }

      const quizConfig = await getQuizConfigForProgramSession(program, currentSession);
      const readiness = quizConfig ? getQuizReadiness(quizConfig) : null;

      if (!quizConfig || !readiness?.isReady) {
        throw new Error(
          quizConfig
            ? `Ngân hàng câu hỏi chưa đủ theo tỉ lệ 4 dễ, 4 trung bình, 2 khó. ${formatQuizReadinessRequirement(readiness)}`
            : 'Chưa có ngân hàng câu hỏi cho môn, level và buổi hiện tại.',
        );
      }
    } else {
      const classSnapshot = await getDoc(classRef);

      if (!classSnapshot.exists()) {
        throw new Error('Không tìm thấy lớp cần kết thúc kiểm tra.');
      }

      const classData = classSnapshot.data();
      const targetSessionNumber = Number(
        sessionNumber ||
        classData.activeQuizSessionNumber ||
        classData.curriculumCurrentSession ||
        0,
      );

      await updateDoc(classRef, {
        activeQuizSessionNumber: 0,
        activeQuizMode: QUIZ_MODE_OFFICIAL,
        quizStatus: QUIZ_CLASS_STATUS_IDLE,
        quizStartedAt: null,
        quizEndedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      finalizedCount = await finalizeLiveQuizAttemptsForClass(
        normalizedClassCode,
        classData,
        targetSessionNumber,
      );

      return { finalizedCount };
    }

    await updateDoc(classRef, {
      activeQuizSessionNumber: Number(sessionNumber || 0),
      activeQuizMode: QUIZ_MODE_OFFICIAL,
      quizStatus: QUIZ_CLASS_STATUS_STARTED,
      quizStartedAt: serverTimestamp(),
      quizEndedAt: null,
      updatedAt: serverTimestamp(),
    });

    return { finalizedCount };
  } catch (error) {
    throw toAppError(
      error,
      isStarted
        ? 'Không thể bắt đầu bài kiểm tra lúc này.'
        : 'Không thể kết thúc bài kiểm tra lúc này.',
    );
  }
}
