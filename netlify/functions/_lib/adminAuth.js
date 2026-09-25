import { readFirebaseIdTokenClaims } from '../../../src/lib/firebaseIdToken.js';
import { getAdminDb, getFirebaseProjectId } from './firebaseAdmin.js';

function bearerToken(event) {
  const header = event?.headers?.authorization || event?.headers?.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

async function verifyFirebaseIdToken(token) {
  const response = await fetch('https://oauth2.googleapis.com/tokeninfo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: token }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error('invalid token');
  }
  const claims = readFirebaseIdTokenClaims(payload, getFirebaseProjectId());
  if (!claims) throw new Error('invalid token');
  return claims;
}

export async function requireAdmin(event) {
  const token = bearerToken(event);
  if (!token) {
    return { ok: false, status: 401, error: 'Cần đăng nhập quản trị.' };
  }

  try {
    const db = getAdminDb();
    const claims = await verifyFirebaseIdToken(token);
    const snap = await db.collection('admins').doc(claims.email).get();
    const active = snap.data()?.active;
    if (!snap.exists || (active !== true && active !== 'true')) {
      return { ok: false, status: 403, error: 'Không có quyền quản trị.' };
    }

    return { ok: true, email: claims.email, uid: claims.uid };
  } catch {
    return { ok: false, status: 401, error: 'Phiên đăng nhập không hợp lệ.' };
  }
}
