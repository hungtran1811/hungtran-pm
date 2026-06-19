import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { toStudentModel } from '../models/index.js';
import { normalizeKey } from '../lib/firestore.js';
import { validateProjectLinks } from '../lib/projectLinks.js';
import { isLegacyUnapprovedProject, meaningfulProjectName } from '../lib/classFinalMode.js';
import { DEFAULT_STAGE, DEFAULT_STATUS } from '../constants/index.js';

const studentsRef = collection(db, 'students');

export async function listStudentsByClass(classCode) {
  const snapshot = await getDocs(query(studentsRef, where('classId', '==', classCode)));
  return snapshot.docs.map(toStudentModel).sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
}

export async function listActiveStudentsByClass(classCode) {
  const snapshot = await getDocs(
    query(studentsRef, where('classId', '==', classCode), where('active', '==', true)),
  );
  return snapshot.docs.map(toStudentModel).sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
}

export async function listAllStudents(max = 500) {
  const snapshot = await getDocs(query(studentsRef, orderBy('fullNameKey', 'asc'), limit(max)));
  return snapshot.docs.map(toStudentModel);
}

const CLASS_IN_MAX = 10;

/** Scoped reads for admin dashboards — avoids scanning the whole students collection. */
export async function listStudentsByClassCodes(classCodes, { activeOnly = false } = {}) {
  const unique = [...new Set(classCodes.filter(Boolean))];
  if (!unique.length) return [];

  const chunks = [];
  for (let i = 0; i < unique.length; i += CLASS_IN_MAX) {
    chunks.push(unique.slice(i, i + CLASS_IN_MAX));
  }

  const rows = await Promise.all(
    chunks.map(async (codes) => {
      const snapshot = await getDocs(query(studentsRef, where('classId', 'in', codes)));
      return snapshot.docs.map(toStudentModel);
    }),
  );

  let merged = rows.flat();
  if (activeOnly) merged = merged.filter((s) => s.active);
  return merged.sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
}

function sortStudents(docs) {
  return docs.map(toStudentModel).sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
}

export function subscribeAllStudents(onData, onError, max = 500) {
  const q = query(studentsRef, orderBy('fullNameKey', 'asc'), limit(max));
  return onSnapshot(
    q,
    (snapshot) => onData(snapshot.docs.map(toStudentModel)),
    onError,
  );
}

export function subscribeStudentsByClass(classCode, onData, onError) {
  if (!classCode) return () => {};
  const q = query(studentsRef, where('classId', '==', classCode));
  return onSnapshot(
    q,
    (snapshot) => onData(sortStudents(snapshot.docs)),
    onError,
  );
}

export function subscribeActiveStudentsByClass(classCode, onData, onError) {
  if (!classCode) return () => {};
  const q = query(studentsRef, where('classId', '==', classCode), where('active', '==', true));
  return onSnapshot(
    q,
    (snapshot) => onData(sortStudents(snapshot.docs)),
    onError,
  );
}

export function subscribeStudent(studentId, onData, onError) {
  if (!studentId) return () => {};
  return onSnapshot(
    doc(db, 'students', studentId),
    (snapshot) => onData(snapshot.exists() ? toStudentModel(snapshot) : null),
    onError,
  );
}

export async function markAllStudentsCompletedForClass(classCode) {
  const snapshot = await getDocs(
    query(studentsRef, where('classId', '==', classCode), where('active', '==', true)),
  );
  if (!snapshot.docs.length) return 0;
  const batch = writeBatch(db);
  snapshot.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, {
      currentStatus: 'Hoàn thành',
      currentProgressPercent: 100,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
  return snapshot.docs.length;
}

export async function getStudent(studentId) {
  const snapshot = await getDoc(doc(db, 'students', studentId));
  return snapshot.exists() ? toStudentModel(snapshot) : null;
}

/** HS: ghi nhận đã mở bài giảng (sync server cho giáo viên theo dõi). */
const MAX_OPENED_LESSON_IDS = 200;

export async function recordLessonOpened(studentId, classCode, lessonId, sessionNumber) {
  if (!studentId || !classCode || !lessonId) return;

  const ref = doc(db, 'students', studentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const currentIds = Array.isArray(snap.data().openedLessonIds) ? snap.data().openedLessonIds : [];
  let openedLessonIds = currentIds.includes(lessonId) ? currentIds : [...currentIds, lessonId];
  if (openedLessonIds.length > MAX_OPENED_LESSON_IDS) {
    openedLessonIds = openedLessonIds.slice(openedLessonIds.length - MAX_OPENED_LESSON_IDS);
  }

  const lastOpenedSessionNumber = Math.max(1, Math.min(50, Number(sessionNumber) || 1));

  await updateDoc(ref, {
    lastOpenedLessonId: lessonId,
    lastOpenedSessionNumber,
    lastOpenedAt: serverTimestamp(),
    openedLessonIds,
    updatedAt: serverTimestamp(),
  });
}

export async function createStudent(payload) {
  const classCode = payload.classCode.trim();
  const ref = await addDoc(studentsRef, {
    fullName: payload.fullName.trim(),
    fullNameKey: normalizeKey(payload.fullName),
    classId: classCode,
    classCode,
    active: Boolean(payload.active ?? true),
    projectName: '',
    projectNameSubmission: '',
    projectNameStatus: '',
    projectNameReviewNote: '',
    projectNameSubmittedAt: null,
    projectGithubUrl: '',
    projectCanvaUrl: '',
    currentStatus: payload.currentStatus ?? DEFAULT_STATUS,
    currentStage: payload.currentStage ?? DEFAULT_STAGE,
    currentProgressPercent: Number(payload.currentProgressPercent ?? 0),
    currentDifficulties: payload.currentDifficulties ?? '',
    latestReportId: '',
    lastReportedAt: null,
    progressStalledCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateClassCount(classCode, 1);
  return ref.id;
}

export async function updateStudent(studentId, payload) {
  await updateDoc(doc(db, 'students', studentId), {
    fullName: payload.fullName.trim(),
    fullNameKey: normalizeKey(payload.fullName),
    active: Boolean(payload.active ?? true),
    currentStatus: payload.currentStatus ?? DEFAULT_STATUS,
    currentStage: payload.currentStage ?? DEFAULT_STAGE,
    currentProgressPercent: Number(payload.currentProgressPercent ?? 0),
    currentDifficulties: payload.currentDifficulties ?? '',
    updatedAt: serverTimestamp(),
  });
}

export async function submitProjectName(studentId, projectName) {
  const trimmed = projectName.trim();
  if (trimmed.length < 3) {
    throw new Error('Tên dự án cần ít nhất 3 ký tự.');
  }
  if (trimmed.length > 80) {
    throw new Error('Tên dự án tối đa 80 ký tự.');
  }
  const student = await getStudent(studentId);
  if (!student?.active) {
    throw new Error('Học sinh không hợp lệ.');
  }
  const status = student.projectNameStatus || '';
  if (status === 'pending') {
    throw new Error('Tên dự án đang chờ giáo viên duyệt.');
  }
  if (status === 'approved') {
    throw new Error('Tên dự án đã được duyệt.');
  }
  if (!status && meaningfulProjectName(student.projectName)) {
    throw new Error('Tên dự án đang chờ giáo viên duyệt.');
  }
  await updateDoc(doc(db, 'students', studentId), {
    projectNameSubmission: trimmed,
    projectNameStatus: 'pending',
    projectNameReviewNote: '',
    projectNameSubmittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function submitProjectLinks(studentId, { githubUrl, canvaUrl }) {
  const validated = validateProjectLinks({ githubUrl, canvaUrl });
  if (validated.error) {
    throw new Error(validated.error);
  }
  const student = await getStudent(studentId);
  if (!student?.active) {
    throw new Error('Học sinh không hợp lệ.');
  }
  await updateDoc(doc(db, 'students', studentId), {
    projectGithubUrl: validated.githubUrl,
    projectCanvaUrl: validated.canvaUrl,
    updatedAt: serverTimestamp(),
  });
}

export async function reviewProjectName(studentId, { approved, reviewNote = '' }) {
  const student = await getStudent(studentId);
  const isPending = student?.projectNameStatus === 'pending';
  const isLegacy = isLegacyUnapprovedProject(student);
  if (!student || (!isPending && !isLegacy)) {
    throw new Error('Không có tên dự án đang chờ duyệt.');
  }
  const candidate = meaningfulProjectName(student.projectNameSubmission || student.projectName);
  if (!candidate) {
    throw new Error('Không có tên dự án đang chờ duyệt.');
  }
  const note = reviewNote.trim();
  if (approved) {
    await updateDoc(doc(db, 'students', studentId), {
      projectName: candidate,
      projectNameStatus: 'approved',
      projectNameSubmission: '',
      projectNameReviewNote: note,
      updatedAt: serverTimestamp(),
    });
    return;
  }
  await updateDoc(doc(db, 'students', studentId), {
    projectName: '',
    projectNameStatus: 'rejected',
    projectNameSubmission: candidate,
    projectNameReviewNote: note || 'Giáo viên yêu cầu đặt lại tên dự án.',
    updatedAt: serverTimestamp(),
  });
}

export async function deleteStudent(studentId, classCode) {
  await deleteDoc(doc(db, 'students', studentId));
  if (classCode) {
    await updateClassCount(classCode, -1);
  }
}

async function updateClassCount(classCode, delta) {
  try {
    await updateDoc(doc(db, 'classes', classCode), {
      studentCount: increment(delta),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // class count is a convenience field; ignore if the class doc is missing.
  }
}
