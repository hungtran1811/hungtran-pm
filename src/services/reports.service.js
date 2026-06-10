import {
  collection,
  doc,
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

const reportsRef = collection(db, 'reports');

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
    lastReportedAt: serverTimestamp(),
    latestReportId: reportRef.id,
    progressStalledCount: stalled,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return reportRef.id;
}
