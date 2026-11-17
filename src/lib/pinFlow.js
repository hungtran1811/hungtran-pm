export const PIN_FORMAT_MESSAGE = 'PIN phải là 4 chữ số.';
export const PIN_MISMATCH_MESSAGE = 'Hai lần nhập chưa giống nhau.';
export const PIN_EXISTS_MESSAGE = 'Học sinh này đã có mã PIN.';
export const PIN_GENERIC_MESSAGE = 'Mã không đúng.';
export const PIN_LOCKED_MESSAGE = 'Bạn thao tác quá nhanh. Thử lại sau vài phút.';
export const PIN_LEGACY_MESSAGE = 'Lớp này không dùng mã PIN.';
export const PIN_RESET_BLOCKED_MESSAGE = 'Giáo viên chưa duyệt yêu cầu đặt lại.';

export const PIN_FAILS_BEFORE_LOCK = 5;
export const PIN_LOCK_MS = 15 * 60 * 1000;
export const PIN_RESET_TTL_MS = 30 * 60 * 1000;

export function pinConfirmDiverged(pin, confirmPin) {
  const confirm = String(confirmPin || '');
  if (!confirm) return false;
  return String(pin || '').slice(0, confirm.length) !== confirm;
}

export function isFourDigitPin(value) {
  return /^[0-9]{4}$/.test(String(value ?? ''));
}

export function evaluateClaim({ existing = false, pin, confirmPin } = {}) {
  if (!isFourDigitPin(pin) || !isFourDigitPin(confirmPin)) {
    return { ok: false, error: PIN_FORMAT_MESSAGE };
  }
  if (pin !== confirmPin) return { ok: false, error: PIN_MISMATCH_MESSAGE };
  if (existing) return { ok: false, error: PIN_EXISTS_MESSAGE };
  return { ok: true };
}

export function nextVerifyFailure(credential, now, { max = PIN_FAILS_BEFORE_LOCK, lockMs = PIN_LOCK_MS } = {}) {
  const failedCount = Number(credential?.failedCount || 0) + 1;
  if (failedCount >= max) {
    return { failedCount, lockedUntil: now + lockMs, locked: true };
  }
  return { failedCount, lockedUntil: null, locked: false };
}

export function isCredentialLocked(credential, now) {
  if (!credential) return false;
  if (credential.locked === true) return true;
  const until = Number(credential.lockedUntil || 0);
  return until > now;
}

export function canSetResetPin(request, now) {
  if (!request || request.status !== 'approved') return false;
  const expiresAt = Number(request.expiresAt || 0);
  return expiresAt > now;
}

export function derivePinStatus({ credential, request, now = Date.now() } = {}) {
  if (!credential) return { status: 'Chưa tạo', lastResetAt: null };
  if (isCredentialLocked(credential, now)) {
    return { status: 'Tạm khóa', lastResetAt: credential.lastResetAt || null };
  }
  if (request?.status === 'pending') {
    return { status: 'Chờ reset', lastResetAt: credential.lastResetAt || null };
  }
  if (canSetResetPin(request, now)) {
    return { status: 'Đã reset', lastResetAt: credential.lastResetAt || null };
  }
  return { status: 'Đang dùng', lastResetAt: credential.lastResetAt || null };
}

export function gateMode({ credential, request, now = Date.now() } = {}) {
  if (!credential) return 'needsClaim';
  if (isCredentialLocked(credential, now)) return 'locked';
  if (request?.status === 'pending') return 'pendingReset';
  if (canSetResetPin(request, now)) return 'needsResetPin';
  return 'needsVerify';
}

export async function claimInTransaction(runTransaction, { pin, confirmPin, hashPin }) {
  return runTransaction(async (tx) => {
    const existing = await tx.get();
    const decision = evaluateClaim({ existing: Boolean(existing), pin, confirmPin });
    if (!decision.ok) return decision;
    const hashed = await hashPin(pin);
    await tx.create({
      ...hashed,
      credentialVersion: 1,
      failedCount: 0,
      locked: false,
      lockedUntil: null,
    });
    return { ok: true, credentialVersion: 1 };
  });
}
