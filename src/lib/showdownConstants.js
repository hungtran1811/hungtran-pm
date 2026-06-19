export const SHOWDOWN_TOPICS = [
  { id: 'variables', label: 'Biến & kiểu dữ liệu' },
  { id: 'io', label: 'Input/Output' },
  { id: 'operators', label: 'Toán tử' },
  { id: 'conditionals', label: 'If/else' },
  { id: 'loops', label: 'Vòng lặp' },
  { id: 'lists', label: 'List' },
  { id: 'functions', label: 'Function' },
  { id: 'debug', label: 'Debug lỗi' },
  { id: 'output', label: 'Dự đoán output' },
  { id: 'strings', label: 'Chuỗi' },
  { id: 'custom', label: 'Tùy chỉnh' },
];

export const SHOWDOWN_DIFFICULTIES = [
  { id: 'easy', label: 'Dễ' },
  { id: 'medium', label: 'Trung bình' },
  { id: 'hard', label: 'Khó' },
];

export const SHOWDOWN_QUESTION_TYPES = [
  { id: 'oral', label: 'Vấn đáp' },
  { id: 'multiple_choice', label: 'Trắc nghiệm' },
  { id: 'code_output', label: 'Dự đoán output' },
  { id: 'short_answer', label: 'Trả lời ngắn' },
  { id: 'code', label: 'Viết code (GV chấm)' },
];

/** Round ids align with legacy Olympia mapping for bank reuse. */
export const SHOWDOWN_ROUNDS = {
  startup: {
    id: 'startup',
    label: 'Khởi động',
    roundMode: 'oral',
    count: 5,
    seconds: 5,
    basePoints: 10,
  },
  obstacle: {
    id: 'obstacle',
    label: 'Vượt chướng ngại vật',
    roundMode: 'device',
    count: 5,
    seconds: 25,
    basePoints: 20,
    speedBonus: 5,
    speedBonusTiers: [5, 3, 2],
    speedBonusMs: 10000,
  },
  finish: {
    id: 'finish',
    label: 'Về đích',
    roundMode: 'device',
    count: 1,
    seconds: 90,
    pointChoices: [10, 20, 30],
    difficultyMap: { 10: 'easy', 20: 'medium', 30: 'hard' },
  },
};

/** Map obstacle round to olympia bank round id. */
export const BANK_ROUND_MAP = {
  startup: 'startup',
  obstacle: 'acceleration',
  finish: 'finish',
};

export const ROUND_ORDER = ['startup', 'obstacle', 'finish'];

export const ACTIVE_SESSION_STATUSES = ['lobby', 'playing', 'reveal'];

export function responseDocId(studentId, round, questionIndex) {
  return `${studentId}__${round}__${questionIndex}`;
}

export function roundLabel(roundId) {
  return SHOWDOWN_ROUNDS[roundId]?.label || roundId;
}

export function roundModeForRound(roundId) {
  return SHOWDOWN_ROUNDS[roundId]?.roundMode || 'device';
}

export function difficultyFromNumber(n) {
  const d = Number(n);
  if (d <= 1) return 'easy';
  if (d <= 2) return 'medium';
  return 'hard';
}

export function normalizeDifficulty(value) {
  if (value === 'easy' || value === 'medium' || value === 'hard') return value;
  return difficultyFromNumber(value);
}
