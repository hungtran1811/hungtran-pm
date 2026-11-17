import { describe, expect, it } from 'vitest';
import { decryptPin, encryptPin, hashPin, verifyPinHash } from './pinCrypto.js';

const pepper = 'test-pepper-value';

describe('pin hash', () => {
  it('verifies the same pin and rejects a different one', async () => {
    const stored = await hashPin('1234', { pepper });
    expect(stored.hash).not.toBe('1234');
    expect(await verifyPinHash('1234', stored, { pepper })).toBe(true);
    expect(await verifyPinHash('1235', stored, { pepper })).toBe(false);
  });

  it('refuses to hash when the pepper is missing', async () => {
    const previous = process.env.PIN_PEPPER;
    delete process.env.PIN_PEPPER;
    await expect(hashPin('1234')).rejects.toMatchObject({ code: 'PIN_PEPPER_MISSING' });
    if (previous === undefined) delete process.env.PIN_PEPPER;
    else process.env.PIN_PEPPER = previous;
  });

  it('stores a reversible copy that does not contain the pin', () => {
    const stored = encryptPin('1234', { pepper });
    expect(stored).not.toContain('1234');
    expect(decryptPin(stored, { pepper })).toBe('1234');
    expect(decryptPin(stored, { pepper: 'other-pepper-value' })).toBe('');
  });
});
