import { SHOWDOWN_ROUNDS } from './showdownConstants.js';

/** Default tiers — matches the previous auto formula for speedBonus = 5. */
export const DEFAULT_SPEED_BONUS_TIERS = [5, 3, 2];

/**
 * Resolve configured bonus points per rank (0 = fastest correct submitter).
 * Falls back to legacy single `speedBonus` × [1, 0.6, 0.3] when tiers are absent.
 */
export function resolveSpeedBonusTiers(obstacleRound) {
  const fallback = SHOWDOWN_ROUNDS.obstacle?.speedBonusTiers
    || DEFAULT_SPEED_BONUS_TIERS;

  if (!obstacleRound) return [...fallback];

  if (Array.isArray(obstacleRound.speedBonusTiers)) {
    return obstacleRound.speedBonusTiers.map((n) => Math.max(0, Number(n) || 0));
  }

  const base = Number(obstacleRound.speedBonus);
  if (!base) return [];

  return [
    Math.round(base),
    Math.round(base * 0.6),
    Math.round(base * 0.3),
  ];
}

export function speedBonusForRank(rank, tiers) {
  if (rank < 0 || !tiers?.length) return 0;
  return tiers[rank] ?? 0;
}

export function hasSpeedBonus(tiers) {
  return Array.isArray(tiers) && tiers.some((pts) => pts > 0);
}

/** e.g. "hạng 1 +5, hạng 2 +3" */
export function formatSpeedBonusTierList(tiers) {
  return tiers
    .filter((pts) => pts > 0)
    .map((pts, i) => `hạng ${i + 1} +${pts}`)
    .join(', ');
}
