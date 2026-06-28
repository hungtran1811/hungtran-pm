import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { toPracticeQuizSubmissionModel } from '../models/index.js';
import { buildQuizId, buildQuizAttemptId } from './quiz.service.js';
import {
  quizBankIdCandidates,
  quizBankStoragePrefix,
  resolveProgramId,
} from './curriculum.service.js';
import { getFirstExistingDoc } from '../lib/firestoreCandidates.js';
import { responsesToPracticeAnswers } from '../lib/quizResponses.js';

export { responsesToPracticeAnswers };

export function buildPracticeSubmissionId(classCode, studentId, lessonId) {
  return buildQuizAttemptId(classCode, studentId, lessonId);
}

export function emptyPracticeQuiz() {
  return { enabled: false, title: '', questions: [] };
}

export function makePracticeQuestion() {
  return {
    id: `pq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

function normalizePracticeQuestions(questions = []) {
  if (!Array.isArray(questions)) return [];
  return questions
    .map((q, i) => ({
      id: q.id || `pq-${i + 1}`,
      type: 'mcq',
      prompt: String(q.prompt ?? '').trim(),
      options: normalizeOptions(q.options),
      correctIndex: Math.max(0, Number(q.correctIndex ?? 0)),
    }))
    .filter((q) => q.prompt && q.options.length >= 2);
}

export async function getPublicPracticeQuiz(programId, lessonId) {
  if (!programId || !lessonId) return null;
  const snapshot = await getFirstExistingDoc(
    'practiceQuizPublicBanks',
    quizBankIdCandidates(programId, lessonId),
  );
  if (!snapshot) return null;
  const data = snapshot.data();
  return {
    quizId: snapshot.id,
    programId: data.programId ?? programId,
    lessonId: data.lessonId ?? lessonId,
    sessionNumber: Number(data.sessionNumber ?? 0),
    title: data.title ?? '',
    enabled: Boolean(data.enabled ?? false),
    questions: (Array.isArray(data.questions) ? data.questions : []).map((q) => ({
      id: q.id,
      type: 'mcq',
      prompt: q.prompt ?? '',
      options: Array.isArray(q.options) ? q.options : [],
    })),
  };
}

export async function getPracticeAnswerKey(programId, lessonId) {
  if (!programId || !lessonId) return null;
  const snapshot = await getFirstExistingDoc(
    'practiceQuizAnswerBanks',
    quizBankIdCandidates(programId, lessonId),
  );
  if (!snapshot) return null;
  const data = snapshot.data();
  return { answers: data.answers && typeof data.answers === 'object' ? data.answers : {} };
}

export async function loadPracticeQuizForEditor(programId, lessonId, sessionNumber) {
  const [publicQuiz, answerKey] = await Promise.all([
    getPublicPracticeQuiz(programId, lessonId),
    getPracticeAnswerKey(programId, lessonId),
  ]);
  if (!publicQuiz) return emptyPracticeQuiz();
  const answers = answerKey?.answers ?? {};
  return {
    enabled: publicQuiz.enabled,
    title: publicQuiz.title || `Ôn tập buổi ${sessionNumber}`,
    questions: publicQuiz.questions.map((q) => ({
      id: q.id,
      type: 'mcq',
      prompt: q.prompt,
      options: [...q.options],
      correctIndex: Number(answers[q.id] ?? 0),
    })),
  };
}

export async function savePracticeQuizBank(programId, lesson) {
  const storagePrefix = quizBankStoragePrefix(programId);
  const quizId = `${storagePrefix}__${lesson.id}`;
  const quiz = lesson.practiceQuiz ?? emptyPracticeQuiz();
  const questions = normalizePracticeQuestions(quiz.questions);
  const enabled = Boolean(quiz.enabled) && questions.length > 0;

  const publicRef = doc(db, 'practiceQuizPublicBanks', quizId);
  const answerRef = doc(db, 'practiceQuizAnswerBanks', quizId);

  if (!enabled) {
    await setDoc(publicRef, {
      quizId,
      programId: storagePrefix,
      lessonId: lesson.id,
      sessionNumber: Number(lesson.sessionNumber) || 1,
      title: quiz.title?.trim() || `Ôn tập buổi ${lesson.sessionNumber}`,
      enabled: false,
      questions: [],
      updatedAt: serverTimestamp(),
    });
    await setDoc(answerRef, {
      programId: storagePrefix,
      lessonId: lesson.id,
      answers: {},
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const publicQuestions = questions.map(({ id, prompt, options }) => ({ id, prompt, options }));
  const answers = Object.fromEntries(
    questions.map((q) => [q.id, Math.min(q.correctIndex, q.options.length - 1)]),
  );

  await setDoc(publicRef, {
    quizId,
    programId: storagePrefix,
    lessonId: lesson.id,
    sessionNumber: Number(lesson.sessionNumber) || 1,
    title: quiz.title?.trim() || `Ôn tập buổi ${lesson.sessionNumber}`,
    enabled: true,
    questions: publicQuestions,
    updatedAt: serverTimestamp(),
  });
  await setDoc(answerRef, {
    programId: storagePrefix,
    lessonId: lesson.id,
    answers,
    updatedAt: serverTimestamp(),
  });
}

export async function syncAllPracticeQuizBanks(programId, lessons) {
  const withQuiz = lessons.filter((l) => l.practiceQuiz !== undefined);
  await Promise.all(withQuiz.map((lesson) => savePracticeQuizBank(programId, lesson)));
}

function buildPendingPracticeResponses(quiz, rawAnswers) {
  const responses = [];
  const mcqTotal = quiz.questions.length;

  for (const q of quiz.questions) {
    const hasAnswer = rawAnswers[q.id] !== undefined && rawAnswers[q.id] !== null;
    const selectedIndex = hasAnswer ? Number(rawAnswers[q.id]) : -1;
    const selectedLabel = hasAnswer
      ? (q.options?.[selectedIndex] ?? `Đáp án ${selectedIndex + 1}`)
      : 'Chưa trả lời';
    responses.push({
      questionId: q.id,
      questionType: 'mcq',
      prompt: q.prompt,
      selectedIndex,
      selectedLabel,
      isCorrect: null,
    });
  }

  return {
    responses,
    mcqCorrect: 0,
    mcqTotal,
    mcqPercent: 0,
    gradingStatus: 'pending',
  };
}

function buildPracticeResponses(quiz, rawAnswers, answerKey) {
  const responses = [];
  let mcqCorrect = 0;
  const mcqTotal = quiz.questions.length;

  for (const q of quiz.questions) {
    const hasAnswer = rawAnswers[q.id] !== undefined && rawAnswers[q.id] !== null;
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

  return {
    responses,
    mcqCorrect,
    mcqTotal,
    mcqPercent: mcqTotal ? Math.round((mcqCorrect / mcqTotal) * 100) : 0,
    gradingStatus: 'complete',
  };
}

export async function regradePracticeSubmission(submission) {
  const answerKey = await getPracticeAnswerKey(submission.programId, submission.lessonId);
  const quiz = await getPublicPracticeQuiz(submission.programId, submission.lessonId);
  if (!quiz?.questions?.length) return submission;
  const rawAnswers = responsesToPracticeAnswers(submission.responses);
  const graded = buildPracticeResponses(quiz, rawAnswers, answerKey);
  await setDoc(
    doc(db, 'practiceQuizSubmissions', submission.submissionId || submission.id),
    {
      responses: graded.responses,
      mcqCorrect: graded.mcqCorrect,
      mcqTotal: graded.mcqTotal,
      mcqPercent: graded.mcqPercent,
      gradingStatus: 'complete',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return { ...submission, ...graded };
}

export async function regradePendingPracticeSubmissions(submissions = []) {
  const pending = submissions.filter((s) => s.gradingStatus === 'pending');
  return Promise.all(pending.map((s) => regradePracticeSubmission(s).catch(() => s)));
}

export async function getPracticeSubmission(classCode, studentId, lessonId) {
  const submissionId = buildPracticeSubmissionId(classCode, studentId, lessonId);
  try {
    const snapshot = await getDoc(doc(db, 'practiceQuizSubmissions', submissionId));
    if (!snapshot.exists()) return null;
    return toPracticeQuizSubmissionModel(snapshot);
  } catch {
    return null;
  }
}

export function subscribePracticeSubmission(classCode, studentId, lessonId, onData, onError) {
  const submissionId = buildPracticeSubmissionId(classCode, studentId, lessonId);
  return onSnapshot(
    doc(db, 'practiceQuizSubmissions', submissionId),
    (snapshot) => onData(snapshot.exists() ? toPracticeQuizSubmissionModel(snapshot) : null),
    onError,
  );
}

export async function submitPracticeQuiz({ student, classDoc, lesson, programId, quiz, answers }) {
  const submissionId = buildPracticeSubmissionId(classDoc.classCode, student.id, lesson.id);
  const resolvedProgramId = resolveProgramId(programId || classDoc.curriculumProgramId);
  const answerKey = await getPracticeAnswerKey(resolvedProgramId, lesson.id);
  const graded = answerKey?.answers && Object.keys(answerKey.answers).length
    ? buildPracticeResponses(quiz, answers, answerKey)
    : buildPendingPracticeResponses(quiz, answers);
  const { responses, mcqCorrect, mcqTotal, mcqPercent, gradingStatus } = graded;

  const existing = await getPracticeSubmission(classDoc.classCode, student.id, lesson.id);
  const attemptCount = Number(existing?.attemptCount ?? 0) + 1;

  await setDoc(
    doc(db, 'practiceQuizSubmissions', submissionId),
    {
      submissionId,
      classCode: classDoc.classCode,
      studentId: student.id,
      studentName: student.fullName,
      programId: resolvedProgramId,
      lessonId: lesson.id,
      curriculumProgramId: classDoc.curriculumProgramId,
      sessionNumber: Number(lesson.sessionNumber),
      quizTitle: quiz.title?.trim() || `Ôn tập buổi ${lesson.sessionNumber}`,
      lessonTitle: lesson.title ?? '',
      attemptCount,
      responses,
      mcqCorrect,
      mcqTotal,
      mcqPercent,
      gradingStatus,
      source: 'practice-quiz-v1',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return { mcqCorrect, mcqTotal, mcqPercent, attemptCount, responses };
}

const practiceSubmissionsRef = collection(db, 'practiceQuizSubmissions');

function sortPracticeSubmissions(docs) {
  return docs
    .map(toPracticeQuizSubmissionModel)
    .sort((a, b) => (b.submittedAt?.getTime?.() ?? 0) - (a.submittedAt?.getTime?.() ?? 0));
}

export async function listPracticeSubmissionsByClass(classCode, max = 500) {
  const snapshot = await getDocs(
    query(practiceSubmissionsRef, where('classCode', '==', classCode), limit(max)),
  );
  return sortPracticeSubmissions(snapshot.docs);
}

export function subscribePracticeSubmissionsByClass(classCode, onData, onError, max = 500) {
  const q = query(practiceSubmissionsRef, where('classCode', '==', classCode), limit(max));
  return onSnapshot(
    q,
    (snapshot) => onData(sortPracticeSubmissions(snapshot.docs)),
    onError,
  );
}

export async function resetPracticeSubmission({ classCode, studentId, lessonId }) {
  const submissionId = buildPracticeSubmissionId(classCode, studentId, lessonId);
  await deleteDoc(doc(db, 'practiceQuizSubmissions', submissionId));
}
