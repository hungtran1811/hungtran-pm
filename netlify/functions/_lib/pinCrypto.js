import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 32;

export function pinPepper() {
  const pepper = String(process.env.PIN_PEPPER || '');
  if (pepper.length < 16) {
    const error = new Error('Thiếu PIN_PEPPER trên máy chủ.');
    error.code = 'PIN_PEPPER_MISSING';
    throw error;
  }
  return pepper;
}

const SCRYPT_COST = 4096;

export async function hashPin(pin, { pepper = pinPepper(), cost = SCRYPT_COST } = {}) {
  const salt = randomBytes(16);
  const hash = await scrypt(`${pepper}:${pin}`, salt, KEY_LENGTH, { cost, maxmem: 64 * 1024 * 1024 });
  return { salt: salt.toString('base64'), hash: hash.toString('base64'), scryptN: cost };
}

function revealKey(pepper) {
  return createHash('sha256').update(`pin-reveal:${pepper}`).digest();
}

export function encryptPin(pin, { pepper = pinPepper() } = {}) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', revealKey(pepper), iv);
  const encrypted = Buffer.concat([cipher.update(String(pin), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptPin(payload, { pepper = pinPepper() } = {}) {
  try {
    const [ivB64, tagB64, dataB64] = String(payload || '').split('.');
    if (!ivB64 || !tagB64 || !dataB64) return '';
    const decipher = createDecipheriv('aes-256-gcm', revealKey(pepper), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const pin = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    return /^[0-9]{4}$/.test(pin) ? pin : '';
  } catch {
    return '';
  }
}

export async function verifyPinHash(pin, stored, { pepper = pinPepper() } = {}) {
  if (!stored?.salt || !stored?.hash) return false;
  const salt = Buffer.from(stored.salt, 'base64');
  const expected = Buffer.from(stored.hash, 'base64');
  const cost = Number(stored.scryptN) || 16384;
  const actual = await scrypt(`${pepper}:${pin}`, salt, expected.length, { cost, maxmem: 64 * 1024 * 1024 });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
