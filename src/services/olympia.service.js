import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import {
  ACTIVE_SESSION_STATUSES,
  computeMountainStep,
  DEFAULT_STEP_THRESHOLD,
  OLYMPIA_ROUNDS,
  responseDocId,
  ROUND_ORDER,
} from '../lib/olympiaConstants.js';
import {
  buildSessionQuestionSet,
  getQuestionFromSession,
  getRoundQuestionCount,
  isLastQuestionInRound,
  isLastRound,
  nextRoundId,
} from '../lib/olympiaQuestions.js';
import { toDate } from '../lib/firestore.js';

const SESSIONS = 'olympiaSessions';
const ANSWER_KEYS = 'olympiaAnswerKeys';

function sessionsRef() {
  return collection(db, SESSIONS);
}

function sessionRef(sessionId) {
  return doc(db, SESSIONS, sessionId);
}

function participantsRef(sessionId) {
  return collection(db, SESSIONS, sessionId, 'participants');
}

function participantRef(sessionId, studentId) {
  return doc(db, SESSIONS, sessionId, 'participants', studentId);
}

function responsesRef(sessionId) {
  return collection(db, SESSIONS, sessionId, 'responses');
}

function responseRef(sessionId, responseId) {
  return doc(db, SESSIONS, sessionId, 'responses', responseId);
}

function answerKeysRef(sessionId) {
  return doc(db, ANSWER_KEYS, sessionId);
}

function normalizeSession(id, data) {
  if (!data) return null;
  return {
    id,
    classCode: data.classCode || '',
    status: data.status || 'draft',
    currentRound: data.currentRound || 'startup',
    questionIndex: Number(data.questionIndex) || 0,
    roundStartedAt: data.roundStartedAt || null,
    questionDeadlineAt: data.questionDeadlineAt || null,
    revealedAnswer: data.revealedAnswer ?? null,
    config: data.config || {},
    createdAt: data.createdAt || null,
    startedAt: data.startedAt || null,
    finishedAt: data.finishedAt || null,
  };
}

function normalizeParticipant(id, data) {
  if (!data) return null;
  return {
    id,
    studentName: data.studentName || '',
    joinedAt: data.joinedAt || null,
    totalScore: Number(data.totalScore) || 0,
    mountainStep: Number(data.mountainStep) || 0,
    peakAt: data.peakAt || null,
    lastActiveAt: data.lastActiveAt || null,
  };
}

function normalizeResponse(id, data) {
  if (!data) return null;
  return {
    id,
    studentId: data.studentId || '',
    studentName: data.studentName || '',
    round: data.round || '',
    questionIndex: Number(data.questionIndex) || 0,
    questionId: data.questionId || '',
    selectedOption: data.selectedOption ?? null,
    finishChoice: data.finishChoice ?? null,
    isCorrect: data.isCorrect ?? null,
    pointsEarned: Number(data.pointsEarned) || 0,
    answeredAt: data.answeredAt || null,
    responseMs: Number(data.responseMs) || 0,
  };
}

export { computeMountainStep };

export async function createOlympiaSession({
  classCode,
  packId = null,
  topics = [],
  customQuestions = [],
  stepThreshold = DEFAULT_STEP_THRESHOLD,
  speedBonusEnabled = false,
}) {
  const { publicQuestions, answerKeys, packLabel } = buildSessionQuestionSet({
    packId,
    topics,
    customQuestions,
  });

  const sessionDoc = await addDoc(sessionsRef(), {
    classCode,
    status: 'draft',
    currentRound: 'startup',
    questionIndex: 0,
    roundStartedAt: null,
    questionDeadlineAt: null,
    revealedAnswer: null,
    config: {
      packId: packId || null,
      packLabel: packLabel || null,
      topics,
      stepThreshold,
      speedBonusEnabled,
      questions: publicQuestions,
      customQuestions: customQuestions.filter(Boolean),
    },
    createdAt: serverTimestamp(),
    startedAt: null,
    finishedAt: null,
  });

  await setDoc(answerKeysRef(sessionDoc.id), { keys: answerKeys });

  return sessionDoc.id;
}

export async function openOlympiaLobby(sessionId) {
  await updateDoc(sessionRef(sessionId), { status: 'lobby' });
}

export async function startOlympiaGame(sessionId) {
  const now = Timestamp.now();
  const roundConfig = OLYMPIA_ROUNDS.startup;
  const deadline = Timestamp.fromMillis(now.toMillis() + roundConfig.seconds * 1000);

  await updateDoc(sessionRef(sessionId), {
    status: 'playing',
    currentRound: 'startup',
    questionIndex: 0,
    roundStartedAt: now,
    questionDeadlineAt: deadline,
    revealedAnswer: null,
    startedAt: now,
  });
}

async function getAnswerKeys(sessionId) {
  const snap = await getDoc(answerKeysRef(sessionId));
  return snap.exists() ? snap.data().keys || {} : {};
}

function computePoints(session, round, isCorrect, finishChoice, responseMs) {
  if (!isCorrect) return 0;
  const roundConfig = OLYMPIA_ROUNDS[round];
  if (round === 'finish') {
    const choice = Number(finishChoice);
    return roundConfig.pointChoices.includes(choice) ? choice : 0;
  }
  let points = roundConfig.basePoints || 0;
  if (round === 'acceleration' && session.config?.speedBonusEnabled) {
    const bonusMs = roundConfig.speedBonusMs || 10000;
    if (responseMs > 0 && responseMs <= bonusMs) {
      points += roundConfig.speedBonus || 0;
    }
  }
  return points;
}

export async function gradeCurrentQuestion(sessionId) {
  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng thi.');
  const session = normalizeSession(sessionSnap.id, sessionSnap.data());
  const round = session.currentRound;
  const questionIndex = session.questionIndex;
  const question = getQuestionFromSession(session, round, questionIndex);
  if (!question) throw new Error('Không tìm thấy câu hỏi.');

  const answerKeys = await getAnswerKeys(sessionId);
  const correctIndex = answerKeys[question.id];
  if (correctIndex === undefined) throw new Error('Thiếu đáp án cho câu hỏi.');

  const responsesSnap = await getDocs(responsesRef(sessionId));
  const batch = writeBatch(db);
  const participantUpdates = new Map();

  responsesSnap.docs.forEach((respDoc) => {
    const data = respDoc.data();
    if (data.round !== round || Number(data.questionIndex) !== questionIndex) return;
    if (data.isCorrect !== null && data.isCorrect !== undefined) return;

    const isCorrect = Number(data.selectedOption) === Number(correctIndex);
    const responseMs = Number(data.responseMs) || 0;
    const pointsEarned = computePoints(session, round, isCorrect, data.finishChoice, responseMs);

    batch.update(respDoc.ref, { isCorrect, pointsEarned });

    const prev = participantUpdates.get(data.studentId) || { addScore: 0 };
    prev.addScore += pointsEarned;
    participantUpdates.set(data.studentId, prev);
  });

  const participantsSnap = await getDocs(participantsRef(sessionId));
  participantsSnap.docs.forEach((partDoc) => {
    const delta = participantUpdates.get(partDoc.id);
    if (!delta) return;
    const current = partDoc.data();
    const totalScore = (Number(current.totalScore) || 0) + delta.addScore;
    const stepThreshold = session.config?.stepThreshold || DEFAULT_STEP_THRESHOLD;
    const mountainStep = computeMountainStep(totalScore, stepThreshold);
    const prevStep = Number(current.mountainStep) || 0;
    const update = {
      totalScore,
      mountainStep,
      lastActiveAt: serverTimestamp(),
    };
    if (mountainStep >= 10 && prevStep < 10 && !current.peakAt) {
      update.peakAt = serverTimestamp();
    }
    batch.update(partDoc.ref, update);
  });

  await batch.commit();

  await updateDoc(sessionRef(sessionId), {
    status: 'reveal',
    revealedAnswer: {
      questionId: question.id,
      correctIndex,
      round,
      questionIndex,
    },
  });
}

export async function advanceOlympiaQuestion(sessionId) {
  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng thi.');
  const session = normalizeSession(sessionSnap.id, sessionSnap.data());

  if (session.status === 'finished') return;

  const now = Timestamp.now();
  let { currentRound, questionIndex } = session;

  if (!isLastQuestionInRound(session)) {
    questionIndex += 1;
  } else if (!isLastRound(session)) {
    currentRound = nextRoundId(currentRound);
    questionIndex = 0;
  } else {
    await updateDoc(sessionRef(sessionId), {
      status: 'finished',
      finishedAt: serverTimestamp(),
      revealedAnswer: null,
    });
    return;
  }

  const roundConfig = OLYMPIA_ROUNDS[currentRound];
  const deadline = Timestamp.fromMillis(now.toMillis() + roundConfig.seconds * 1000);

  await updateDoc(sessionRef(sessionId), {
    status: 'playing',
    currentRound,
    questionIndex,
    roundStartedAt: now,
    questionDeadlineAt: deadline,
    revealedAnswer: null,
  });
}

export async function cancelOlympiaSession(sessionId) {
  await updateDoc(sessionRef(sessionId), {
    status: 'finished',
    finishedAt: serverTimestamp(),
  });
}

export async function joinOlympiaSession(sessionId, { studentId, studentName }) {
  const existing = await getDoc(participantRef(sessionId, studentId));
  if (existing.exists()) return;

  await setDoc(participantRef(sessionId, studentId), {
    studentName,
    joinedAt: serverTimestamp(),
    totalScore: 0,
    mountainStep: 0,
    peakAt: null,
    lastActiveAt: serverTimestamp(),
  });
}

export async function submitOlympiaResponse(
  sessionId,
  {
    studentId,
    studentName,
    round,
    questionIndex,
    questionId,
    selectedOption,
    finishChoice = null,
    roundStartedAt,
  },
) {
  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng thi.');
  const session = normalizeSession(sessionSnap.id, sessionSnap.data());

  if (session.status !== 'playing') throw new Error('Hiện không trong thời gian trả lời.');
  if (session.currentRound !== round || session.questionIndex !== questionIndex) {
    throw new Error('Câu hỏi đã thay đổi.');
  }

  const deadline = toDate(session.questionDeadlineAt);
  if (deadline && Date.now() > deadline.getTime() + 2000) {
    throw new Error('Đã hết thời gian trả lời.');
  }

  const respId = responseDocId(studentId, round, questionIndex);

  const started = toDate(roundStartedAt || session.roundStartedAt);
  const responseMs = started ? Math.max(0, Date.now() - started.getTime()) : 0;

  try {
    await setDoc(responseRef(sessionId, respId), {
      studentId,
      studentName,
      round,
      questionIndex,
      questionId,
      selectedOption: Number(selectedOption),
      finishChoice: finishChoice != null ? Number(finishChoice) : null,
      isCorrect: null,
      pointsEarned: 0,
      answeredAt: serverTimestamp(),
      responseMs,
    });
  } catch (err) {
    if (err?.code === 'permission-denied') {
      throw new Error('Bạn đã nộp câu này rồi.');
    }
    throw err;
  }
}

export function subscribeOlympiaSession(sessionId, onData, onError) {
  return onSnapshot(
    sessionRef(sessionId),
    (snap) => onData(snap.exists() ? normalizeSession(snap.id, snap.data()) : null),
    onError,
  );
}

export function subscribeActiveOlympiaForClass(classCode, onData, onError) {
  const q = query(
    sessionsRef(),
    where('classCode', '==', classCode),
    where('status', 'in', ACTIVE_SESSION_STATUSES),
  );
  return onSnapshot(
    q,
    (snap) => {
      const sessions = snap.docs.map((d) => normalizeSession(d.id, d.data()));
      sessions.sort((a, b) => {
        const ta = toDate(a.createdAt)?.getTime() || 0;
        const tb = toDate(b.createdAt)?.getTime() || 0;
        return tb - ta;
      });
      onData(sessions[0] || null);
    },
    onError,
  );
}

export function subscribeOlympiaParticipants(sessionId, onData, onError) {
  return onSnapshot(
    participantsRef(sessionId),
    (snap) => {
      const list = snap.docs
        .map((d) => normalizeParticipant(d.id, d.data()))
        .sort((a, b) => {
          if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
          const peakA = toDate(a.peakAt)?.getTime() || Infinity;
          const peakB = toDate(b.peakAt)?.getTime() || Infinity;
          return peakA - peakB;
        });
      onData(list);
    },
    onError,
  );
}

export function subscribeOlympiaResponses(sessionId, onData, onError) {
  return onSnapshot(
    responsesRef(sessionId),
    (snap) => {
      const list = snap.docs.map((d) => normalizeResponse(d.id, d.data()));
      onData(list);
    },
    onError,
  );
}

/** HS: chỉ theo dõi câu trả lời của chính mình (khi reveal/finished). */
export function subscribeOlympiaResponse(sessionId, responseId, onData, onError) {
  if (!sessionId || !responseId) return () => {};
  return onSnapshot(
    responseRef(sessionId, responseId),
    (snap) => onData(snap.exists() ? normalizeResponse(snap.id, snap.data()) : null),
    onError,
  );
}

export function getResponsesForQuestion(responses, round, questionIndex) {
  return responses.filter(
    (r) => r.round === round && r.questionIndex === questionIndex,
  );
}

export function rankParticipants(participants) {
  return [...participants].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    const peakA = toDate(a.peakAt)?.getTime() || Infinity;
    const peakB = toDate(b.peakAt)?.getTime() || Infinity;
    return peakA - peakB;
  });
}

export function getOlympiaPortalLink(classCode, sessionId) {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/c/${encodeURIComponent(classCode)}?olympia=${sessionId}`;
}

export function getRoundProgress(session) {
  const round = session?.currentRound;
  if (!round) return { current: 0, total: 0, roundLabel: '' };
  const total = getRoundQuestionCount(session, round);
  return {
    current: (session.questionIndex || 0) + 1,
    total,
    roundLabel: OLYMPIA_ROUNDS[round]?.label || round,
  };
}

export function getOverallProgress(session) {
  let done = 0;
  let total = 0;
  ROUND_ORDER.forEach((roundId) => {
    const count = getRoundQuestionCount(session, roundId);
    total += count;
  });
  ROUND_ORDER.forEach((roundId) => {
    const count = getRoundQuestionCount(session, roundId);
    if (roundId === session.currentRound) {
      done += session.questionIndex || 0;
      if (session.status === 'reveal') done += 1;
    } else if (ROUND_ORDER.indexOf(roundId) < ROUND_ORDER.indexOf(session.currentRound)) {
      done += count;
    } else if (session.status === 'finished') {
      done += count;
    }
  });
  return { done, total };
}
