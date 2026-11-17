import { getAdminDb, getFirebaseProjectId } from './firebaseAdmin.js';
import { verifyStudentIdToken } from '../../../src/lib/firebaseIdToken.js';
import { PIN_LEGACY_MESSAGE } from '../../../src/lib/pinFlow.js';
import { assertWritableEnrollment } from './enrollmentAccess.js';

function bearerToken(event) {
  const header = event?.headers?.authorization || event?.headers?.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export async function requireStudent(event) {
  const token = bearerToken(event);
  if (!token) return { ok: false, status: 401, error: 'Cần đăng nhập học sinh.' };
  try {
    const claims = await verifyStudentIdToken(token, getFirebaseProjectId());
    if (!claims) return { ok: false, status: 401, error: 'Phiên học sinh không hợp lệ.' };
    const session = await getAdminDb().collection('studentSessions').doc(claims.studentId).get();
    const version = Number(session.data()?.credentialVersion || 0);
    if (!session.exists || version !== claims.credentialVersion) {
      return { ok: false, status: 401, error: 'Phiên học sinh đã hết hiệu lực.' };
    }
    return { ok: true, ...claims };
  } catch {
    return { ok: false, status: 401, error: 'Phiên học sinh không hợp lệ.' };
  }
}

export async function assertPinClassStudent(event, db, classDoc, studentId) {
  const classCode = classDoc?.classCode || classDoc?.id;
  if (classCode && studentId) {
    const enrollment = await assertWritableEnrollment(db, classCode, studentId);
    if (!enrollment.ok) return enrollment;
  }
  if (classDoc?.pinRequired !== true) return { ok: true };
  const authResult = await requireStudent(event);
  if (!authResult.ok) return authResult;
  if (authResult.studentId !== studentId) {
    return { ok: false, status: 403, error: 'Không đúng học sinh của phiên này.' };
  }
  return { ok: true, db };
}

export function legacyPinRejected(classDoc) {
  if (classDoc?.pinRequired === true) return null;
  return { ok: false, status: 403, error: PIN_LEGACY_MESSAGE };
}
