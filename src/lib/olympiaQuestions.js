import { OLYMPIA_BANK_BY_ID, OLYMPIA_PYTHON_BANK } from '../data/olympiaPythonBank.js';
import { OLYMPIA_PACK_BY_ID } from '../data/olympiaPresetPacks.js';
import { OLYMPIA_ROUNDS, ROUND_ORDER } from './olympiaConstants.js';

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function stripQuestionForPublic(question) {
  return {
    id: question.id,
    prompt: question.prompt,
    code: question.code || null,
    options: [...question.options],
    topic: question.topic,
  };
}

export function normalizeCustomQuestion(raw, index) {
  const options = (raw.options || []).map((o) => String(o).trim()).filter(Boolean);
  const correctIndex = Number(raw.correctIndex);
  if (options.length < 2 || !Number.isFinite(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
    return null;
  }
  const round = raw.round || 'startup';
  if (!OLYMPIA_ROUNDS[round]) return null;
  return {
    id: raw.id || `custom-${round}-${index}-${Date.now()}`,
    topic: 'custom',
    round,
    difficulty: Number(raw.difficulty) || 2,
    prompt: String(raw.prompt || '').trim(),
    code: raw.code ? String(raw.code).trim() : null,
    options,
    correctIndex,
    isCustom: true,
  };
}

function pickFromBankByPack(round, packId, count, usedIds) {
  let pool = OLYMPIA_PYTHON_BANK.filter(
    (q) => q.round === round && q.packIds?.includes(packId) && !usedIds.has(q.id),
  );
  if (pool.length < count) {
    const extra = OLYMPIA_PYTHON_BANK.filter(
      (q) => q.round === round && !usedIds.has(q.id),
    );
    pool = [...pool, ...extra];
  }
  const picked = shuffle(pool).slice(0, count);
  picked.forEach((q) => usedIds.add(q.id));
  return picked;
}

function pickFromBankByTopics(round, topics, count, usedIds) {
  let pool = OLYMPIA_PYTHON_BANK.filter(
    (q) => q.round === round && topics.includes(q.topic) && !usedIds.has(q.id),
  );
  if (pool.length < count) {
    const extra = OLYMPIA_PYTHON_BANK.filter(
      (q) => q.round === round && !topics.includes(q.topic) && !usedIds.has(q.id),
    );
    pool = [...pool, ...extra];
  }
  const picked = shuffle(pool).slice(0, count);
  picked.forEach((q) => usedIds.add(q.id));
  return picked;
}

function resolveQuestionsByIds(ids) {
  return ids.map((id) => OLYMPIA_BANK_BY_ID[id]).filter(Boolean);
}

function mergeCustomForRound(customQuestions, round, maxCustom = 2) {
  return customQuestions.filter((q) => q.round === round).slice(0, maxCustom);
}

function applyCustomOverrides(bankQuestions, customForRound, roundCount) {
  if (!customForRound.length) return bankQuestions.slice(0, roundCount);
  const base = bankQuestions.slice(0, Math.max(0, roundCount - customForRound.length));
  return [...base, ...customForRound].slice(0, roundCount);
}

function buildFromPresetPack(packId, customQuestions) {
  const pack = OLYMPIA_PACK_BY_ID[packId];
  if (!pack) return null;

  const normalizedCustom = customQuestions
    .map((q, i) => normalizeCustomQuestion(q, i))
    .filter(Boolean);

  const publicQuestions = {};
  const answerKeys = {};
  const usedIds = new Set();

  ROUND_ORDER.forEach((roundId) => {
    const roundConfig = OLYMPIA_ROUNDS[roundId];
    const presetIds = pack.questions[roundId] || [];
    let fromPreset = resolveQuestionsByIds(presetIds);
    if (fromPreset.length < roundConfig.count) {
      const fallback = pickFromBankByPack(
        roundId,
        packId,
        roundConfig.count - fromPreset.length,
        usedIds,
      );
      fromPreset = [...fromPreset, ...fallback];
    }
    fromPreset.forEach((q) => usedIds.add(q.id));

    const customForRound = mergeCustomForRound(normalizedCustom, roundId);
    const combined = shuffle(
      applyCustomOverrides(fromPreset, customForRound, roundConfig.count),
    );

    publicQuestions[roundId] = combined.map(stripQuestionForPublic);
    combined.forEach((q) => {
      answerKeys[q.id] = q.correctIndex;
    });
  });

  return { publicQuestions, answerKeys, packId, packLabel: pack.label };
}

function buildFromTopics(topics, customQuestions) {
  const normalizedCustom = customQuestions
    .map((q, i) => normalizeCustomQuestion(q, i))
    .filter(Boolean);

  const usedIds = new Set();
  const publicQuestions = {};
  const answerKeys = {};

  ROUND_ORDER.forEach((roundId) => {
    const roundConfig = OLYMPIA_ROUNDS[roundId];
    const customForRound = mergeCustomForRound(normalizedCustom, roundId);
    const bankCount = Math.max(0, roundConfig.count - customForRound.length);
    const fromBank = pickFromBankByTopics(
      roundId,
      topics.length ? topics : ['variables', 'loops', 'strings'],
      bankCount,
      usedIds,
    );
    const combined = shuffle([...fromBank, ...customForRound]).slice(0, roundConfig.count);

    publicQuestions[roundId] = combined.map(stripQuestionForPublic);
    combined.forEach((q) => {
      answerKeys[q.id] = q.correctIndex;
    });
  });

  return { publicQuestions, answerKeys, packId: null, packLabel: null };
}

export function buildSessionQuestionSet({ packId, topics = [], customQuestions = [] }) {
  if (packId && OLYMPIA_PACK_BY_ID[packId]) {
    return buildFromPresetPack(packId, customQuestions);
  }
  return buildFromTopics(topics, customQuestions);
}

export function previewPackQuestions(packId, customQuestions = []) {
  const result = buildSessionQuestionSet({ packId, customQuestions });
  if (!result) return [];
  return ROUND_ORDER.flatMap((roundId) =>
    (result.publicQuestions[roundId] || []).map((q, index) => ({
      round: roundId,
      roundLabel: OLYMPIA_ROUNDS[roundId].label,
      index: index + 1,
      ...q,
    })),
  );
}

export function getQuestionFromSession(session, round, questionIndex) {
  const questions = session?.config?.questions?.[round];
  if (!questions || questionIndex < 0 || questionIndex >= questions.length) return null;
  return questions[questionIndex];
}

export function getRoundQuestionCount(session, round) {
  return session?.config?.questions?.[round]?.length ?? OLYMPIA_ROUNDS[round]?.count ?? 0;
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
