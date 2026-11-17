import { describe, expect, it } from 'vitest';
import { decryptPin, encryptPin, hashPin, pinMatchesStored, verifyPinHash } from './pinCrypto.js';

const pepper = 'test-pepper-value';

describe('pin hash', () => {
  it('verifies the same pin and rejects a different one', async () => {
    const stored = await hashPin('1234', { pepper });
    expect(stored.hash).not.toBe('1234');
    expect(await verifyPinHash('1234', stored, { pepper })).toBe(true);
    expect(await verifyPinHash('1235', stored, { pepper })).toBe(false);
  });

  it('accepts a stored hash that omitted the scrypt cost', async () => {
    const stored = await hashPin('1234', { pepper });
    delete stored.scryptN;
    expect(await pinMatchesStored('1234', stored, { pepper })).toBe(true);
    expect(await pinMatchesStored('1235', stored, { pepper })).toBe(false);
  });

  it('accepts the previous encrypted pin when the hash does not match', async () => {
    const stored = await hashPin('9999', { pepper });
    stored.pinCipher = encryptPin('1234', { pepper });
    expect(await pinMatchesStored('1234', stored, { pepper })).toBe(true);
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
