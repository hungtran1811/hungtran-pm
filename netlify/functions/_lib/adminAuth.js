import { getAuth } from 'firebase-admin/auth';
import { getAdminDb } from './firebaseAdmin.js';

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
    const decoded = await getAuth().verifyIdToken(token);
    const email = String(decoded.email || '').trim().toLowerCase();
    if (!email) {
      return { ok: false, status: 403, error: 'Tài khoản không có email.' };
    }

    const snap = await db.collection('admins').doc(email).get();
    const active = snap.data()?.active;
    if (!snap.exists || (active !== true && active !== 'true')) {
      return { ok: false, status: 403, error: 'Không có quyền quản trị.' };
    }

    return { ok: true, email, uid: decoded.uid };
  } catch {
    return { ok: false, status: 401, error: 'Phiên đăng nhập không hợp lệ.' };
  }
}
