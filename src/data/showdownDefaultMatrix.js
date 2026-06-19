/**
 * Default matrix for Python Basic — matches the official Coding Showdown matrix.
 * Vòng 1: vấn đáp 5 câu/học sinh, 5s/câu, lấy từ kho 80 câu (đổi liên tục).
 * Vòng 2: cả lớp 5 câu, 25s/câu.
 * Vòng 3: viết code (GV chấm), chọn gói điểm theo độ khó.
 */
export const DEFAULT_SHOWDOWN_MATRIX = {
  id: 'python-basic-default',
  name: 'Python Basic — Mặc định',
  subject: 'Python',
  level: 'Basic',
  isDefault: true,
  rounds: {
    startup: {
      // count = số câu mỗi học sinh trả lời (kho 80 câu được rút ngẫu nhiên).
      count: 5,
      difficulties: [],
      topics: [],
      questionTypes: ['oral'],
      seconds: 5,
      points: 10,
    },
    obstacle: {
      count: 5,
      difficulties: [],
      topics: [],
      questionTypes: [],
      seconds: 25,
      speedBonus: 5,
      speedBonusTiers: [5, 3, 2],
      speedBonusMs: 10000,
      points: 20,
    },
    finish: {
      count: 1,
      pointChoices: [10, 20, 30],
      difficultyMap: { 10: 'easy', 20: 'medium', 30: 'hard' },
      questionTypes: ['code'],
      seconds: 120,
    },
  },
};
