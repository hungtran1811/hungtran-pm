import { verifyFirebaseIdToken } from '../../../src/lib/firebaseIdToken.js';
import { getAdminDb, getFirebaseProjectId } from './firebaseAdmin.js';
import { logFunctionError } from './functionLog.js';

function bearerToken(event) {
  const header = event?.headers?.authorization || event?.headers?.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export async function requireAdmin(event) {
  const token = bearerToken(event);
  if (!token) {
    return { ok: false, status: 401, error: 'Cần đăng nhập quản trị.' };
  }

  try {
    const db = getAdminDb();
    const claims = await verifyFirebaseIdToken(token, getFirebaseProjectId());
    if (!claims) {
      return { ok: false, status: 401, error: 'Phiên đăng nhập không hợp lệ. Hãy đăng xuất rồi đăng nhập lại.' };
    }

    const snap = await db.collection('admins').doc(claims.email).get();
    const active = snap.data()?.active;
    if (!snap.exists || (active !== true && active !== 'true')) {
      return { ok: false, status: 403, error: 'Không có quyền quản trị.' };
    }

    return { ok: true, email: claims.email, uid: claims.uid };
  } catch (error) {
    logFunctionError('requireAdmin', 'ADMIN_AUTH_FAILED', error);
    return { ok: false, status: 401, error: 'Phiên đăng nhập không hợp lệ. Hãy đăng xuất rồi đăng nhập lại.' };
  }
}
