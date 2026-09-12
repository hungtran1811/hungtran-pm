import { UPLOAD_SESSION_TTL_MS } from '../../../src/config/submissionConfig.js';
import { namesMatch } from '../../../src/lib/normalizeStudentName.js';
import { buildStoredFileName, buildSubmissionDrivePath } from '../../../src/lib/submissionFileName.js';
import {
  validateCreateSessionInput,
  validateStudentIdentityInput,
} from '../../../src/lib/submissionValidate.js';

export {
  validateCreateSessionInput,
  validateStudentIdentityInput,
  buildStoredFileName,
  buildSubmissionDrivePath,
  namesMatch,
  UPLOAD_SESSION_TTL_MS,
};

export function isOpenClass(data) {
  return data?.status === 'active' && data?.hidden !== true;
}

export function studentBelongsToClass(student, classCode, classId) {
  const studentClass = String(student?.classId || student?.classCode || '').trim();
  return studentClass === classCode || (classId && studentClass === classId);
}

export async function loadOpenClass(db, classCode) {
  const direct = await db.collection('classes').doc(classCode).get();
  if (direct.exists) {
    const data = direct.data() || {};
    return { id: direct.id, classCode: data.classCode || direct.id, ...data };
  }

  const query = await db.collection('classes').where('classCode', '==', classCode).limit(1).get();
  if (query.empty) return null;
  const doc = query.docs[0];
  const data = doc.data() || {};
  return { id: doc.id, classCode: data.classCode || doc.id, ...data };
}

export async function loadActiveStudent(db, studentId) {
  const snap = await db.collection('students').doc(studentId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}
