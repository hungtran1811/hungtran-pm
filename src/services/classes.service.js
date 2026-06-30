import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { isArchivedClassStatus, isOperationalClassStatus } from '../lib/classStatus.js';
import { toClassModel } from '../models/index.js';

export { isArchivedClassStatus, isOperationalClassStatus };

/** Lớp đang vận hành hoặc đã hoàn thành (dùng cho thống kê). */
export function filterClassesForAnalytics(classes, showArchived = false) {
  return classes.filter((c) => {
    if (isOperationalClassStatus(c.status)) return true;
    if (showArchived && c.status === 'archived') return true;
    return false;
  });
}

const CLASS_STATUS_SORT_ORDER = { active: 0, completed: 1, archived: 2 };

/** Ưu tiên lớp đang hoạt động, sau đó đã hoàn thành, cuối cùng lưu trữ. */
export function sortClassesByOperationalPriority(classes) {
  return [...classes].sort((a, b) => {
    const orderA = CLASS_STATUS_SORT_ORDER[a.status] ?? 9;
    const orderB = CLASS_STATUS_SORT_ORDER[b.status] ?? 9;
    if (orderA !== orderB) return orderA - orderB;
    return (a.classCode || '').localeCompare(b.classCode || '', 'vi');
  });
}

const classesRef = collection(db, 'classes');

export async function listClasses(max = 200) {
  const snapshot = await getDocs(query(classesRef, orderBy('createdAt', 'desc'), limit(max)));
  return snapshot.docs.map(toClassModel);
}

export function subscribeClasses(onData, onError, max = 200) {
  const q = query(classesRef, orderBy('createdAt', 'desc'), limit(max));
  return onSnapshot(
    q,
    (snapshot) => onData(snapshot.docs.map(toClassModel)),
    onError,
  );
}

export function subscribeClass(classCode, onData, onError) {
  if (!classCode) return () => {};
  return onSnapshot(
    doc(db, 'classes', classCode),
    (snapshot) => onData(snapshot.exists() ? toClassModel(snapshot) : null),
    onError,
  );
}

export async function listPublicClasses() {
  const snapshot = await getDocs(
    query(classesRef, where('status', '==', 'active'), where('hidden', '==', false)),
  );
  return snapshot.docs.map(toClassModel);
}

export async function getClass(classCode) {
  const snapshot = await getDoc(doc(db, 'classes', classCode));
  return snapshot.exists() ? toClassModel(snapshot) : null;
}

export async function createClass(classCode, payload) {
  const ref = doc(db, 'classes', classCode.trim());
  const existing = await getDoc(ref);
  if (existing.exists()) {
    throw new Error('Mã lớp đã tồn tại. Vui lòng chọn mã khác.');
  }
  await setDoc(ref, {
    classCode: classCode.trim(),
    className: payload.className?.trim() ?? '',
    status: payload.status ?? 'active',
    hidden: Boolean(payload.hidden ?? false),
    startDate: payload.startDate ?? '',
    endDate: payload.endDate ?? '',
    curriculumProgramId: payload.curriculumProgramId ?? '',
    curriculumPhase: payload.curriculumPhase ?? 'learning',
    curriculumCurrentSession: Number(payload.curriculumCurrentSession ?? 0),
    curriculumExerciseVisibleSessions: payload.curriculumExerciseVisibleSessions ?? [],
    finalMode: payload.finalMode === 'exam' ? 'exam' : 'project',
    studentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

function applyClassArchiveTimestamps(patch, previousStatus, nextStatus) {
  const enteringArchive = isArchivedClassStatus(nextStatus) && !isArchivedClassStatus(previousStatus);
  const leavingArchive = !isArchivedClassStatus(nextStatus) && isArchivedClassStatus(previousStatus);
  if (enteringArchive) {
    patch.completedAt = serverTimestamp();
    patch.codeSubmissionsPurgedAt = deleteField();
  }
  if (leavingArchive) {
    patch.completedAt = deleteField();
    patch.codeSubmissionsPurgedAt = deleteField();
  }
}

export async function updateClass(classCode, payload) {
  const ref = doc(db, 'classes', classCode);
  const existing = await getDoc(ref);
  const previousStatus = existing.data()?.status ?? 'active';
  const nextStatus = payload.status ?? 'active';
  const patch = {
    className: payload.className?.trim() ?? '',
    status: nextStatus,
    hidden: Boolean(payload.hidden ?? false),
    startDate: payload.startDate ?? '',
    endDate: payload.endDate ?? '',
    curriculumProgramId: payload.curriculumProgramId ?? '',
    curriculumPhase: payload.curriculumPhase ?? 'learning',
    curriculumCurrentSession: Number(payload.curriculumCurrentSession ?? 0),
    curriculumExerciseVisibleSessions: payload.curriculumExerciseVisibleSessions ?? [],
    finalMode: payload.finalMode === 'exam' ? 'exam' : 'project',
    updatedAt: serverTimestamp(),
  };
  applyClassArchiveTimestamps(patch, previousStatus, nextStatus);
  await updateDoc(ref, patch);
}

export async function setClassCurrentSession(classCode, sessionNumber) {
  await updateDoc(doc(db, 'classes', classCode), {
    curriculumCurrentSession: Number(sessionNumber),
    updatedAt: serverTimestamp(),
  });
}

export async function setClassCurriculumQuick(classCode, { sessionNumber, curriculumPhase }) {
  const patch = { updatedAt: serverTimestamp() };
  if (sessionNumber !== undefined && sessionNumber !== null) {
    patch.curriculumCurrentSession = Number(sessionNumber);
  }
  if (curriculumPhase === 'learning' || curriculumPhase === 'final') {
    patch.curriculumPhase = curriculumPhase;
  }
  await updateDoc(doc(db, 'classes', classCode), patch);
}

export async function setClassStatus(classCode, status, previousStatus = 'active') {
  const patch = {
    status,
    updatedAt: serverTimestamp(),
  };
  applyClassArchiveTimestamps(patch, previousStatus, status);
  await updateDoc(doc(db, 'classes', classCode), patch);
}

export async function deleteClass(classCode) {
  await deleteDoc(doc(db, 'classes', classCode));
}
