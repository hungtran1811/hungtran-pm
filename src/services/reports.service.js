import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { toReportModel } from '../models/index.js';
import { dateKey } from '../lib/firestore.js';
import { validateProjectLinks } from '../lib/projectLinks.js';

const reportsRef = collection(db, 'reports');

export async function getReport(reportId) {
  if (!reportId) return null;
  const snapshot = await getDoc(doc(db, 'reports', reportId));
  return snapshot.exists() ? toReportModel(snapshot) : null;
}

/** Latest report doc per student via denormalized latestReportId on student records. */
export async function loadLatestReportsForStudents(students) {
  const uniqueIds = [...new Set(students.map((s) => s.latestReportId).filter(Boolean))];
  if (!uniqueIds.length) return new Map();

  const snapshots = await Promise.all(uniqueIds.map((id) => getDoc(doc(db, 'reports', id))));
  const byStudentId = new Map();
  snapshots.forEach((snapshot) => {
    if (!snapshot.exists()) return;
    const model = toReportModel(snapshot);
    byStudentId.set(model.studentId, model);
  });
  return byStudentId;
}

export function reportFromStudentSnapshot(student) {
  if (!student?.lastReportedAt) return null;
  return {
    id: student.latestReportId || `snapshot-${student.id}`,
    classId: student.classCode,
    classCode: student.classCode,
    studentId: student.id,
    studentName: student.fullName,
    projectName: student.projectName || '',
    progressPercent: Number(student.currentProgressPercent ?? 0),
    stage: student.currentStage,
    status: student.currentStatus,
    doneToday: '—',
    nextGoal: '—',
    difficulties: student.currentDifficulties || '',
    projectGithubUrl: student.projectGithubUrl || '',
    projectCanvaUrl: student.projectCanvaUrl || '',
    submittedAt: student.lastReportedAt,
    submittedDateKey: '',
    source: 'student-snapshot',
    createdAt: student.lastReportedAt,
    snapshotOnly: true,
  };
}

export async function listReportsByClass(classCode, max = 200) {
  const snapshot = await getDocs(
    query(reportsRef, where('classId', '==', classCode), orderBy('submittedAt', 'desc'), limit(max)),
  );
  return snapshot.docs.map(toReportModel);
}

export function subscribeReportsByClass(classCode, onData, onError, max = 200) {
  const q = query(
    reportsRef,
    where('classId', '==', classCode),
    orderBy('submittedAt', 'desc'),
    limit(max),
  );
  return onSnapshot(
    q,
    (snapshot) => onData(snapshot.docs.map(toReportModel)),
    onError,
  );
}

export function subscribeReportsByStudent(studentId, onData, onError, max = 20) {
  if (!studentId) return () => {};
  const q = query(
    reportsRef,
    where('studentId', '==', studentId),
    orderBy('submittedAt', 'desc'),
    limit(max),
  );
  return onSnapshot(
    q,
    (snapshot) => onData(snapshot.docs.map(toReportModel)),
    onError,
  );
}

export async function listReportsByStudent(studentId, max = 50) {
  const snapshot = await getDocs(
    query(reportsRef, where('studentId', '==', studentId), orderBy('submittedAt', 'desc'), limit(max)),
  );
  return snapshot.docs.map(toReportModel);
}

// Submits a final-product progress report. Mirrors firestore.rules: the report
// document and the student snapshot update MUST happen in one atomic batch so
// `getAfter` cross-checks pass (latestReportId -> the report being created).
export async function submitProgressReport({ student, classDoc, form }) {
  const batch = writeBatch(db);
  const reportRef = doc(collection(db, 'reports'));
  const studentRef = doc(db, 'students', student.id);

  const progressPercent = Number(form.progressPercent);
  const difficulties = form.difficulties?.trim() ?? '';
  const linkValidation = validateProjectLinks({
    githubUrl: form.projectGithubUrl ?? student.projectGithubUrl ?? '',
    canvaUrl: form.projectCanvaUrl ?? student.projectCanvaUrl ?? '',
  });
  if (linkValidation.error) {
    throw new Error(linkValidation.error);
  }

  batch.set(reportRef, {
    classId: classDoc.classCode,
    classCode: classDoc.classCode,
    studentId: student.id,
    studentName: student.fullName,
    projectName: student.projectName,
    progressPercent,
    stage: form.stage,
    status: form.status,
    doneToday: form.doneToday.trim(),
    nextGoal: form.nextGoal.trim(),
    difficulties,
    projectGithubUrl: linkValidation.githubUrl,
    projectCanvaUrl: linkValidation.canvaUrl,
    submittedAt: serverTimestamp(),
    submittedDateKey: dateKey(),
    source: 'student-form',
    createdAt: serverTimestamp(),
  });

  const stalled =
    progressPercent <= Number(student.currentProgressPercent ?? 0)
      ? Number(student.progressStalledCount ?? 0) + 1
      : 0;

  batch.update(studentRef, {
    currentProgressPercent: progressPercent,
    currentStage: form.stage,
    currentStatus: form.status,
    currentDifficulties: difficulties,
    projectGithubUrl: linkValidation.githubUrl,
    projectCanvaUrl: linkValidation.canvaUrl,
    lastReportedAt: serverTimestamp(),
    latestReportId: reportRef.id,
    progressStalledCount: stalled,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return reportRef.id;
}
