export const DEFAULT_STEP_THRESHOLD = 25;
export const MAX_MOUNTAIN_STEP = 10;

export const OLYMPIA_TOPICS = [
  { id: 'variables', label: 'Biến & kiểu dữ liệu' },
  { id: 'loops', label: 'Vòng lặp' },
  { id: 'strings', label: 'Chuỗi' },
  { id: 'lists', label: 'Danh sách' },
  { id: 'functions', label: 'Hàm' },
  { id: 'conditionals', label: 'Rẽ nhánh if/else' },
];

export const OLYMPIA_ROUNDS = {
  startup: {
    id: 'startup',
    label: 'Khởi động',
    count: 5,
    seconds: 20,
    basePoints: 10,
  },
  acceleration: {
    id: 'acceleration',
    label: 'Tăng tốc',
    count: 3,
    seconds: 30,
    basePoints: 20,
    speedBonus: 5,
    speedBonusMs: 10000,
  },
  finish: {
    id: 'finish',
    label: 'Về đích',
    count: 2,
    seconds: 45,
    pointChoices: [10, 20, 30],
  },
};

export const ROUND_ORDER = ['startup', 'acceleration', 'finish'];

export const ACTIVE_SESSION_STATUSES = ['lobby', 'playing', 'reveal'];

export function computeMountainStep(totalScore, stepThreshold = DEFAULT_STEP_THRESHOLD) {
  const score = Number(totalScore) || 0;
  const threshold = Number(stepThreshold) || DEFAULT_STEP_THRESHOLD;
  return Math.min(MAX_MOUNTAIN_STEP, Math.floor(score / threshold));
}

export function responseDocId(studentId, round, questionIndex) {
  return `${studentId}__${round}__${questionIndex}`;
}

export function roundLabel(roundId) {
  return OLYMPIA_ROUNDS[roundId]?.label || roundId;
}
