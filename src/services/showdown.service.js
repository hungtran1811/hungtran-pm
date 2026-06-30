import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
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
import { DEFAULT_SHOWDOWN_MATRIX } from '../data/showdownDefaultMatrix.js';
import { SHOWDOWN_SEED_BANK } from '../data/showdownSeedBank.js';
import {
  ACTIVE_SESSION_STATUSES,
  ROUND_ORDER,
  SHOWDOWN_ROUNDS,
  responseDocId,
  roundLabel,
  roundModeForRound,
} from '../lib/showdownConstants.js';
import { hasSpeedBonus, resolveSpeedBonusTiers } from '../lib/showdownSpeedBonus.js';
import {
  buildSessionQuestionSet,
  buildStartupSets,
  getQuestionFromSession,
  getRoundQuestionCount,
  isLastQuestionInRound,
  isLastRound,
  isTextAnswerCorrect,
  nextRoundId,
  pickFinishQuestionFull,
  startupHasMoreStudents,
  startupPerStudentCount,
  stripQuestionForPublic,
} from '../lib/showdownQuestionEngine.js';
import {
  computeShowdownPoints as computePoints,
  isShowdownTimerWaiting,
  normalizeShowdownParticipant as normalizeParticipant,
  normalizeShowdownResponse as normalizeResponse,
  normalizeShowdownSession as normalizeSession,
  pendingQuestionTimerFields,
  rankedShowdownSpeedBonus as rankedSpeedBonus,
  resolveQuestionDeadlineMs,
  resolveShowdownRoundSeconds as roundSeconds,
} from '../lib/showdownSessionContract.js';
import { toDate } from '../lib/firestore.js';

export { isShowdownTimerWaiting, resolveQuestionDeadlineMs };

const SESSIONS = 'showdownSessions';
const ANSWER_KEYS = 'showdownAnswerKeys';

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

function classDocRef(classCode) {
  return doc(db, 'classes', classCode);
}

// Public students can't run a `list` query on showdownSessions (rules allow
// single-doc reads only). So we mirror the active session id onto the class doc
// (already publicly readable) and let students follow it by id.
async function setClassActiveShowdownPointer(classCode, sessionId) {
  if (!classCode) return;
  try {
    await updateDoc(classDocRef(classCode), { activeShowdownSessionId: sessionId });
  } catch (error) {
    console.warn('[showdown.service] Failed to set class active session pointer', error);
  }
}

async function clearClassActiveShowdownPointer(classCode, sessionId) {
  if (!classCode) return;
  try {
    const snap = await getDoc(classDocRef(classCode));
    if (snap.exists() && snap.data().activeShowdownSessionId === sessionId) {
      await updateDoc(classDocRef(classCode), { activeShowdownSessionId: null });
    }
  } catch (error) {
    console.warn('[showdown.service] Failed to clear class active session pointer', error);
  }
}

/** Attach an atomic stateVersion bump to every session state transition. */
function sessionBump(fields = {}) {
  return { ...fields, stateVersion: increment(1) };
}

async function getAnswerKeys(sessionId) {
  const snap = await getDoc(answerKeysRef(sessionId));
  return snap.exists() ? snap.data().keys || {} : {};
}

function checkAnswer(answerKey, { selectedOption, textAnswer }) {
  if (!answerKey) return false;
  if (answerKey.type === 'index') {
    return Number(selectedOption) === Number(answerKey.value);
  }
  if (answerKey.type === 'text') {
    return isTextAnswerCorrect(textAnswer, answerKey.value);
  }
  return false;
}

async function addParticipantScore(sessionId, studentId, addScore) {
  if (!addScore) return;
  const partSnap = await getDoc(participantRef(sessionId, studentId));
  if (!partSnap.exists()) return;
  const current = partSnap.data();
  await updateDoc(participantRef(sessionId, studentId), {
    totalScore: (Number(current.totalScore) || 0) + addScore,
    lastActiveAt: serverTimestamp(),
  });
}

export async function createShowdownSession({
  classCode,
  matrix = DEFAULT_SHOWDOWN_MATRIX,
  bank = SHOWDOWN_SEED_BANK,
  speedBonusEnabled = true,
  selectedQuestionIds = null,
}) {
  const { publicQuestions, answerKeys, matrixId, matrixName } = buildSessionQuestionSet({
    matrix,
    bank,
    selectedQuestionIds,
  });

  const finishIds = selectedQuestionIds?.finish;
  const finishBank = bank.filter((q) => q.round === 'finish' || q.bankRound === 'finish');
  const bankSnapshot = finishIds?.length
    ? finishBank.filter((q) => finishIds.includes(q.id))
    : finishBank;

  const sessionDoc = await addDoc(sessionsRef(), {
    classCode,
    status: 'draft',
    currentRound: 'startup',
    questionIndex: 0,
    roundMode: roundModeForRound('startup'),
    activeStudentId: null,
    activeStudentName: null,
    startupQueue: [],
    startupQueueIndex: 0,
    finishQueue: [],
    finishQueueIndex: 0,
    roundStartedAt: null,
    questionDeadlineAt: null,
    revealedAnswer: null,
    config: {
      matrixId,
      matrixName,
      matrix,
      speedBonusEnabled,
      questions: publicQuestions,
      selectedQuestionIds: selectedQuestionIds || null,
      // Only finish-round questions are needed at runtime (per-student point
      // packages are drawn from here), keeping the session doc small.
      bankSnapshot,
    },
    stateVersion: 0,
    createdAt: serverTimestamp(),
    startedAt: null,
    finishedAt: null,
  });

  await setDoc(answerKeysRef(sessionDoc.id), { keys: answerKeys });

  return sessionDoc.id;
}

export async function openShowdownLobby(sessionId) {
  const snap = await getDoc(sessionRef(sessionId));
  await updateDoc(sessionRef(sessionId), sessionBump({ status: 'lobby' }));
  if (snap.exists()) {
    await setClassActiveShowdownPointer(snap.data().classCode, sessionId);
  }
}

/** Keep the class-doc pointer in sync with the session status (admin self-heal). */
export async function syncShowdownClassPointer(sessionId) {
  const snap = await getDoc(sessionRef(sessionId));
  if (!snap.exists()) return;
  const data = snap.data();
  if (['lobby', 'playing', 'reveal'].includes(data.status)) {
    await setClassActiveShowdownPointer(data.classCode, sessionId);
  } else {
    await clearClassActiveShowdownPointer(data.classCode, sessionId);
  }
}

export async function startShowdownGame(sessionId) {
  const now = Timestamp.now();
  const sessionSnap = await getDoc(sessionRef(sessionId));
  const session = normalizeSession(sessionSnap.id, sessionSnap.data());
  const seconds = roundSeconds(session, 'startup');

  const participantsSnap = await getDocs(participantsRef(sessionId));
  const participants = participantsSnap.docs.map((d) => ({
    id: d.id,
    studentName: d.data().studentName || '',
  }));
  const startupQueue = participants.map((p) => p.id).sort(() => Math.random() - 0.5);

  const pool = session.config?.questions?.startup || [];
  const perStudentCount = startupPerStudentCount(session);
  const startupSets = buildStartupSets({
    pool,
    perStudentCount,
    participantIds: startupQueue,
  });

  const firstId = startupQueue[0] || null;
  const firstName = participants.find((p) => p.id === firstId)?.studentName || null;

  await updateDoc(sessionRef(sessionId), sessionBump({
    status: 'playing',
    currentRound: 'startup',
    questionIndex: 0,
    roundMode: 'oral',
    activeStudentId: firstId,
    activeStudentName: firstName,
    startupQueue,
    startupQueueIndex: 0,
    'config.startupSets': startupSets,
    ...pendingQuestionTimerFields(seconds),
    revealedAnswer: null,
    startedAt: now,
  }));
}

export async function startShowdownQuestionTimer(sessionId) {
  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phiên chơi.');
  const session = normalizeSession(sessionSnap.id, sessionSnap.data());
  if (session.status !== 'playing') throw new Error('Không trong thời gian trả lời.');
  const seconds = Number(session.questionDurationSeconds) || 0;
  if (seconds <= 0) throw new Error('Câu hỏi này không có thời gian.');
  if (toDate(session.serverStartedAt)) throw new Error('Đồng hồ đã chạy.');

  const now = Timestamp.now();
  await updateDoc(sessionRef(sessionId), sessionBump({
    serverStartedAt: serverTimestamp(),
    roundStartedAt: now,
    questionDeadlineAt: Timestamp.fromMillis(now.toMillis() + seconds * 1000),
  }));
}

export async function setActiveStudent(sessionId, { studentId, studentName }) {
  await updateDoc(sessionRef(sessionId), sessionBump({
    activeStudentId: studentId || null,
    activeStudentName: studentName || null,
  }));
}

export async function gradeOralQuestion(sessionId, outcome) {
  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phiên chơi.');
  const session = normalizeSession(sessionSnap.id, sessionSnap.data());

  if (session.status !== 'playing' || session.roundMode !== 'oral') {
    throw new Error('Không trong vòng vấn đáp.');
  }

  const round = session.currentRound;
  const questionIndex = session.questionIndex;
  const question = getQuestionFromSession(session, round, questionIndex);
  if (!question) throw new Error('Không tìm thấy câu hỏi.');

  const studentId = session.activeStudentId;
  const studentName = session.activeStudentName;
  let pointsEarned = 0;
  let isCorrect = null;

  if (outcome === 'correct' && studentId) {
    isCorrect = true;
    pointsEarned = session.config?.matrix?.rounds?.startup?.points
      ?? SHOWDOWN_ROUNDS.startup.basePoints;
    await addParticipantScore(sessionId, studentId, pointsEarned);

    const respId = responseDocId(studentId, round, questionIndex);
    await setDoc(responseRef(sessionId, respId), {
      studentId,
      studentName,
      round,
      questionIndex,
      questionId: question.id,
      selectedOption: null,
      textAnswer: null,
      finishChoice: null,
      isCorrect: true,
      pointsEarned,
      answeredAt: serverTimestamp(),
      responseMs: 0,
      gradedBy: 'teacher',
    }, { merge: true });
  } else if (outcome === 'wrong' && studentId) {
    isCorrect = false;
    const respId = responseDocId(studentId, round, questionIndex);
    await setDoc(responseRef(sessionId, respId), {
      studentId,
      studentName,
      round,
      questionIndex,
      questionId: question.id,
      selectedOption: null,
      textAnswer: null,
      finishChoice: null,
      isCorrect: false,
      pointsEarned: 0,
      answeredAt: serverTimestamp(),
      responseMs: 0,
      gradedBy: 'teacher',
    }, { merge: true });
  }

  const answerKeys = await getAnswerKeys(sessionId);
  const key = answerKeys[question.id];

  let correctText = '';
  if (key?.type === 'index') {
    correctText = question.options?.[key.value] ?? String(key.value);
  } else if (key?.type === 'text') {
    correctText = Array.isArray(key.value) ? key.value.join(' / ') : String(key.value ?? '');
  } else if (key?.value != null) {
    correctText = String(key.value);
  }

  await updateDoc(sessionRef(sessionId), sessionBump({
    status: 'reveal',
    revealedAnswer: {
      questionId: question.id,
      correctIndex: key?.type === 'index' ? key.value : null,
      correctText,
      round,
      questionIndex,
      oralOutcome: outcome,
      activeStudentId: studentId,
      activeStudentName: studentName,
      pointsEarned,
      isCorrect,
    },
  }));
}

export async function gradeCurrentQuestion(sessionId) {
  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phiên chơi.');
  const session = normalizeSession(sessionSnap.id, sessionSnap.data());

  if (session.roundMode === 'oral') {
    throw new Error('Vòng vấn đáp dùng nút Đúng/Sai/Bỏ qua.');
  }

  const round = session.currentRound;
  const questionIndex = session.questionIndex;
  const question = getQuestionFromSession(session, round, questionIndex);
  if (!question) throw new Error('Không tìm thấy câu hỏi.');

  const answerKeys = await getAnswerKeys(sessionId);
  const answerKey = answerKeys[question.id];
  if (!answerKey) throw new Error('Thiếu đáp án cho câu hỏi.');

  const responsesSnap = await getDocs(responsesRef(sessionId));
  const batch = writeBatch(db);
  const participantUpdates = new Map();

  // First pass: grade + collect this question's ungraded responses.
  const records = [];
  responsesSnap.docs.forEach((respDoc) => {
    const data = respDoc.data();
    if (data.round !== round || Number(data.questionIndex) !== questionIndex) return;
    if (data.isCorrect !== null && data.isCorrect !== undefined) return;

    const isCorrect = checkAnswer(answerKey, data);
    records.push({
      ref: respDoc.ref,
      studentId: data.studentId,
      isCorrect,
      responseMs: Number(data.responseMs) || 0,
      basePoints: computePoints(session, round, isCorrect, data.finishChoice),
    });
  });

  // Rank correct answers by speed to award a tapering speed bonus (obstacle).
  const matrixRound = session.config?.matrix?.rounds?.[round];
  const speedBonusEnabled = session.config?.speedBonusEnabled !== false;
  const speedBonusTiers = resolveSpeedBonusTiers(matrixRound);
  const rankedCorrect = records
    .filter((r) => r.isCorrect)
    .sort((a, b) => a.responseMs - b.responseMs);
  const bonusByStudent = new Map();
  if (round === 'obstacle' && speedBonusEnabled && hasSpeedBonus(speedBonusTiers)) {
    rankedCorrect.forEach((r, rank) => {
      bonusByStudent.set(r.studentId, rankedSpeedBonus(rank, speedBonusTiers));
    });
  }

  records.forEach((r) => {
    const bonus = bonusByStudent.get(r.studentId) || 0;
    const pointsEarned = r.basePoints + (r.isCorrect ? bonus : 0);
    batch.update(r.ref, { isCorrect: r.isCorrect, pointsEarned });
    const prev = participantUpdates.get(r.studentId) || { addScore: 0 };
    prev.addScore += pointsEarned;
    participantUpdates.set(r.studentId, prev);
  });

  const participantsSnap = await getDocs(participantsRef(sessionId));
  participantsSnap.docs.forEach((partDoc) => {
    const delta = participantUpdates.get(partDoc.id);
    if (!delta) return;
    const current = partDoc.data();
    batch.update(partDoc.ref, {
      totalScore: (Number(current.totalScore) || 0) + delta.addScore,
      lastActiveAt: serverTimestamp(),
    });
  });

  await batch.commit();

  await updateDoc(sessionRef(sessionId), sessionBump({
    status: 'reveal',
    revealedAnswer: {
      questionId: question.id,
      correctIndex: answerKey.type === 'index' ? answerKey.value : null,
      correctText: answerKey.type === 'text' ? answerKey.value : '',
      round,
      questionIndex,
    },
  }));
}

/** Manually grade a single code submission (teacher Đúng/Sai). Supports re-grading. */
export async function gradeShowdownCodeResponse(sessionId, studentId, isCorrect) {
  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phiên chơi.');
  const session = normalizeSession(sessionSnap.id, sessionSnap.data());

  const round = session.currentRound;
  const questionIndex = session.questionIndex;
  const respId = responseDocId(studentId, round, questionIndex);
  const respSnap = await getDoc(responseRef(sessionId, respId));
  if (!respSnap.exists()) throw new Error('Học sinh chưa nộp code.');

  const data = respSnap.data();
  const points = computePoints(session, round, !!isCorrect, data.finishChoice);
  const prevPoints = Number(data.pointsEarned) || 0;
  const delta = points - prevPoints;

  await updateDoc(responseRef(sessionId, respId), {
    isCorrect: !!isCorrect,
    pointsEarned: points,
    gradedBy: 'teacher',
  });
  if (delta) await addParticipantScore(sessionId, studentId, delta);
}

/** Finish grading a code question and reveal (optionally exposing the reference solution). */
export async function finalizeCodeQuestion(sessionId) {
  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phiên chơi.');
  const session = normalizeSession(sessionSnap.id, sessionSnap.data());

  const round = session.currentRound;
  const questionIndex = session.questionIndex;
  const question = getQuestionFromSession(session, round, questionIndex);
  if (!question) throw new Error('Không tìm thấy câu hỏi.');

  const answerKeys = await getAnswerKeys(sessionId);
  const key = answerKeys[question.id];

  await updateDoc(sessionRef(sessionId), sessionBump({
    status: 'reveal',
    revealedAnswer: {
      questionId: question.id,
      correctIndex: null,
      correctText: '',
      referenceSolution: key?.referenceSolution || '',
      round,
      questionIndex,
    },
  }));
}

export async function advanceShowdownQuestion(sessionId) {
  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phiên chơi.');
  const session = normalizeSession(sessionSnap.id, sessionSnap.data());

  if (session.status === 'finished') return;

  // Round 1: per-student oral queue (each student answers their own set).
  if (session.currentRound === 'startup') {
    const perStudentCount = startupPerStudentCount(session);
    const startupQueue = session.startupQueue || [];

    if (session.questionIndex < perStudentCount - 1) {
      const seconds = roundSeconds(session, 'startup');
      await updateDoc(sessionRef(sessionId), sessionBump({
        status: 'playing',
        questionIndex: session.questionIndex + 1,
        ...pendingQuestionTimerFields(seconds),
        revealedAnswer: null,
      }));
      return;
    }

    if (startupHasMoreStudents(session)) {
      const nextIndex = (session.startupQueueIndex || 0) + 1;
      const nextId = startupQueue[nextIndex];
      const partSnap = await getDoc(participantRef(sessionId, nextId));
      const seconds = roundSeconds(session, 'startup');
      await updateDoc(sessionRef(sessionId), sessionBump({
        status: 'playing',
        startupQueueIndex: nextIndex,
        activeStudentId: nextId,
        activeStudentName: partSnap.exists() ? partSnap.data().studentName : '',
        questionIndex: 0,
        ...pendingQuestionTimerFields(seconds),
        revealedAnswer: null,
      }));
      return;
    }

    // All students done -> move to round 2 (obstacle).
    const obstacleSeconds = roundSeconds(session, 'obstacle');
    await updateDoc(sessionRef(sessionId), sessionBump({
      status: 'playing',
      currentRound: 'obstacle',
      questionIndex: 0,
      roundMode: roundModeForRound('obstacle'),
      activeStudentId: null,
      activeStudentName: null,
      ...pendingQuestionTimerFields(obstacleSeconds),
      revealedAnswer: null,
    }));
    return;
  }

  let { currentRound, questionIndex } = session;

  if (!isLastQuestionInRound(session)) {
    questionIndex += 1;
  } else if (!isLastRound(session)) {
    currentRound = nextRoundId(currentRound);
    questionIndex = 0;
  } else {
    await updateDoc(sessionRef(sessionId), sessionBump({
      status: 'finished',
      finishedAt: serverTimestamp(),
      revealedAnswer: null,
      activeStudentId: null,
      activeStudentName: null,
    }));
    await clearClassActiveShowdownPointer(session.classCode, sessionId);
    return;
  }

  const mode = roundModeForRound(currentRound);
  const seconds = roundSeconds(session, currentRound);
  const updates = {
    status: 'playing',
    currentRound,
    questionIndex,
    roundMode: mode,
    ...pendingQuestionTimerFields(seconds),
    revealedAnswer: null,
  };

  if (mode === 'oral') {
    updates.activeStudentId = null;
    updates.activeStudentName = null;
  }

  if (currentRound === 'finish' && questionIndex === 0) {
    const participantsSnap = await getDocs(participantsRef(sessionId));
    const queue = participantsSnap.docs
      .map((d) => d.id)
      .sort(() => Math.random() - 0.5);
    updates.finishQueue = queue;
    updates.finishQueueIndex = 0;
    if (queue.length) {
      const first = participantsSnap.docs.find((d) => d.id === queue[0]);
      updates.activeStudentId = queue[0];
      updates.activeStudentName = first?.data()?.studentName || '';
    }
    // Enter the package-choosing stage: no question/countdown until the
    // teacher deals the package the student picked.
    updates.finishStage = 'choosing';
    updates.finishQuestion = null;
    updates.finishChoice = null;
    updates.serverStartedAt = null;
    updates.questionDurationSeconds = 0;
    updates.questionDeadlineAt = null;
  }

  await updateDoc(sessionRef(sessionId), sessionBump(updates));
}

/**
 * Teacher deals a finish question for the active student's chosen point package.
 * 10đ → câu Dễ, 20đ → TB, 30đ → Khó (mỗi gói một câu khác nhau). Countdown
 * starts now so the presentation/student timers are anchored to the deal.
 */
export async function dealFinishQuestion(sessionId, finishChoice) {
  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phiên chơi.');
  const session = normalizeSession(sessionSnap.id, sessionSnap.data());
  if (session.currentRound !== 'finish') throw new Error('Chưa tới vòng Về đích.');
  if (!session.activeStudentId) throw new Error('Chưa có học sinh ở lượt về đích.');

  const choice = Number(finishChoice);
  const full = pickFinishQuestionFull(session, choice);
  if (!full) throw new Error('Không tìm thấy câu hỏi phù hợp cho gói điểm này.');

  const publicQuestion = stripQuestionForPublic(full);
  const seconds = full.timeLimitSeconds ?? roundSeconds(session, 'finish');

  // Store the reference solution in the (admin-only) answer key, not on the
  // session doc which students can read.
  await updateDoc(answerKeysRef(sessionId), {
    [`keys.${full.id}`]: { type: 'code', referenceSolution: full.referenceSolution || '' },
  });

  await updateDoc(sessionRef(sessionId), sessionBump({
    status: 'playing',
    finishStage: 'answering',
    finishChoice: choice,
    finishQuestion: publicQuestion,
    ...pendingQuestionTimerFields(seconds),
    revealedAnswer: null,
  }));
}

export async function initFinishQueue(sessionId) {
  const participantsSnap = await getDocs(participantsRef(sessionId));
  const queue = participantsSnap.docs.map((d) => d.id).sort(() => Math.random() - 0.5);
  const first = queue[0] ? participantsSnap.docs.find((d) => d.id === queue[0]) : null;
  await updateDoc(sessionRef(sessionId), sessionBump({
    finishQueue: queue,
    finishQueueIndex: 0,
    activeStudentId: queue[0] || null,
    activeStudentName: first?.data()?.studentName || null,
  }));
}

export async function advanceFinishTurn(sessionId) {
  const sessionSnap = await getDoc(sessionRef(sessionId));
  const session = normalizeSession(sessionSnap.id, sessionSnap.data());
  const queue = session.finishQueue || [];
  const nextIndex = (session.finishQueueIndex || 0) + 1;
  if (nextIndex >= queue.length) {
    await advanceShowdownQuestion(sessionId);
    return;
  }
  const nextId = queue[nextIndex];
  const partSnap = await getDoc(participantRef(sessionId, nextId));
  await updateDoc(sessionRef(sessionId), sessionBump({
    finishQueueIndex: nextIndex,
    activeStudentId: nextId,
    activeStudentName: partSnap.exists() ? partSnap.data().studentName : '',
    status: 'playing',
    finishStage: 'choosing',
    finishQuestion: null,
    finishChoice: null,
    serverStartedAt: null,
    questionDurationSeconds: 0,
    questionDeadlineAt: null,
    revealedAnswer: null,
  }));
}

export async function cancelShowdownSession(sessionId) {
  const snap = await getDoc(sessionRef(sessionId));
  await updateDoc(sessionRef(sessionId), sessionBump({
    status: 'finished',
    finishedAt: serverTimestamp(),
  }));
  if (snap.exists()) {
    await clearClassActiveShowdownPointer(snap.data().classCode, sessionId);
  }
}

export async function fetchShowdownSession(sessionId) {
  const snap = await getDoc(sessionRef(sessionId));
  if (!snap.exists()) return null;
  return normalizeSession(snap.id, snap.data());
}

export async function joinShowdownSession(sessionId, { studentId, studentName }) {
  const existing = await getDoc(participantRef(sessionId, studentId));
  if (existing.exists()) return;

  await setDoc(participantRef(sessionId, studentId), {
    studentName,
    joinedAt: serverTimestamp(),
    totalScore: 0,
    lastActiveAt: serverTimestamp(),
  });
}

export async function submitShowdownResponse(
  sessionId,
  {
    studentId,
    studentName,
    round,
    questionIndex,
    questionId,
    selectedOption = null,
    textAnswer = null,
    finishChoice = null,
    roundStartedAt,
  },
) {
  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phiên chơi.');
  const session = normalizeSession(sessionSnap.id, sessionSnap.data());

  if (session.roundMode === 'oral') {
    throw new Error('Vòng vấn đáp không nộp trên thiết bị.');
  }
  if (session.status !== 'playing') throw new Error('Hiện không trong thời gian trả lời.');
  if (session.currentRound !== round || session.questionIndex !== questionIndex) {
    throw new Error('Câu hỏi đã thay đổi.');
  }

  if (round === 'finish' && session.activeStudentId && session.activeStudentId !== studentId) {
    throw new Error('Chưa đến lượt bạn.');
  }

  const dur = Number(session.questionDurationSeconds) || 0;
  if (dur > 0 && !toDate(session.serverStartedAt)) {
    throw new Error('Chưa bắt đầu đếm giờ.');
  }

  const deadlineMs = resolveQuestionDeadlineMs(session);
  if (deadlineMs > 0 && Date.now() > deadlineMs + 2000) {
    throw new Error('Đã hết thời gian trả lời.');
  }

  const respId = responseDocId(studentId, round, questionIndex);
  const started = toDate(session.roundStartedAt);
  const responseMs = started ? Math.max(0, Date.now() - started.getTime()) : 0;

  const payload = {
    studentId,
    studentName,
    round,
    questionIndex,
    questionId,
    selectedOption: selectedOption != null ? Number(selectedOption) : null,
    textAnswer: textAnswer != null ? String(textAnswer) : null,
    finishChoice: finishChoice != null ? Number(finishChoice) : null,
    isCorrect: null,
    pointsEarned: 0,
    answeredAt: serverTimestamp(),
    responseMs,
    gradedBy: null,
  };

  try {
    await setDoc(responseRef(sessionId, respId), payload);
  } catch (err) {
    if (err?.code === 'permission-denied') {
      throw new Error('Bạn đã nộp câu này rồi.');
    }
    throw err;
  }
}

export function subscribeShowdownSession(sessionId, onData, onError) {
  return onSnapshot(
    sessionRef(sessionId),
    (snap) => onData(snap.exists() ? normalizeSession(snap.id, snap.data()) : null),
    onError,
  );
}

export function subscribeActiveShowdownForClass(classCode, onData, onError) {
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

export function subscribeShowdownParticipants(sessionId, onData, onError) {
  return onSnapshot(
    participantsRef(sessionId),
    (snap) => {
      const list = rankParticipants(snap.docs.map((d) => normalizeParticipant(d.id, d.data())));
      onData(list);
    },
    onError,
  );
}

export function subscribeShowdownResponses(sessionId, onData, onError) {
  return onSnapshot(
    responsesRef(sessionId),
    (snap) => {
      const list = snap.docs.map((d) => normalizeResponse(d.id, d.data()));
      onData(list);
    },
    onError,
  );
}

export function subscribeShowdownResponse(sessionId, responseId, onData, onError) {
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
    const joinA = toDate(a.joinedAt)?.getTime() || Infinity;
    const joinB = toDate(b.joinedAt)?.getTime() || Infinity;
    if (joinA !== joinB) return joinA - joinB;
    return (a.studentName || '').localeCompare(b.studentName || '', 'vi');
  });
}

/** Assign display ranks with ties sharing the same place. */
export function assignParticipantRanks(participants) {
  const sorted = rankParticipants(participants);
  let prevScore = null;
  let prevRank = 0;
  return sorted.map((p, index) => {
    const rank = prevScore !== null && p.totalScore === prevScore ? prevRank : index + 1;
    prevRank = rank;
    prevScore = p.totalScore;
    return { ...p, rank };
  });
}

function publicBaseUrl() {
  const configured = import.meta.env?.VITE_PUBLIC_BASE_URL;
  if (configured) return String(configured).replace(/\/$/, '');
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export function getShowdownPortalLink(classCode, sessionId) {
  return `${publicBaseUrl()}/c/${encodeURIComponent(classCode)}?showdown=${sessionId}`;
}

export function getShowdownPresentLink(sessionId) {
  return `${publicBaseUrl()}/present/${sessionId}`;
}

export function getRoundProgress(session) {
  const round = session?.currentRound;
  if (!round) return { current: 0, total: 0, roundLabel: '' };
  const total = getRoundQuestionCount(session, round);
  const progress = {
    current: (session.questionIndex || 0) + 1,
    total,
    roundLabel: roundLabel(round),
  };
  if (round === 'startup' && Array.isArray(session.startupQueue) && session.startupQueue.length) {
    progress.studentIndex = (session.startupQueueIndex || 0) + 1;
    progress.studentTotal = session.startupQueue.length;
  }
  return progress;
}

export async function getShowdownSessionResults(sessionId) {
  const snap = await getDocs(participantsRef(sessionId));
  return rankParticipants(
    snap.docs.map((d) => normalizeParticipant(d.id, d.data())),
  );
}

export function listFinishedSessions(classCode) {
  const q = query(
    sessionsRef(),
    where('classCode', '==', classCode),
    where('status', '==', 'finished'),
  );
  return getDocs(q).then((snap) =>
    snap.docs
      .map((d) => normalizeSession(d.id, d.data()))
      .sort((a, b) => (toDate(b.finishedAt)?.getTime() || 0) - (toDate(a.finishedAt)?.getTime() || 0)),
  );
}

export { normalizeSession, normalizeParticipant, normalizeResponse };
