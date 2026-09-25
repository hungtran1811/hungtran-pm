import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

export function getAdminDb() {
  if (!getApps().length) {
    const account = parseServiceAccount();
    cachedProjectId = String(account.project_id || '').trim();
    initializeApp({ credential: cert(account) });
  }
  return getFirestore();
}
