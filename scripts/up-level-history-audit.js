/**
 * Dry-run audit for Up Level history. Refuses to run unless FIRESTORE_EMULATOR_HOST is set.
 * Never targets production. --apply backfills missing enrollments and snapshots only.
 *
 * Rollback: call the admin action { action: 'rollback', sourceClassCode } before the new class
 * is published. After publish, do not delete reports; restore from the emulator/export backup.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refusing to audit live Firestore. Set FIRESTORE_EMULATOR_HOST or export a copy into the emulator.');
  process.exit(1);
}

const apply = process.argv.includes('--apply');
const app = getApps()[0] || initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-hungtran-pm-rules' });
const db = getFirestore(app);

const students = await db.collection('students').get();
let missingEnrollment = 0;
let missingSnapshot = 0;
let pinCipher = 0;
for (const student of students.docs) {
  const data = student.data() || {};
  const classCode = data.classId || data.classCode || '';
  if (!classCode) continue;
  const enrollmentId = `${classCode}__${student.id}`;
  const enrollment = await db.collection('classEnrollments').doc(enrollmentId).get();
  const state = await db.collection('classStudentStates').doc(enrollmentId).get();
  if (!enrollment.exists) missingEnrollment += 1;
  if (!state.exists) missingSnapshot += 1;
  const credential = await db.collection('studentCredentials').doc(student.id).get();
  if (credential.exists && credential.data()?.pinCipher) pinCipher += 1;
  if (!apply) continue;
  if (!enrollment.exists) {
    await enrollment.ref.set({
      classCode,
      studentId: student.id,
      status: 'active',
      createdAt: new Date().toISOString(),
    });
  }
  if (!state.exists) {
    await state.ref.set({
      classCode,
      studentId: student.id,
      currentProgressPercent: Number(data.currentProgressPercent) || 0,
      projectName: data.projectName || '',
      projectTopic: data.projectTopic || '',
      latestReportId: data.latestReportId || '',
    });
  }
}

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run',
  students: students.size,
  missingEnrollment,
  missingSnapshot,
  pinCipher,
}, null, 2));
