export const DEFAULT_SCORING = {
  quizGreen: 80,
  quizAmber: 50,
  understandingGreen: 4,
  understandingAmber: 3,
};

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function mergeScoring(partial = {}) {
  return {
    quizGreen: clampInt(partial.quizGreen, DEFAULT_SCORING.quizGreen, 1, 100),
    quizAmber: clampInt(partial.quizAmber, DEFAULT_SCORING.quizAmber, 0, 99),
    understandingGreen: clampInt(
      partial.understandingGreen,
      DEFAULT_SCORING.understandingGreen,
      1,
      5,
    ),
    understandingAmber: clampInt(
      partial.understandingAmber,
      DEFAULT_SCORING.understandingAmber,
      1,
      5,
    ),
  };
}

export function validateScoring(scoring) {
  const merged = mergeScoring(scoring);
  if (merged.quizGreen <= merged.quizAmber) {
    return 'Ngưỡng xanh phải lớn hơn ngưỡng vàng (điểm quiz/ôn tập).';
  }
  if (merged.understandingGreen <= merged.understandingAmber) {
    return 'Ngưỡng xanh phải lớn hơn ngưỡng vàng (mức hiểu bài).';
  }
  return null;
}

export function computeScoreTone(percent, scoring = DEFAULT_SCORING) {
  if (percent == null || Number.isNaN(percent)) return 'slate';
  if (percent >= scoring.quizGreen) return 'green';
  if (percent >= scoring.quizAmber) return 'amber';
  return 'red';
}

export function computeUnderstandingTone(level, scoring = DEFAULT_SCORING) {
  if (level == null || Number.isNaN(level)) return 'slate';
  if (level >= scoring.understandingGreen) return 'green';
  if (level >= scoring.understandingAmber) return 'amber';
  return 'red';
}

export function computeUnderstandingDotClass(n, level, scoring = DEFAULT_SCORING) {
  if (n > level) return 'bg-slate-200 dark:bg-slate-700';
  if (n >= scoring.understandingGreen) return 'bg-emerald-500';
  if (n >= scoring.understandingAmber) return 'bg-amber-400';
  return 'bg-red-400';
}
