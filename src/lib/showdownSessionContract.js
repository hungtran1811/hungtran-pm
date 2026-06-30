import { SHOWDOWN_ROUNDS, roundModeForRound } from './showdownConstants.js';
import { speedBonusForRank } from './showdownSpeedBonus.js';
import { toDate } from './firestore.js';

export function normalizeShowdownSession(id, data) {
  if (!data) return null;
  const currentRound = data.currentRound || 'startup';
  return {
    id,
    classCode: data.classCode || '',
    stateVersion: Number(data.stateVersion) || 0,
    status: data.status || 'draft',
    currentRound,
    questionIndex: Number(data.questionIndex) || 0,
    roundMode: data.roundMode || roundModeForRound(currentRound),
    activeStudentId: data.activeStudentId || null,
    activeStudentName: data.activeStudentName || null,
    startupQueue: Array.isArray(data.startupQueue) ? data.startupQueue : [],
    startupQueueIndex: Number(data.startupQueueIndex) || 0,
    finishQueue: Array.isArray(data.finishQueue) ? data.finishQueue : [],
    finishQueueIndex: Number(data.finishQueueIndex) || 0,
    finishStage: data.finishStage || null,
    finishQuestion: data.finishQuestion || null,
    finishChoice: data.finishChoice ?? null,
    roundStartedAt: data.roundStartedAt || null,
    serverStartedAt: data.serverStartedAt || null,
    questionDurationSeconds: Number(data.questionDurationSeconds) || 0,
    questionDeadlineAt: data.questionDeadlineAt || null,
    revealedAnswer: data.revealedAnswer ?? null,
    config: data.config || {},
    createdAt: data.createdAt || null,
    startedAt: data.startedAt || null,
    finishedAt: data.finishedAt || null,
  };
}

export function normalizeShowdownParticipant(id, data) {
  if (!data) return null;
  return {
    id,
    studentName: data.studentName || '',
    joinedAt: data.joinedAt || null,
    totalScore: Number(data.totalScore) || 0,
    lastActiveAt: data.lastActiveAt || null,
  };
}

export function normalizeShowdownResponse(id, data) {
  if (!data) return null;
  return {
    id,
    studentId: data.studentId || '',
    studentName: data.studentName || '',
    round: data.round || '',
    questionIndex: Number(data.questionIndex) || 0,
    questionId: data.questionId || '',
    selectedOption: data.selectedOption ?? null,
    textAnswer: data.textAnswer ?? null,
    finishChoice: data.finishChoice ?? null,
    isCorrect: data.isCorrect ?? null,
    pointsEarned: Number(data.pointsEarned) || 0,
    answeredAt: data.answeredAt || null,
    responseMs: Number(data.responseMs) || 0,
    gradedBy: data.gradedBy || null,
  };
}

export function resolveShowdownRoundSeconds(session, roundId) {
  const matrixRound = session?.config?.matrix?.rounds?.[roundId];
  const base = SHOWDOWN_ROUNDS[roundId];
  return matrixRound?.seconds ?? base?.seconds ?? 30;
}

export function resolveQuestionDeadlineMs(session) {
  if (!session) return 0;
  const dur = Number(session.questionDurationSeconds) || 0;
  const start = toDate(session.serverStartedAt);
  if (session.status === 'playing' && dur > 0) {
    if (!start) return 0;
    return start.getTime() + dur * 1000;
  }
  if (start && dur) return start.getTime() + dur * 1000;
  const fallback = toDate(session.questionDeadlineAt);
  return fallback ? fallback.getTime() : 0;
}

export function isShowdownTimerWaiting(session) {
  if (!session || session.status !== 'playing') return false;
  const dur = Number(session.questionDurationSeconds) || 0;
  return dur > 0 && !toDate(session.serverStartedAt);
}

export function pendingQuestionTimerFields(seconds) {
  return {
    questionDurationSeconds: seconds,
    serverStartedAt: null,
    questionDeadlineAt: null,
    roundStartedAt: null,
  };
}

export function computeShowdownPoints(session, round, isCorrect, finishChoice) {
  if (!isCorrect) return 0;
  const roundConfig = SHOWDOWN_ROUNDS[round];
  const matrixRound = session?.config?.matrix?.rounds?.[round];

  if (round === 'finish') {
    const choice = Number(finishChoice);
    return roundConfig.pointChoices.includes(choice) ? choice : 0;
  }

  return matrixRound?.points ?? roundConfig.basePoints ?? 10;
}

export function rankedShowdownSpeedBonus(rank, tiers) {
  return speedBonusForRank(rank, tiers);
}
