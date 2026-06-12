import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { toQuizAttemptModel, toStudentQuizSubmissionModel } from '../models/index.js';
import {
  codeMatchesReferences,
  formatReferenceCodeBlock,
  parseReferenceCodeBlock,
} from '../utils/codeCompare.js';
import {
  quizBankIdCandidates,
  quizBankStoragePrefix,
  resolveProgramId,
} from './curriculum.service.js';
import { getFirstExistingDoc } from '../lib/firestoreCandidates.js';

function normalizeCodeReferencesMap(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw).map(([qId, val]) => [
      qId,
      Array.isArray(val) ? val.map(String) : val ? [String(val)] : [],
    ]),
  );
}

export function buildQuizId(programId, lessonId) {
  return `${quizBankStoragePrefix(programId)}__${lessonId}`;
}

export function buildQuizAttemptId(classCode, studentId, lessonId) {
  return `${classCode}__${studentId}__${lessonId}`;
}

export function emptyQuiz() {
  return {
    enabled: false,
    title: '',
    timeLimitMinutes: 30,
    allowRetake: true,
    maxAttempts: 3,
    questions: [],
  };
}

export function resolveQuizMaxAttempts(quiz) {
  if (!quiz) return 1;
  const configured = Number(quiz.maxAttempts);
  if (Number.isFinite(configured) && configured >= 1) return Math.min(20, Math.floor(configured));
  return quiz.allowRetake === false ? 1 : 3;
}

export function getRemainingQuizAttempts(quiz, attemptCount = 0) {
  const max = resolveQuizMaxAttempts(quiz);
  return Math.max(0, max - Number(attemptCount || 0));
}

export function canTakeQuizAttempt(quiz, attemptCount = 0) {
  return getRemainingQuizAttempts(quiz, attemptCount) > 0;
}

function newQuestionId() {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function makeQuizQuestion(type = 'mcq') {
  if (type === 'code') {
    return {
      id: newQuestionId(),
      type: 'code',
      prompt: '',
      starterCode: '',
      referenceCode: '',
    };
  }
  return {
    id: newQuestionId(),
    type: 'mcq',
    prompt: '',
    options: ['', '', '', ''],
    correctIndex: 0,
  };
}

function normalizeOptions(options) {
  const list = Array.isArray(options) ? options.map((o) => String(o ?? '').trim()) : [];
  return list.filter(Boolean).length >= 2 ? list : ['', ''];
}

function normalizeQuizQuestions(questions = []) {
  if (!Array.isArray(questions)) return [];
  return questions
    .map((q, i) => {
      const type = q.type === 'code' ? 'code' : 'mcq';
      if (type === 'code') {
        return {
          id: q.id || `q-${i + 1}`,
          type: 'code',
          prompt: String(q.prompt ?? '').trim(),
          starterCode: String(q.starterCode ?? ''),
          referenceCode: String(q.referenceCode ?? ''),
        };
      }
      return {
        id: q.id || `q-${i + 1}`,
        type: 'mcq',
        prompt: String(q.prompt ?? '').trim(),
        options: normalizeOptions(q.options),
        correctIndex: Math.max(0, Number(q.correctIndex ?? 0)),
      };
    })
    .filter((q) => {
      if (!q.prompt) return false;
      if (q.type === 'code') return true;
      return q.options.length >= 2;
    });
}

export async function getPublicQuiz(programId, lessonId) {
  if (!programId || !lessonId) return null;
  const snapshot = await getFirstExistingDoc(
    'quizPublicQuestionBanks',
    quizBankIdCandidates(programId, lessonId),
  );
  if (!snapshot) return null;
  const data = snapshot.data();
  const questions = (Array.isArray(data.questions) ? data.questions : []).map((q) => {
    if (q.type === 'code') {
      return {
        id: q.id,
        type: 'code',
        prompt: q.prompt ?? '',
        starterCode: q.starterCode ?? '',
      };
    }
    return {
      id: q.id,
      type: 'mcq',
      prompt: q.prompt ?? '',
      options: Array.isArray(q.options) ? q.options : [],
    };
  });
  return {
    quizId: snapshot.id,
    programId: data.programId ?? programId,
    lessonId: data.lessonId ?? lessonId,
    sessionNumber: Number(data.sessionNumber ?? 0),
    title: data.title ?? '',
    enabled: Boolean(data.enabled ?? false),
    timeLimitMinutes: Number(data.timeLimitMinutes ?? 30),
    allowRetake: data.allowRetake !== false,
    maxAttempts: Number(data.maxAttempts ?? (data.allowRetake === false ? 1 : 3)),
    questions,
  };
}

export async function getQuizAnswerKey(programId, lessonId) {
  if (!programId || !lessonId) return null;
  const snapshot = await getFirstExistingDoc(
    'quizQuestionBanks',
    quizBankIdCandidates(programId, lessonId),
  );
  if (!snapshot) return null;
  const data = snapshot.data();
  return {
    answers: data.answers && typeof data.answers === 'object' ? data.answers : {},
    codeReferences: normalizeCodeReferencesMap(data.codeReferences),
  };
}

export async function loadQuizForEditor(programId, lessonId, sessionNumber) {
  const [publicQuiz, answerKey] = await Promise.all([
    getPublicQuiz(programId, lessonId),
    getQuizAnswerKey(programId, lessonId),
  ]);
  if (!publicQuiz) {
    return emptyQuiz();
  }
  const answers = answerKey?.answers ?? {};
  const codeReferences = answerKey?.codeReferences ?? {};
  return {
    enabled: publicQuiz.enabled,
    title: publicQuiz.title || `Quiz buổi ${sessionNumber}`,
    timeLimitMinutes: publicQuiz.timeLimitMinutes,
    allowRetake: publicQuiz.allowRetake,
    maxAttempts: publicQuiz.maxAttempts,
    questions: publicQuiz.questions.map((q) => {
      if (q.type === 'code') {
        return {
          id: q.id,
          type: 'code',
          prompt: q.prompt,
          starterCode: q.starterCode ?? '',
          referenceCode: formatReferenceCodeBlock(codeReferences[q.id]),
        };
      }
      return {
        id: q.id,
        type: 'mcq',
        prompt: q.prompt,
        options: [...q.options],
        correctIndex: Number(answers[q.id] ?? 0),
      };
    }),
  };
}

export async function saveQuizBank(programId, lesson) {
  const storagePrefix = quizBankStoragePrefix(programId);
  const quizId = `${storagePrefix}__${lesson.id}`;
  const quiz = lesson.quiz ?? emptyQuiz();
  const questions = normalizeQuizQuestions(quiz.questions);
  const enabled = Boolean(quiz.enabled) && questions.length > 0;
  const timeLimitMinutes = Math.max(0, Number(quiz.timeLimitMinutes ?? 30));
  const allowRetake = quiz.allowRetake !== false;
  const maxAttempts = allowRetake
    ? Math.min(20, Math.max(1, Number(quiz.maxAttempts ?? 3)))
    : 1;

  const publicRef = doc(db, 'quizPublicQuestionBanks', quizId);
  const answerRef = doc(db, 'quizQuestionBanks', quizId);

  if (!enabled) {
    await setDoc(publicRef, {
      quizId,
      programId: storagePrefix,
      lessonId: lesson.id,
      sessionNumber: Number(lesson.sessionNumber) || 1,
      title: quiz.title?.trim() || `Quiz buổi ${lesson.sessionNumber}`,
      enabled: false,
      timeLimitMinutes,
      allowRetake,
      maxAttempts,
      questions: [],
      updatedAt: serverTimestamp(),
    });
    await setDoc(answerRef, {
      programId: storagePrefix,
      lessonId: lesson.id,
      answers: {},
      codeReferences: {},
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const publicQuestions = questions.map((q) => {
    if (q.type === 'code') {
      return { id: q.id, type: 'code', prompt: q.prompt, starterCode: q.starterCode ?? '' };
    }
    return { id: q.id, type: 'mcq', prompt: q.prompt, options: q.options };
  });

  const answers = Object.fromEntries(
    questions
      .filter((q) => q.type === 'mcq')
      .map((q) => [q.id, Math.min(q.correctIndex, q.options.length - 1)]),
  );
  const codeReferences = Object.fromEntries(
    questions
      .filter((q) => q.type === 'code')
      .map((q) => [q.id, parseReferenceCodeBlock(q.referenceCode)])
      .filter(([, refs]) => refs.length > 0),
  );

  await setDoc(publicRef, {
    quizId,
    programId: storagePrefix,
    lessonId: lesson.id,
    sessionNumber: Number(lesson.sessionNumber) || 1,
    title: quiz.title?.trim() || `Quiz buổi ${lesson.sessionNumber}`,
    enabled: true,
    timeLimitMinutes,
    allowRetake,
    maxAttempts,
    questions: publicQuestions,
    updatedAt: serverTimestamp(),
  });
  await setDoc(answerRef, {
    programId: storagePrefix,
    lessonId: lesson.id,
    answers,
    codeReferences,
    updatedAt: serverTimestamp(),
  });
}

export async function syncAllQuizBanks(programId, lessons) {
  const withQuiz = lessons.filter((l) => l.quiz !== undefined);
  await Promise.all(withQuiz.map((lesson) => saveQuizBank(programId, lesson)));
}

export async function getQuizLatestStatus(classCode, studentId, lessonId) {
  const latestId = buildQuizAttemptId(classCode, studentId, lessonId);
  try {
    const snapshot = await getDoc(doc(db, 'studentQuizLatest', latestId));
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    return {
      attemptNumber: Number(data.attemptNumber ?? 0),
      submittedAt: data.submittedAt,
    };
  } catch {
    return null;
  }
}

export async function hasSubmittedQuiz(classCode, studentId, lessonId) {
  const status = await getQuizLatestStatus(classCode, studentId, lessonId);
  if (status?.attemptNumber > 0) return true;
  const attemptId = buildQuizAttemptId(classCode, studentId, lessonId);
  try {
    const snapshot = await getDoc(doc(db, 'quizAttemptReceipts', attemptId));
    return snapshot.exists();
  } catch {
    return false;
  }
}

function normalizeCodeAnswer(rawValue, starterCode) {
  const text = String(rawValue ?? '').trim();
  const starter = String(starterCode ?? '').trim();
  if (!text) return '';
  if (starter && text === starter) return '';
  return text;
}

function buildSubmissionResponses(quiz, rawAnswers, answerKey) {
  const responses = [];
  let mcqCorrect = 0;
  let mcqTotal = 0;
  let codeCorrect = 0;
  let codeGraded = 0;
  let unansweredCount = 0;
  const codeRefs = answerKey?.codeReferences ?? {};

  for (const q of quiz.questions) {
    const type = q.type === 'code' ? 'code' : 'mcq';
    if (type === 'code') {
      const codeAnswer = normalizeCodeAnswer(rawAnswers[q.id], q.starterCode);
      if (!codeAnswer) unansweredCount += 1;
      const refs = codeRefs[q.id] ?? [];
      const hasAutoGrade = refs.length > 0;
      const isCorrect = hasAutoGrade ? codeMatchesReferences(codeAnswer, refs) : undefined;
      if (hasAutoGrade) {
        codeGraded += 1;
        if (isCorrect) codeCorrect += 1;
      }
      responses.push({
        questionId: q.id,
        questionType: 'code',
        prompt: q.prompt,
        codeAnswer: codeAnswer || '(chưa trả lời)',
        isCorrect,
        autoGraded: hasAutoGrade,
      });
      continue;
    }
    mcqTotal += 1;
    const hasAnswer = rawAnswers[q.id] !== undefined && rawAnswers[q.id] !== null;
    if (!hasAnswer) unansweredCount += 1;
    const selectedIndex = hasAnswer ? Number(rawAnswers[q.id]) : -1;
    const selectedLabel = hasAnswer
      ? (q.options?.[selectedIndex] ?? `Đáp án ${selectedIndex + 1}`)
      : 'Chưa trả lời';
    const correctIndex = Number(answerKey?.answers?.[q.id]);
    const isCorrect = hasAnswer && !Number.isNaN(correctIndex) && selectedIndex === correctIndex;
    if (isCorrect) mcqCorrect += 1;
    responses.push({
      questionId: q.id,
      questionType: 'mcq',
      prompt: q.prompt,
      selectedIndex,
      selectedLabel,
      isCorrect: hasAnswer ? isCorrect : false,
    });
  }

  const gradedTotal = mcqTotal + codeGraded;
  const gradedCorrect = mcqCorrect + codeCorrect;
  return {
    responses,
    mcqCorrect,
    mcqTotal,
    mcqPercent: mcqTotal ? Math.round((mcqCorrect / mcqTotal) * 100) : 0,
    codeCorrect,
    codeGraded,
    gradedCorrect,
    gradedTotal,
    gradedPercent: gradedTotal ? Math.round((gradedCorrect / gradedTotal) * 100) : 0,
    unansweredCount,
  };
}

export async function submitQuizSubmission({
  student,
  classDoc,
  lesson,
  programId,
  quiz,
  answers,
  startedAtMs,
  durationSeconds,
  timedOut = false,
}) {
  const latestId = buildQuizAttemptId(classDoc.classCode, student.id, lesson.id);
  const resolvedProgramId = resolveProgramId(programId || classDoc.curriculumProgramId);
  const answerKey = await getQuizAnswerKey(resolvedProgramId, lesson.id);
  const {
    responses,
    mcqCorrect,
    mcqTotal,
    mcqPercent,
    codeCorrect,
    codeGraded,
    gradedCorrect,
    gradedTotal,
    gradedPercent,
    unansweredCount,
  } = buildSubmissionResponses(
    quiz,
    answers,
    answerKey,
  );

  const latestSnap = await getDoc(doc(db, 'studentQuizLatest', latestId));
  const previousAttempts = Number(latestSnap.data()?.attemptNumber ?? 0);
  const attemptNumber = previousAttempts + 1;
  const maxAttempts = resolveQuizMaxAttempts(quiz);

  if (attemptNumber > maxAttempts) {
    throw new Error(`Đã hết lượt làm bài (tối đa ${maxAttempts} lần).`);
  }

  const batch = writeBatch(db);
  const submissionRef = doc(collection(db, 'studentQuizSubmissions'));
  const latestRef = doc(db, 'studentQuizLatest', latestId);

  const base = {
    classCode: classDoc.classCode,
    studentId: student.id,
    studentName: student.fullName,
    programId: resolvedProgramId,
    lessonId: lesson.id,
    curriculumProgramId: classDoc.curriculumProgramId,
    sessionNumber: Number(lesson.sessionNumber),
    quizTitle: quiz.title?.trim() || `Quiz buổi ${lesson.sessionNumber}`,
    lessonTitle: lesson.title ?? '',
    attemptNumber,
    maxAttempts,
    timeLimitMinutes: Number(quiz.timeLimitMinutes ?? 0),
    startedAtMs: Number(startedAtMs) || null,
    durationSeconds: Math.max(0, Number(durationSeconds) || 0),
    responses,
    mcqCorrect,
    mcqTotal,
    mcqPercent,
    codeCorrect,
    codeGraded,
    gradedCorrect,
    gradedTotal,
    gradedPercent,
    unansweredCount,
    timedOut: Boolean(timedOut),
    submitReason: timedOut ? 'timeout' : 'manual',
    source: 'student-quiz-v2',
    submittedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  batch.set(submissionRef, base);
  batch.set(
    latestRef,
    {
      classCode: classDoc.classCode,
      studentId: student.id,
      lessonId: lesson.id,
      programId: resolvedProgramId,
      curriculumProgramId: classDoc.curriculumProgramId,
      sessionNumber: Number(lesson.sessionNumber),
      submissionId: submissionRef.id,
      attemptNumber,
      submittedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();
  return { attemptNumber };
}

/** @deprecated Use submitQuizSubmission */
export async function submitQuizAttempt({ student, classDoc, lesson, programId, answers }) {
  const quiz = await getPublicQuiz(
    resolveProgramId(programId || classDoc.curriculumProgramId),
    lesson.id,
  );
  if (!quiz?.enabled) throw new Error('Quiz không khả dụng.');
  await submitQuizSubmission({
    student,
    classDoc,
    lesson,
    programId,
    quiz,
    answers,
    startedAtMs: Date.now(),
    durationSeconds: 0,
  });
}

const studentQuizSubmissionsRef = collection(db, 'studentQuizSubmissions');

function sortSubmissions(docs) {
  return docs
    .map(toStudentQuizSubmissionModel)
    .sort((a, b) => (b.submittedAt?.getTime?.() ?? 0) - (a.submittedAt?.getTime?.() ?? 0));
}

export async function listStudentQuizSubmissions(classCode, max = 500) {
  const snapshot = await getDocs(
    query(studentQuizSubmissionsRef, where('classCode', '==', classCode), limit(max)),
  );
  return sortSubmissions(snapshot.docs);
}

/** Realtime listener — admin Quiz page */
export function filterQuizAttemptsForStudent(submissions, studentId, lessonId) {
  return submissions
    .filter((s) => s.studentId === studentId && s.lessonId === lessonId)
    .sort((a, b) => (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0));
}

export function subscribeStudentQuizSubmissions(classCode, onData, onError, max = 500) {
  const q = query(studentQuizSubmissionsRef, where('classCode', '==', classCode), limit(max));
  return onSnapshot(
    q,
    (snapshot) => onData(sortSubmissions(snapshot.docs)),
    onError,
  );
}

export function computeSubmissionScores(responses = []) {
  let mcqCorrect = 0;
  let mcqTotal = 0;
  let codeCorrect = 0;
  let codeGraded = 0;

  for (const r of responses) {
    if (r.questionType === 'code') {
      if (r.isCorrect === true || r.isCorrect === false) {
        codeGraded += 1;
        if (r.isCorrect === true) codeCorrect += 1;
      }
    } else {
      mcqTotal += 1;
      if (r.isCorrect) mcqCorrect += 1;
    }
  }

  const gradedTotal = mcqTotal + codeGraded;
  const gradedCorrect = mcqCorrect + codeCorrect;
  return {
    mcqCorrect,
    mcqTotal,
    mcqPercent: mcqTotal ? Math.round((mcqCorrect / mcqTotal) * 100) : 0,
    codeCorrect,
    codeGraded,
    gradedCorrect,
    gradedTotal,
    gradedPercent: gradedTotal ? Math.round((gradedCorrect / gradedTotal) * 100) : 0,
  };
}

export function countPendingCodeGrades(responses = []) {
  return responses.filter(
    (r) => r.questionType === 'code' && r.isCorrect !== true && r.isCorrect !== false,
  ).length;
}

function applyAutoCodeGrades(responses, codeReferences) {
  return responses.map((r) => {
    if (r.questionType !== 'code') return r;
    const refs = codeReferences[r.questionId] ?? [];
    if (!refs.length) return r;
    const raw =
      r.codeAnswer === '(chưa trả lời)' || r.codeAnswer === '(trống)' ? '' : r.codeAnswer;
    return {
      ...r,
      isCorrect: codeMatchesReferences(raw, refs),
      autoGraded: true,
      manuallyGraded: false,
    };
  });
}

export async function saveQuizSubmissionGrades(submissionId, responses) {
  const scores = computeSubmissionScores(responses);
  await updateDoc(doc(db, 'studentQuizSubmissions', submissionId), {
    responses,
    ...scores,
    gradedAt: serverTimestamp(),
  });
  return scores;
}

export async function reautoGradeQuizSubmission(submission) {
  const answerKey = await getQuizAnswerKey(submission.programId, submission.lessonId);
  const responses = applyAutoCodeGrades(submission.responses, answerKey?.codeReferences ?? {});
  return saveQuizSubmissionGrades(submission.id, responses);
}

export async function resetStudentQuizAttempts({
  classCode,
  studentId,
  lessonId,
  submissionIds = [],
}) {
  const latestId = buildQuizAttemptId(classCode, studentId, lessonId);
  const batch = writeBatch(db);

  submissionIds.forEach((id) => {
    batch.delete(doc(db, 'studentQuizSubmissions', id));
  });
  batch.delete(doc(db, 'studentQuizLatest', latestId));
  batch.delete(doc(db, 'quizAttemptReceipts', latestId));
  batch.delete(doc(db, 'quizAttempts', latestId));

  await batch.commit();
}

/** @deprecated Use listStudentQuizSubmissions */
const quizAttemptsRef = collection(db, 'quizAttempts');

export async function listQuizAttemptsByClass(classCode, max = 500) {
  const snapshot = await getDocs(
    query(quizAttemptsRef, where('classCode', '==', classCode), limit(max)),
  );
  return snapshot.docs
    .map(toQuizAttemptModel)
    .sort((a, b) => (b.submittedAt?.getTime?.() ?? 0) - (a.submittedAt?.getTime?.() ?? 0));
}

/** @deprecated Legacy scoring */
export function scoreQuizAttempt(attempt, answerKey) {
  const answers = answerKey?.answers ?? {};
  const studentAnswers = attempt.answers ?? {};
  const questionIds = Object.keys(answers);
  if (!questionIds.length) return { correct: 0, total: 0, percent: 0 };
  let correct = 0;
  questionIds.forEach((qId) => {
    if (Number(studentAnswers[qId]) === Number(answers[qId])) correct += 1;
  });
  const total = questionIds.length;
  return { correct, total, percent: Math.round((correct / total) * 100) };
}
