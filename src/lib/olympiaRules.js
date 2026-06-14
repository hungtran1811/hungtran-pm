import {
  DEFAULT_STEP_THRESHOLD,
  MAX_MOUNTAIN_STEP,
  OLYMPIA_ROUNDS,
  ROUND_ORDER,
  computeMountainStep,
} from './olympiaConstants.js';

export function buildMountainMilestones(stepThreshold = DEFAULT_STEP_THRESHOLD) {
  const threshold = Number(stepThreshold) || DEFAULT_STEP_THRESHOLD;
  return Array.from({ length: MAX_MOUNTAIN_STEP + 1 }, (_, step) => ({
    step,
    minScore: step * threshold,
    maxScore: step >= MAX_MOUNTAIN_STEP ? null : (step + 1) * threshold - 1,
    label: step === 0 ? 'Chân núi' : step === MAX_MOUNTAIN_STEP ? 'Đỉnh Olympia' : `Bậc ${step}`,
  }));
}

export function pointsToNextStep(totalScore, stepThreshold = DEFAULT_STEP_THRESHOLD) {
  const score = Number(totalScore) || 0;
  const threshold = Number(stepThreshold) || DEFAULT_STEP_THRESHOLD;
  const currentStep = computeMountainStep(score, threshold);
  if (currentStep >= MAX_MOUNTAIN_STEP) return 0;
  const nextMin = (currentStep + 1) * threshold;
  return Math.max(0, nextMin - score);
}

export function formatMountainProgress(totalScore, stepThreshold = DEFAULT_STEP_THRESHOLD) {
  const score = Number(totalScore) || 0;
  const threshold = Number(stepThreshold) || DEFAULT_STEP_THRESHOLD;
  const step = computeMountainStep(score, threshold);
  const remaining = pointsToNextStep(score, threshold);
  if (step >= MAX_MOUNTAIN_STEP) {
    return { step, remaining: 0, text: `Bậc ${step} — đã lên đỉnh Olympia` };
  }
  return {
    step,
    remaining,
    text: `Bậc ${step} · Còn ${remaining}đ lên bậc ${step + 1}`,
  };
}

export function getRoundRulesSummary(roundId, speedBonusEnabled = false) {
  const round = OLYMPIA_ROUNDS[roundId];
  if (!round) return '';
  if (roundId === 'finish') {
    return `${round.label} · ${round.count} câu · ${round.seconds}s/câu · Chọn 10/20/30đ trước khi trả lời · Sai = 0đ`;
  }
  if (roundId === 'acceleration' && speedBonusEnabled) {
    return `${round.label} · ${round.count} câu · ${round.seconds}s/câu · +${round.basePoints}đ nếu đúng · Bonus +${round.speedBonus}đ trong 10s đầu`;
  }
  return `${round.label} · ${round.count} câu · ${round.seconds}s/câu · +${round.basePoints}đ nếu đúng`;
}

export const OLYMPIA_RULES_SUMMARY = {
  title: 'Olympia Python — Luật chơi',
  intro:
    'Thi cá nhân trên điện thoại. Giáo viên điều khiển từng câu trên máy chiếu. Trả lời đúng được điểm và leo thêm bậc trên núi.',
  rounds: ROUND_ORDER.map((id) => ({
    id,
    label: OLYMPIA_ROUNDS[id].label,
    detail: getRoundRulesSummary(id, false),
  })),
  mountain:
    'Mỗi 25 điểm (mặc định) leo thêm 1 bậc, tối đa 10 bậc = đỉnh Olympia. Xếp hạng theo tổng điểm; hòa thì ai lên đỉnh trước thắng.',
  ranking: 'Điểm cao hơn xếp trên. Hòa điểm: ai đạt bậc 10 trước được ưu tiên.',
  finishNote: 'Vòng Về đích: chọn mức điểm (10 / 20 / 30) trước khi thấy câu. Trả lời sai không bị trừ điểm.',
  flow: [
    'Vào phòng chờ → GV bắt đầu',
    'Mỗi câu: chọn đáp án → Nộp → chờ GV công bố đáp án',
    'GV chuyển câu / vòng tiếp theo',
    'Hết 10 câu → xem bục vinh quang',
  ],
};

export function getSessionStatusLabel(status, submittedCount = 0, participantCount = 0) {
  switch (status) {
    case 'lobby':
      return 'Chờ HS vào phòng';
    case 'playing':
      return `Đang trả lời (${submittedCount}/${participantCount} đã nộp)`;
    case 'reveal':
      return 'Đang công bố đáp án';
    case 'finished':
      return 'Đã kết thúc';
    default:
      return status || '';
  }
}
