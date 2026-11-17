import { createSign } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const FIREBASE_AUDIENCE = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';

let cachedProjectId = '';

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT');
  }
  const parsed = JSON.parse(raw);
  if (parsed.private_key) {
    parsed.private_key = String(parsed.private_key).replace(/\\n/g, '\n');
  }
  return parsed;
}

export function getFirebaseProjectId() {
  if (cachedProjectId) return cachedProjectId;
  cachedProjectId = String(parseServiceAccount().project_id || '').trim();
  if (!cachedProjectId) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT project_id');
  return cachedProjectId;
}

function webSafeBase64(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createCustomToken(uid, claims = {}) {
  const account = parseServiceAccount();
  const header = { alg: 'RS256', typ: 'JWT' };
  const iat = Math.floor(Date.now() / 1000);
  const body = {
    aud: FIREBASE_AUDIENCE,
    iat,
    exp: iat + 60 * 60,
    iss: account.client_email,
    sub: account.client_email,
    uid,
  };
  if (claims && Object.keys(claims).length) body.claims = claims;
  const unsigned = `${webSafeBase64(JSON.stringify(header))}.${webSafeBase64(JSON.stringify(body))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${webSafeBase64(signer.sign(account.private_key))}`;
}

export function getAdminDb() {
  if (!getApps().length) {
    const account = parseServiceAccount();
    cachedProjectId = String(account.project_id || '').trim();
    initializeApp({ credential: cert(account) });
  }
  return getFirestore();
}
