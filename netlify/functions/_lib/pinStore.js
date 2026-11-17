import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getAdminDb } from './firebaseAdmin.js';
import { hashPin, verifyPinHash } from './pinCrypto.js';
import {
  PIN_GENERIC_MESSAGE,
  PIN_LOCKED_MESSAGE,
  PIN_RESET_BLOCKED_MESSAGE,
  PIN_RESET_TTL_MS,
  canSetResetPin,
  derivePinStatus,
  evaluateClaim,
  gateMode,
  isCredentialLocked,
  isFourDigitPin,
  nextVerifyFailure,
} from '../../../src/lib/pinFlow.js';
import {
  loadActiveStudent,
  loadOpenClass,
  studentBelongsToClass,
} from './submissionValidate.js';
import { assertReadableEnrollment } from './enrollmentAccess.js';

function millis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function credentialView(data) {
  if (!data) return null;
  return {
    ...data,
    lockedUntil: millis(data.lockedUntil),
    lastResetAt: millis(data.lastResetAt) || null,
  };
}

async function loadMembership(db, classCode, studentId) {
  const [classDoc, student] = await Promise.all([
    loadOpenClass(db, classCode),
    loadActiveStudent(db, studentId),
  ]);
  if (!classDoc || classDoc.pinRequired !== true) {
    return { ok: false, status: 403, error: 'Lớp này không dùng mã PIN.' };
  }
  if (!student?.active) return { ok: false, status: 403, error: 'Học sinh không thuộc lớp này.' };
  const enrollment = await assertReadableEnrollment(db, classDoc.classCode || classDoc.id, studentId);
  if (!enrollment.ok) return enrollment;
  if (enrollment.mode === 'legacy' && !studentBelongsToClass(student, classDoc.classCode, classDoc.id)) {
    return { ok: false, status: 403, error: 'Học sinh không thuộc lớp này.' };
  }
  return { ok: true, classDoc, student };
}

async function latestRequest(db, studentId) {
  const snap = await db.collection('pinResetRequests').where('studentId', '==', studentId).get();
  const rows = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data(), expiresAt: millis(doc.data()?.expiresAt) }))
    .sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
  return rows[0] || null;
}

async function issueToken(studentId, credentialVersion) {
  getAdminDb();
  return getAuth().createCustomToken(`stu_${studentId}`, { studentId, credentialVersion });
}

async function audit(db, type, studentId, classCode) {
  await db.collection('pinAudit').add({
    type,
    studentId,
    classCode: classCode || '',
    at: FieldValue.serverTimestamp(),
  });
}

export async function readPinGate(db, { classCode, studentId }) {
  const credRef = db.collection('studentCredentials').doc(studentId);
  const [membership, credSnap, request] = await Promise.all([
    loadMembership(db, classCode, studentId),
    credRef.get(),
    latestRequest(db, studentId),
  ]);
  if (!membership.ok) return membership;
  const credential = credentialView(credSnap.data());
  return {
    ok: true,
    body: {
      mode: gateMode({ credential, request }),
      status: derivePinStatus({ credential, request }).status,
    },
  };
}

export async function claimStudentPin(db, { classCode, studentId, pin, confirmPin }) {
  const decision = evaluateClaim({ existing: false, pin, confirmPin });
  if (!decision.ok) return { ok: false, status: 400, error: decision.error };
  const [membership, hashed] = await Promise.all([
    loadMembership(db, classCode, studentId),
    hashPin(pin),
  ]);
  if (!membership.ok) return membership;
  const ref = db.collection('studentCredentials').doc(studentId);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        const error = new Error('exists');
        error.code = 'PIN_EXISTS';
        throw error;
      }
      tx.set(ref, {
        salt: hashed.salt,
        hash: hashed.hash,
        scryptN: hashed.scryptN,
        credentialVersion: 1,
        failedCount: 0,
        locked: false,
        lockedUntil: null,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(db.collection('studentSessions').doc(studentId), {
        credentialVersion: 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (error) {
    if (error.code === 'PIN_EXISTS') {
      return { ok: false, status: 409, error: 'Học sinh này đã có mã PIN.' };
    }
    throw error;
  }
  const [, token] = await Promise.all([
    audit(db, 'claim', studentId, classCode),
    issueToken(studentId, 1),
  ]);
  return { ok: true, body: { token, credentialVersion: 1 } };
}

export async function verifyStudentPin(db, { classCode, studentId, pin }) {
  if (!isFourDigitPin(pin)) return { ok: false, status: 400, error: 'PIN phải là 4 chữ số.' };
  const ref = db.collection('studentCredentials').doc(studentId);
  const [membership, snap] = await Promise.all([
    loadMembership(db, classCode, studentId),
    ref.get(),
  ]);
  if (!membership.ok) return membership;
  const credential = credentialView(snap.data());
  if (!credential) return { ok: false, status: 401, error: PIN_GENERIC_MESSAGE };
  const now = Date.now();
  if (isCredentialLocked(credential, now)) {
    return { ok: false, status: 429, error: PIN_LOCKED_MESSAGE };
  }
  const matches = await verifyPinHash(pin, credential);
  if (!matches) {
    const next = nextVerifyFailure(credential, now);
    await ref.update({
      failedCount: next.failedCount,
      lockedUntil: next.lockedUntil ? Timestamp.fromMillis(next.lockedUntil) : null,
    });
    if (next.locked) await audit(db, 'lockout', studentId, classCode);
    return {
      ok: false,
      status: next.locked ? 429 : 401,
      error: next.locked ? PIN_LOCKED_MESSAGE : PIN_GENERIC_MESSAGE,
    };
  }
  const version = Number(credential.credentialVersion || 1);
  const [, token] = await Promise.all([
    ref.update({ failedCount: 0, lockedUntil: null }),
    issueToken(studentId, version),
  ]);
  return { ok: true, body: { token, credentialVersion: version } };
}

export async function requestPinReset(db, { classCode, studentId }) {
  const membership = await loadMembership(db, classCode, studentId);
  if (!membership.ok) return membership;
  const cred = await db.collection('studentCredentials').doc(studentId).get();
  if (!cred.exists) return { ok: false, status: 400, error: PIN_GENERIC_MESSAGE };
  const current = await latestRequest(db, studentId);
  if (current?.status === 'pending') return { ok: true, body: { requestId: current.id, status: 'pending' } };
  const ref = await db.collection('pinResetRequests').add({
    studentId,
    classCode,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  });
  await audit(db, 'reset-request', studentId, classCode);
  return { ok: true, body: { requestId: ref.id, status: 'pending' } };
}

export async function approvePinReset(db, { requestId }) {
  const ref = db.collection('pinResetRequests').doc(requestId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.status !== 'pending') {
    return { ok: false, status: 404, error: 'Không tìm thấy yêu cầu chờ duyệt.' };
  }
  const expiresAt = Timestamp.fromMillis(Date.now() + PIN_RESET_TTL_MS);
  await ref.update({
    status: 'approved',
    approvedAt: FieldValue.serverTimestamp(),
    expiresAt,
  });
  await audit(db, 'reset-approve', snap.data().studentId, snap.data().classCode);
  return { ok: true, body: { status: 'approved' } };
}

export async function setResetPin(db, { classCode, studentId, pin, confirmPin }) {
  const decision = evaluateClaim({ pin, confirmPin });
  if (!decision.ok) return { ok: false, status: 400, error: decision.error };
  const [membership, request, hashed] = await Promise.all([
    loadMembership(db, classCode, studentId),
    latestRequest(db, studentId),
    hashPin(pin),
  ]);
  if (!membership.ok) return membership;
  if (!canSetResetPin(request, Date.now())) {
    return { ok: false, status: 403, error: PIN_RESET_BLOCKED_MESSAGE };
  }
  const credRef = db.collection('studentCredentials').doc(studentId);
  let version = 1;
  await db.runTransaction(async (tx) => {
    const cred = await tx.get(credRef);
    version = Number(cred.data()?.credentialVersion || 1) + 1;
    tx.update(credRef, {
      salt: hashed.salt,
      hash: hashed.hash,
      scryptN: hashed.scryptN,
      credentialVersion: version,
      failedCount: 0,
      locked: false,
      lockedUntil: null,
      lastResetAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.collection('studentSessions').doc(studentId), {
      credentialVersion: version,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(db.collection('pinResetRequests').doc(request.id), {
      status: 'used',
      usedAt: FieldValue.serverTimestamp(),
    });
  });
  const [, token] = await Promise.all([
    audit(db, 'reset-set', studentId, classCode),
    issueToken(studentId, version),
  ]);
  return { ok: true, body: { token, credentialVersion: version } };
}

export async function lockStudentPin(db, { studentId, reason = '' }) {
  const ref = db.collection('studentCredentials').doc(studentId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, status: 404, error: 'Học sinh chưa có mã PIN.' };
  await ref.update({ locked: true, lockReason: String(reason || '').slice(0, 200) });
  await audit(db, 'lock', studentId, '');
  return { ok: true, body: { status: 'Tạm khóa' } };
}

export async function readPinStatus(db, { studentId }) {
  const studentSnap = await db.collection('students').doc(studentId).get();
  if (!studentSnap.exists) return { ok: false, status: 404, error: 'Không tìm thấy học sinh.' };
  const student = studentSnap.data() || {};
  const classCode = student.classId || student.classCode || '';
  const classSnap = classCode ? await db.collection('classes').doc(classCode).get() : null;
  if (classSnap?.data()?.pinRequired !== true) return { ok: true, body: { enabled: false } };
  const credSnap = await db.collection('studentCredentials').doc(studentId).get();
  const request = await latestRequest(db, studentId);
  const derived = derivePinStatus({ credential: credentialView(credSnap.data()), request });
  return {
    ok: true,
    body: {
      enabled: true,
      status: derived.status,
      lastResetAt: derived.lastResetAt,
      requestId: request?.status === 'pending' ? request.id : '',
      hasCredential: credSnap.exists,
    },
  };
}

function requestView(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    studentId: data.studentId || '',
    classCode: data.classCode || '',
    status: data.status || '',
    createdAt: millis(data.createdAt),
    expiresAt: millis(data.expiresAt),
  };
}

async function studentName(db, studentId, cache) {
  if (cache.has(studentId)) return cache.get(studentId);
  const snap = await db.collection('students').doc(studentId).get();
  const name = String(snap.data()?.fullName || '').trim() || 'Học sinh';
  cache.set(studentId, name);
  return name;
}

function boardRow(student, classCode, credential, request) {
  const derived = derivePinStatus({ credential, request });
  return {
    studentId: student.id,
    fullName: student.fullName,
    classCode,
    status: derived.status,
    lastResetAt: derived.lastResetAt,
    requestId: request?.status === 'pending' ? request.id : '',
    hasCredential: Boolean(credential),
  };
}

export async function listPinBoard(db, { classCode = '' } = {}) {
  const code = String(classCode || '').trim();
  if (!code) {
    const snap = await db.collection('pinResetRequests').where('status', '==', 'pending').get();
    const cache = new Map();
    const pending = [];
    for (const doc of snap.docs) {
      const row = requestView(doc);
      pending.push({
        requestId: row.id,
        studentId: row.studentId,
        classCode: row.classCode,
        fullName: await studentName(db, row.studentId, cache),
        createdAt: row.createdAt,
      });
    }
    pending.sort((a, b) => b.createdAt - a.createdAt);
    if (pending.length) {
      const credSnaps = await db.getAll(
        ...pending.map((item) => db.collection('studentCredentials').doc(item.studentId)),
      );
      const credById = new Map(credSnaps.map((snap) => [snap.id, snap.data()]));
      for (const item of pending) {
        item.hasCredential = Boolean(credById.get(item.studentId));
      }
    }
    return { ok: true, body: { enabled: true, scope: 'pending', rows: [], pending } };
  }

  const classSnap = await db.collection('classes').doc(code).get();
  if (!classSnap.exists || classSnap.data()?.pinRequired !== true) {
    return { ok: true, body: { enabled: false, scope: 'class', rows: [], pending: [] } };
  }

  const enrollmentSnap = await db.collection('classEnrollments').where('classCode', '==', code).get();
  let students = [];
  if (!enrollmentSnap.empty) {
    const rows = enrollmentSnap.docs
      .map((doc) => doc.data())
      .filter((row) => row.status === 'active' || row.status === 'completed');
    const nameSnaps = rows.length
      ? await db.getAll(...rows.map((row) => db.collection('students').doc(row.studentId)))
      : [];
    const nameById = new Map(nameSnaps.map((snap) => [snap.id, String(snap.data()?.fullName || '').trim()]));
    students = rows.map((row) => ({ id: row.studentId, fullName: nameById.get(row.studentId) || 'Học sinh' }));
  } else {
    const studentsSnap = await db.collection('students').where('classId', '==', code).get();
    students = studentsSnap.docs.map((doc) => ({
      id: doc.id,
      fullName: String(doc.data()?.fullName || '').trim(),
    }));
  }
  students.sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
  if (!students.length) {
    return { ok: true, body: { enabled: true, scope: 'class', rows: [], pending: [] } };
  }

  const credSnaps = await db.getAll(
    ...students.map((student) => db.collection('studentCredentials').doc(student.id)),
  );
  const credById = new Map(credSnaps.map((snap) => [snap.id, credentialView(snap.data())]));
  const requestsByStudent = new Map();
  const chunks = [];
  for (let index = 0; index < students.length; index += 30) {
    chunks.push(students.slice(index, index + 30).map((student) => student.id));
  }
  const requestSnaps = await Promise.all(
    chunks.map((chunk) => db.collection('pinResetRequests').where('studentId', 'in', chunk).get()),
  );
  for (const reqSnap of requestSnaps) {
    for (const doc of reqSnap.docs) {
      const row = requestView(doc);
      const current = requestsByStudent.get(row.studentId);
      if (!current || row.createdAt >= current.createdAt) requestsByStudent.set(row.studentId, row);
    }
  }

  const rows = students.map((student) => boardRow(
    student,
    code,
    credById.get(student.id) || null,
    requestsByStudent.get(student.id) || null,
  ));
  const pending = rows
    .filter((row) => row.status === 'Chờ reset' && row.requestId)
    .map((row) => ({
      requestId: row.requestId,
      studentId: row.studentId,
      classCode: code,
      fullName: row.fullName,
      createdAt: requestsByStudent.get(row.studentId)?.createdAt || 0,
      hasCredential: row.hasCredential,
    }));

  return { ok: true, body: { enabled: true, scope: 'class', rows, pending } };
}

export async function countPendingPinResets(db) {
  const snap = await db.collection('pinResetRequests').where('status', '==', 'pending').get();
  return { ok: true, body: { pending: snap.size } };
}

export async function recordAccessCodeAudit(db, { classCode, studentAccessCode, email }) {
  await db.collection('pinAudit').add({
    type: 'access-code',
    classCode,
    studentAccessCode,
    email: email || '',
    at: FieldValue.serverTimestamp(),
  });
  return { ok: true, body: { ok: true } };
}
