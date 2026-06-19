import { DEFAULT_SHOWDOWN_MATRIX } from '../data/showdownDefaultMatrix.js';
import { SHOWDOWN_SEED_BANK } from '../data/showdownSeedBank.js';
import {
  BANK_ROUND_MAP,
  ROUND_ORDER,
  SHOWDOWN_ROUNDS,
  normalizeDifficulty,
} from './showdownConstants.js';

/** Max oral questions kept in the startup pool (bounds session doc size). */
export const STARTUP_POOL_CAP = 151;

function roundFilters(matrix, roundId) {
  const roundConfig = SHOWDOWN_ROUNDS[roundId];
  const matrixRound = matrix.rounds?.[roundId] || {};
  const bankRound = BANK_ROUND_MAP[roundId] || roundId;
  return {
    count: matrixRound.count ?? roundConfig.count,
    bankRound,
    filters: {
      showdownRound: roundId,
      difficulties: matrixRound.difficulties || [],
      topics: matrixRound.topics || [],
      questionTypes: matrixRound.questionTypes || [],
    },
  };
}

export function getRoundBankPool(bank, roundId, matrix = DEFAULT_SHOWDOWN_MATRIX) {
  const { bankRound, filters, count } = roundFilters(matrix, roundId);

  let pool = bank.filter((q) => {
    const mappedRound = q.round === 'acceleration' ? 'obstacle' : q.round;
    if (mappedRound !== roundId && q.bankRound !== bankRound) return false;
    return matchesFilters({ ...q, round: mappedRound }, filters, bankRound);
  });

  if (pool.length < count) {
    const fallback = bank.filter((q) => {
      const mappedRound = q.round === 'acceleration' ? 'obstacle' : q.round;
      return mappedRound === roundId || q.bankRound === bankRound;
    });
    pool = [...new Map([...pool, ...fallback].map((q) => [q.id, q])).values()];
  }

  return pool;
}

function resolveSelectedFromPool(pool, selectedIds, usedIds) {
  if (!selectedIds?.length) return null;
  const poolIds = new Set(pool.map((q) => q.id));
  const picked = selectedIds
    .map((id) => pool.find((q) => q.id === id))
    .filter((q) => q && poolIds.has(q.id));
  picked.forEach((q) => usedIds.add(q.id));
  return picked;
}

export function pickRandomSessionSelection({
  matrix = DEFAULT_SHOWDOWN_MATRIX,
  bank = SHOWDOWN_SEED_BANK,
} = {}) {
  const built = buildSessionQuestionSet({ matrix, bank });
  return {
    startup: (built.publicQuestions.startup || []).map((q) => q.id),
    obstacle: (built.publicQuestions.obstacle || []).map((q) => q.id),
    finish: getRoundBankPool(bank, 'finish', matrix).map((q) => q.id),
  };
}

export function validateSessionQuestionSelection({
  matrix = DEFAULT_SHOWDOWN_MATRIX,
  selection,
  studentCount = 0,
} = {}) {
  const warnings = [];
  const errors = [];
  const startupCount = matrix.rounds?.startup?.count ?? SHOWDOWN_ROUNDS.startup.count;
  const obstacleCount = matrix.rounds?.obstacle?.count ?? SHOWDOWN_ROUNDS.obstacle.count;
  const startupLen = selection?.startup?.length || 0;
  const obstacleLen = selection?.obstacle?.length || 0;
  const finishLen = selection?.finish?.length || 0;

  if (startupLen < startupCount) {
    errors.push(`Vòng 1: pool cần ít nhất ${startupCount} câu (mỗi HS trả lời ${startupCount} câu).`);
  }
  if (studentCount > 0 && startupLen < startupCount * studentCount) {
    warnings.push(
      `Vòng 1: nên chọn ≥ ${startupCount * studentCount} câu để ${studentCount} HS có thể nhận bộ câu khác nhau.`,
    );
  }
  if (obstacleLen !== obstacleCount) {
    errors.push(`Vòng 2: chọn đúng ${obstacleCount} câu (hiện ${obstacleLen}).`);
  }
  if (finishLen < 1) {
    errors.push('Vòng 3: chọn ít nhất 1 câu về đích.');
  }

  return { errors, warnings, valid: errors.length === 0 };
}

export function buildSessionQuestionSet({
  matrix = DEFAULT_SHOWDOWN_MATRIX,
  bank = SHOWDOWN_SEED_BANK,
  selectedQuestionIds = null,
} = {}) {
  const usedIds = new Set();
  const publicQuestions = {};
  const answerKeys = {};
  const selection = selectedQuestionIds || {};

  ROUND_ORDER.forEach((roundId) => {
    const { count } = roundFilters(matrix, roundId);
    const pool = getRoundBankPool(bank, roundId, matrix);

    if (roundId === 'finish') {
      const finishIds = selection.finish;
      const keysSource = finishIds?.length
        ? finishIds.map((id) => pool.find((q) => q.id === id)).filter(Boolean)
        : pool;
      publicQuestions.finish = [];
      keysSource.forEach((q) => {
        answerKeys[q.id] = buildAnswerKey(q);
      });
      return;
    }

    const pickCount = roundId === 'startup'
      ? Math.min(STARTUP_POOL_CAP, Math.max(count, pool.length))
      : count;

    let picked = resolveSelectedFromPool(pool, selection[roundId], usedIds);
    if (!picked?.length) {
      picked = pickQuestions(pool, pickCount, usedIds);
    }

    publicQuestions[roundId] = picked.map(stripQuestionForPublic);
    picked.forEach((q) => {
      answerKeys[q.id] = buildAnswerKey(q);
    });
  });

  return {
    publicQuestions,
    answerKeys,
    matrixId: matrix.id,
    matrixName: matrix.name,
  };
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function matchesFilters(question, filters, bankRound) {
  const qRound = question.round || question.bankRound;
  const effectiveRound = qRound === 'acceleration' ? 'obstacle' : qRound;
  if (effectiveRound !== filters.showdownRound && question.bankRound !== bankRound) {
    if (question.round !== filters.showdownRound) return false;
  }
  if (filters.difficulties?.length && !filters.difficulties.includes(normalizeDifficulty(question.difficulty))) {
    return false;
  }
  if (filters.topics?.length && !filters.topics.includes(question.topic)) {
    return false;
  }
  if (filters.questionTypes?.length && !filters.questionTypes.includes(question.questionType)) {
    return false;
  }
  return true;
}

function pickQuestions(pool, count, usedIds) {
  const available = pool.filter((q) => !usedIds.has(q.id));
  const picked = shuffle(available.length >= count ? available : [...pool]).slice(0, count);
  picked.forEach((q) => usedIds.add(q.id));
  return picked;
}

export function stripQuestionForPublic(question) {
  return {
    id: question.id,
    prompt: question.prompt,
    code: question.codeSnippet || question.code || null,
    options: question.options ? [...question.options] : [],
    topic: question.topic,
    questionType: question.questionType,
    difficulty: normalizeDifficulty(question.difficulty),
    timeLimitSeconds: question.timeLimitSeconds,
    points: question.points,
    // Starter code is safe to expose; reference solution stays in the answer key.
    starterCode: question.questionType === 'code' ? question.starterCode || '' : null,
  };
}

export function buildAnswerKey(question) {
  if (question.questionType === 'code') {
    return { type: 'code', referenceSolution: question.referenceSolution || '' };
  }
  if (question.correctIndex != null && question.options?.length) {
    return { type: 'index', value: question.correctIndex };
  }
  if (question.correctAnswer != null) {
    return { type: 'text', value: String(question.correctAnswer).trim() };
  }
  return { type: 'oral', value: question.correctAnswer || '' };
}

export function normalizeTextAnswer(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/;$/, '')
    .replace(/^if\s+/, '')
    .replace(/:$/, '')
    .replace(/\s+/g, ' ');
}

function acceptableAnswers(correctAnswer) {
  return String(correctAnswer || '')
    .split(/\s*\/\s*|\s*\|\s*/)
    .map((part) => normalizeTextAnswer(part))
    .filter(Boolean);
}

export function isTextAnswerCorrect(studentAnswer, correctAnswer) {
  const normalized = normalizeTextAnswer(studentAnswer);
  if (!normalized) return false;
  const acceptable = acceptableAnswers(correctAnswer);
  if (!acceptable.length) return false;
  return acceptable.some((answer) => normalized === answer);
}

export function startupPerStudentCount(session) {
  return (
    session?.config?.matrix?.rounds?.startup?.count
    ?? SHOWDOWN_ROUNDS.startup?.count
    ?? 5
  );
}

/**
 * Build a per-student set of `perStudentCount` startup questions.
 * Deals from a single shuffled deck WITHOUT replacement so consecutive students
 * never get a question a previous student already answered (until the pool is
 * exhausted, at which point the deck reshuffles). With a 160-question pool and
 * 5 câu/HS this keeps ~30 students fully unique.
 */
export function buildStartupSets({ pool = [], perStudentCount = 5, participantIds = [] }) {
  const sets = {};
  if (!pool.length) {
    participantIds.forEach((id) => {
      sets[id] = [];
    });
    return sets;
  }
  let deck = shuffle(pool);
  let cursor = 0;
  participantIds.forEach((id) => {
    const set = [];
    for (let i = 0; i < perStudentCount; i += 1) {
      if (cursor >= deck.length) {
        deck = shuffle(pool);
        cursor = 0;
      }
      set.push(deck[cursor]);
      cursor += 1;
    }
    sets[id] = set;
  });
  return sets;
}

export function startupHasMoreStudents(session) {
  const queue = session?.startupQueue || [];
  return (session?.startupQueueIndex || 0) < queue.length - 1;
}

export function isLastStartupQuestionForStudent(session) {
  return (session?.questionIndex || 0) >= startupPerStudentCount(session) - 1;
}

export function getQuestionFromSession(session, round, questionIndex) {
  if (round === 'startup') {
    const set = session?.config?.startupSets?.[session?.activeStudentId];
    if (set && questionIndex >= 0 && questionIndex < set.length) return set[questionIndex];
    const pool = session?.config?.questions?.startup;
    if (pool && questionIndex >= 0 && questionIndex < pool.length) return pool[questionIndex];
    return null;
  }
  if (round === 'finish') {
    // Finish question is dealt per student after they pick a point package.
    return session?.finishQuestion || null;
  }
  const questions = session?.config?.questions?.[round];
  if (!questions || questionIndex < 0 || questionIndex >= questions.length) return null;
  return questions[questionIndex];
}

export function getRoundQuestionCount(session, round) {
  if (round === 'startup') return startupPerStudentCount(session);
  if (round === 'finish') return SHOWDOWN_ROUNDS.finish?.count ?? 1;
  return session?.config?.questions?.[round]?.length ?? SHOWDOWN_ROUNDS[round]?.count ?? 0;
}

export function isLastQuestionInRound(session) {
  const round = session.currentRound;
  const count = getRoundQuestionCount(session, round);
  return session.questionIndex >= count - 1;
}

export function isLastRound(session) {
  return session.currentRound === ROUND_ORDER[ROUND_ORDER.length - 1];
}

export function nextRoundId(currentRound) {
  const idx = ROUND_ORDER.indexOf(currentRound);
  if (idx < 0 || idx >= ROUND_ORDER.length - 1) return null;
  return ROUND_ORDER[idx + 1];
}

export function previewMatrixQuestions(matrix, bank = SHOWDOWN_SEED_BANK, selectedQuestionIds = null) {
  const result = buildSessionQuestionSet({ matrix, bank, selectedQuestionIds });

  return ROUND_ORDER.flatMap((roundId) => {
    const items = result.publicQuestions[roundId] || [];
    if (roundId === 'finish') return [];
    return items.map((q, index) => ({
      round: roundId,
      roundLabel: SHOWDOWN_ROUNDS[roundId].label,
      index: index + 1,
      ...q,
    }));
  });
}

/** Pick a FULL finish-round question matching the chosen point package's difficulty. */
export function pickFinishQuestionFull(session, finishChoice, { excludeIds = [] } = {}) {
  const matrix = session?.config?.matrix;
  const difficultyMap = matrix?.rounds?.finish?.difficultyMap
    || SHOWDOWN_ROUNDS.finish.difficultyMap;
  const targetDifficulty = difficultyMap?.[finishChoice] || 'medium';
  const bank = session?.config?.bankSnapshot || SHOWDOWN_SEED_BANK;
  const all = bank.filter(
    (q) => (q.round === 'finish' || q.bankRound === 'finish')
      && normalizeDifficulty(q.difficulty) === targetDifficulty,
  );
  if (!all.length) return null;
  const excluded = new Set(excludeIds);
  const fresh = all.filter((q) => !excluded.has(q.id));
  const pool = fresh.length ? fresh : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getFinishQuestionForChoice(session, finishChoice) {
  const full = pickFinishQuestionFull(session, finishChoice);
  return full ? stripQuestionForPublic(full) : null;
}

/** Split prompt text and embedded code for display. */
export function formatShowdownPromptForDisplay(prompt = '') {
  if (!prompt?.trim()) return { text: '', code: null };

  let text = prompt.trim();
  text = text.replace(/(?<=[^\n])(?=[A-D][.)]\s)/g, '\n');

  const codeMarkers = /(?:print|if |for |while |def |input|import |=)/;
  const splitPatterns = [
    /^(Tìm lỗi sai:|Dự đoán kết quả:|Đoạn code[^:]*:)([\s\S]+)$/i,
    /^(.*[?？])([\s\S]+)$/,
    /^(.*:)([\s\S]+)$/,
  ];

  for (const pattern of splitPatterns) {
    const match = text.match(pattern);
    if (match?.[2]?.trim() && codeMarkers.test(match[2])) {
      return { text: match[1].trim(), code: match[2].trim() };
    }
  }

  return { text, code: null };
}

/** Summary of curated question sets (admin picker / diagnostics). */
export function getSessionRoundPlan(session) {
  const matrix = session?.config?.matrix;
  const selected = session?.config?.selectedQuestionIds;
  const questions = session?.config?.questions || {};
  const startupPool = questions.startup?.length ?? selected?.startup?.length ?? 0;
  const obstacleLen = questions.obstacle?.length ?? selected?.obstacle?.length ?? 0;

  return {
    matrixName: session?.config?.matrixName || matrix?.name || 'Coding Showdown',
    startupPerStudent: startupPerStudentCount(session),
    startupPoolSize: startupPool,
    obstacleCount: obstacleLen,
    finishPerStudent: SHOWDOWN_ROUNDS.finish?.count ?? 1,
    curated: Boolean(
      selected?.startup?.length || selected?.obstacle?.length || selected?.finish?.length,
    ),
  };
}

const TOPIC_LABELS = {
  variables: 'Biến & kiểu dữ liệu',
  io: 'Input/Output',
  operators: 'Toán tử',
  conditionals: 'If/else',
  loops: 'Vòng lặp',
  lists: 'List',
  functions: 'Function',
  debug: 'Debug lỗi',
  output: 'Dự đoán output',
  strings: 'Chuỗi',
  custom: 'Tùy chỉnh',
};

const DIFFICULTY_LABELS = {
  easy: 'Dễ',
  medium: 'Trung bình',
  hard: 'Khó',
};

/** Display metadata for a question on stage / student UI. */
export function getQuestionDisplayMeta(question) {
  if (!question) return null;
  const diffKey = normalizeDifficulty(question.difficulty);
  return {
    id: question.id || null,
    topic: TOPIC_LABELS[question.topic] || question.topic || null,
    difficulty: DIFFICULTY_LABELS[diffKey] || question.difficulty || null,
  };
}
