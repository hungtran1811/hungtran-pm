import { describe, expect, it } from 'vitest';
import {
  PIN_EXISTS_MESSAGE,
  PIN_FORMAT_MESSAGE,
  PIN_GENERIC_MESSAGE,
  PIN_LOCKED_MESSAGE,
  PIN_MISMATCH_MESSAGE,
  PIN_RESET_BLOCKED_MESSAGE,
  canSetResetPin,
  claimInTransaction,
  derivePinStatus,
  evaluateClaim,
  gateMode,
  nextVerifyFailure,
  pinConfirmDiverged,
} from './pinFlow.js';

describe('pin decisions', () => {
  it('accepts a matching 4-digit claim and rejects mismatch, length, and letters', () => {
    expect(evaluateClaim({ pin: '1234', confirmPin: '1234' }).ok).toBe(true);
    expect(evaluateClaim({ pin: '1234', confirmPin: '1235' })).toEqual({
      ok: false,
      error: PIN_MISMATCH_MESSAGE,
    });
    expect(evaluateClaim({ pin: '123', confirmPin: '123' }).error).toBe(PIN_FORMAT_MESSAGE);
    expect(evaluateClaim({ pin: '12345', confirmPin: '12345' }).error).toBe(PIN_FORMAT_MESSAGE);
    expect(evaluateClaim({ pin: '12ab', confirmPin: '12ab' }).error).toBe(PIN_FORMAT_MESSAGE);
  });

  it('warns as soon as the second PIN diverges', () => {
    expect(pinConfirmDiverged('1234', '')).toBe(false);
    expect(pinConfirmDiverged('1234', '12')).toBe(false);
    expect(pinConfirmDiverged('1234', '9')).toBe(true);
    expect(pinConfirmDiverged('1234', '1235')).toBe(true);
    expect(pinConfirmDiverged('1234', '1234')).toBe(false);
  });

  it('does not replace an existing credential', () => {
    expect(evaluateClaim({ existing: true, pin: '1234', confirmPin: '1234' }).error).toBe(PIN_EXISTS_MESSAGE);
  });

  it('lets only one concurrent claim create the credential', async () => {
    let record = null;
    let chain = Promise.resolve();
    const runTransaction = (fn) => {
      const run = chain.then(async () => {
        const tx = {
          async get() {
            return record;
          },
          async create(value) {
            record = value;
          },
        };
        return fn(tx);
      });
      chain = run.then(() => {}, () => {});
      return run;
    };
    const hashPin = async () => ({ salt: 'salt', hash: 'hash' });
    const [first, second] = await Promise.all([
      claimInTransaction(runTransaction, { pin: '1234', confirmPin: '1234', hashPin }),
      claimInTransaction(runTransaction, { pin: '9999', confirmPin: '9999', hashPin }),
    ]);
    const winners = [first, second].filter((item) => item.ok);
    expect(winners).toHaveLength(1);
    expect(record.hash).toBe('hash');
    expect(record.credentialVersion).toBe(1);
  });

  it('locks after repeated failures without echoing the pin', () => {
    let credential = { failedCount: 0 };
    let locked = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      locked = nextVerifyFailure(credential, 1_000);
      credential = { failedCount: locked.failedCount, lockedUntil: locked.lockedUntil };
    }
    expect(locked.locked).toBe(true);
    expect(PIN_GENERIC_MESSAGE).not.toContain('1234');
    expect(PIN_LOCKED_MESSAGE).not.toContain('1234');
  });

  it('keeps the hash when only the class code would change', () => {
    const credential = { hash: 'same-hash', salt: 'salt', credentialVersion: 2, lastResetAt: 10 };
    const before = derivePinStatus({ credential, now: 20 });
    const after = derivePinStatus({ credential: { ...credential }, now: 20 });
    expect(after).toEqual(before);
    expect(JSON.stringify(after)).not.toContain('same-hash');
  });

  it('blocks a new pin until the teacher approves the reset', () => {
    const now = 5_000;
    expect(canSetResetPin({ status: 'pending', expiresAt: now + 1000 }, now)).toBe(false);
    expect(canSetResetPin({ status: 'approved', expiresAt: now + 1000 }, now)).toBe(true);
    expect(gateMode({ credential: { credentialVersion: 1 }, request: { status: 'pending' }, now })).toBe(
      'pendingReset',
    );
    expect(PIN_RESET_BLOCKED_MESSAGE).not.toContain('1234');
    expect(derivePinStatus({ credential: null }).status).toBe('Chưa tạo');
  });
});
