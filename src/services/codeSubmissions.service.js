import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { getClass, isArchivedClassStatus, listClasses } from './classes.service.js';
import { toCodeSubmissionModel } from '../models/index.js';
import {
  CODE_SUBMISSION_MAX_FILE_BYTES,
  CODE_SUBMISSION_MAX_FILES_PER_SESSION,
  CODE_SUBMISSION_RETENTION_DAYS,
  codeSubmissionDocId,
  sanitizeCodeFileName,
  validateCodeSubmissionFile,
} from '../lib/codeSubmissionLimits.js';

const COL = 'projectCodeSubmissions';

function submissionDocRef(classCode, studentId, sessionNumber) {
  return doc(db, COL, codeSubmissionDocId(classCode, studentId, sessionNumber));
}

function fileContentRef(classCode, studentId, sessionNumber, fileId) {
  return doc(db, COL, codeSubmissionDocId(classCode, studentId, sessionNumber), 'files', fileId);
}

export function subscribeCodeSubmissionsByStudent(classCode, studentId, onData, onError) {
  if (!studentId) return () => {};
  const q = classCode
    ? query(
        collection(db, COL),
        where('classCode', '==', classCode),
        where('studentId', '==', studentId),
      )
    : query(collection(db, COL), where('studentId', '==', studentId));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => toCodeSubmissionModel(d));
      rows.sort((a, b) => Number(a.sessionNumber) - Number(b.sessionNumber));
      onData(rows);
    },
    onError,
  );
}

export async function listCodeSubmissionsByStudent(classCode, studentId) {
  if (!studentId) return [];
  const q = classCode
    ? query(
        collection(db, COL),
        where('classCode', '==', classCode),
        where('studentId', '==', studentId),
      )
    : query(collection(db, COL), where('studentId', '==', studentId));
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => toCodeSubmissionModel(d));
  rows.sort((a, b) => Number(a.sessionNumber) - Number(b.sessionNumber));
  return rows;
}

export async function listCodeSubmissionsByClass(classCode) {
  if (!classCode) return [];
  const q = query(collection(db, COL), where('classCode', '==', classCode));
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => toCodeSubmissionModel(d));
  rows.sort((a, b) => {
    const byStudent = String(a.studentName).localeCompare(String(b.studentName), 'vi');
    if (byStudent !== 0) return byStudent;
    return Number(a.sessionNumber) - Number(b.sessionNumber);
  });
  return rows;
}

export function summarizeCodeSubmissions(submissions = []) {
  const byStudent = new Map();
  for (const row of submissions) {
    const fileCount = row.files?.length ?? 0;
    if (!fileCount) continue;
    const prev = byStudent.get(row.studentId) ?? {
      studentId: row.studentId,
      studentName: row.studentName,
      sessionCount: 0,
      fileCount: 0,
      latestSession: 0,
    };
    prev.sessionCount += 1;
    prev.fileCount += fileCount;
    prev.latestSession = Math.max(prev.latestSession, Number(row.sessionNumber) || 0);
    prev.studentName = row.studentName || prev.studentName;
    byStudent.set(row.studentId, prev);
  }
  return byStudent;
}

export async function uploadCodeFile({ classCode, studentId, studentName, sessionNumber, file }) {
  const validation = validateCodeSubmissionFile(file);
  if (validation.error) throw new Error(validation.error);

  const parentRef = submissionDocRef(classCode, studentId, sessionNumber);
  const docSnap = await getDoc(parentRef);
  const currentFiles = docSnap.exists() ? docSnap.data().files || [] : [];
  if (currentFiles.length >= CODE_SUBMISSION_MAX_FILES_PER_SESSION) {
    throw new Error(`Tối đa ${CODE_SUBMISSION_MAX_FILES_PER_SESSION} file mỗi buổi.`);
  }

  const content = await file.text();
  if (content.length > CODE_SUBMISSION_MAX_FILE_BYTES) {
    throw new Error(`File tối đa ${Math.round(CODE_SUBMISSION_MAX_FILE_BYTES / 1024)} KB.`);
  }

  const fileId = crypto.randomUUID();
  const safeName = sanitizeCodeFileName(file.name);
  const contentType = file.type || 'text/plain';

  const entry = {
    id: fileId,
    name: safeName,
    contentType,
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
  };

  // Firestore rules for file content require the parent doc to already exist
  // (batch writes cannot see sibling ops in the same commit).
  if (!docSnap.exists()) {
    await setDoc(parentRef, {
      classCode,
      studentId,
      studentName,
      sessionNumber: Number(sessionNumber),
      files: [],
      updatedAt: serverTimestamp(),
    });
    currentFiles = [];
  }

  const batch = writeBatch(db);
  batch.set(fileContentRef(classCode, studentId, sessionNumber, fileId), { content });
  batch.update(parentRef, {
    files: [...currentFiles, entry],
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return entry;
}

export async function deleteCodeFile({ classCode, studentId, sessionNumber, fileId }) {
  const parentRef = submissionDocRef(classCode, studentId, sessionNumber);
  const docSnap = await getDoc(parentRef);
  if (!docSnap.exists()) return;

  const files = docSnap.data().files || [];
  if (!files.some((f) => f.id === fileId)) return;

  const batch = writeBatch(db);
  batch.delete(fileContentRef(classCode, studentId, sessionNumber, fileId));

  const remaining = files.filter((f) => f.id !== fileId);
  if (remaining.length) {
    batch.update(parentRef, {
      files: remaining,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.delete(parentRef);
  }

  await batch.commit();
}

function parseClassEndDate(endDate) {
  if (!endDate || typeof endDate !== 'string') return null;
  const parsed = new Date(`${endDate}T23:59:59`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolveClassCompletedAt(classDoc) {
  if (classDoc?.completedAt) return classDoc.completedAt;
  const fromEndDate = parseClassEndDate(classDoc?.endDate);
  if (fromEndDate) return fromEndDate;
  return classDoc?.updatedAt ?? null;
}

export function isClassEligibleForCodePurge(classDoc, retentionDays = CODE_SUBMISSION_RETENTION_DAYS) {
  if (!classDoc || classDoc.codeSubmissionsPurgedAt) return false;
  if (!isArchivedClassStatus(classDoc.status)) return false;
  const completedAt = resolveClassCompletedAt(classDoc);
  if (!completedAt?.getTime) return false;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  return completedAt.getTime() <= cutoff;
}

export async function deleteAllCodeSubmissionsForClass(classCode) {
  const submissions = await listCodeSubmissionsByClass(classCode);
  if (!submissions.length) return 0;

  let deletedFiles = 0;
  for (const row of submissions) {
    const batch = writeBatch(db);
    let ops = 0;
    for (const file of row.files) {
      batch.delete(fileContentRef(row.classCode, row.studentId, row.sessionNumber, file.id));
      ops += 1;
      deletedFiles += 1;
    }
    batch.delete(submissionDocRef(row.classCode, row.studentId, row.sessionNumber));
    ops += 1;
    if (ops > 0) await batch.commit();
  }
  return deletedFiles;
}

export async function purgeExpiredCodeSubmissions({
  retentionDays = CODE_SUBMISSION_RETENTION_DAYS,
} = {}) {
  const classes = await listClasses();
  const results = [];

  for (const classDoc of classes) {
    if (!isClassEligibleForCodePurge(classDoc, retentionDays)) continue;
    const result = await purgeCodeSubmissionsForClass(classDoc.classCode, { force: true });
    results.push(result);
  }

  return results;
}

export async function purgeCodeSubmissionsForClass(classCode, { force = false } = {}) {
  const classDoc = await getClass(classCode);
  if (!classDoc) throw new Error('Không tìm thấy lớp.');
  if (!isArchivedClassStatus(classDoc.status)) {
    throw new Error('Chỉ dọn file code của lớp đã hoàn thành hoặc lưu trữ.');
  }
  if (!force && !isClassEligibleForCodePurge(classDoc)) {
    const completedAt = resolveClassCompletedAt(classDoc);
    const purgeAt = completedAt
      ? new Date(completedAt.getTime() + CODE_SUBMISSION_RETENTION_DAYS * 24 * 60 * 60 * 1000)
      : null;
    const daysLeft = purgeAt
      ? Math.max(0, Math.ceil((purgeAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : CODE_SUBMISSION_RETENTION_DAYS;
    throw new Error(`Lớp chưa tới hạn tự dọn (còn ~${daysLeft} ngày). Bấm "Dọn ngay" để xóa thủ công.`);
  }

  const deletedFiles = await deleteAllCodeSubmissionsForClass(classCode);
  await updateDoc(doc(db, 'classes', classCode), {
    codeSubmissionsPurgedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { classCode, deletedFiles };
}

export async function summarizeCodeSubmissionsAllClasses() {
  const snap = await getDocs(collection(db, COL));
  const byClass = new Map();
  for (const docSnap of snap.docs) {
    const row = toCodeSubmissionModel(docSnap);
    const prev = byClass.get(row.classCode) ?? { sessionCount: 0, fileCount: 0 };
    prev.sessionCount += 1;
    prev.fileCount += row.files?.length ?? 0;
    byClass.set(row.classCode, prev);
  }
  return byClass;
}
