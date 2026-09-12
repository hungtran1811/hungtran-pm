import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

export function getAdminDb() {
  if (!getApps().length) {
    initializeApp({ credential: cert(parseServiceAccount()) });
  }
  return getFirestore();
}
