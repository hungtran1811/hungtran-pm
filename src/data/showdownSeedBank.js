import { SHOWDOWN_MATRIX_BANK } from './showdownMatrixBank.js';
import { BANK_ROUND_MAP } from '../lib/showdownConstants.js';

/**
 * Seed bank used as the in-memory fallback (and as the source for the
 * "Nạp đề mẫu" action). 151 vấn đáp + 39 chướng ngại + 120 về đích.
 */
export const SHOWDOWN_SEED_BANK = SHOWDOWN_MATRIX_BANK;

export const SHOWDOWN_SEED_BY_ID = Object.fromEntries(
  SHOWDOWN_SEED_BANK.map((q) => [q.id, q]),
);

export { BANK_ROUND_MAP };
