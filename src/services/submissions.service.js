import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { toDriveSubmissionModel } from '../models/index.js';
import { nextLatestSubmission, sortAdminSubmissions } from '../lib/submissionAdmin.js';

const COL = 'submissions';

export async function listSubmissionsByClass(classCode) {
  const code = String(classCode || '').trim();
  if (!code) return [];
  const snap = await getDocs(query(collection(db, COL), where('classCode', '==', code)));
  return sortAdminSubmissions(snap.docs.map((docSnap) => toDriveSubmissionModel(docSnap)));
}

export async function deleteDriveSubmissionAsAdmin(submission, sameLessonRows = []) {
  if (!submission?.id) throw new Error('Thiếu bài nộp.');
  const batch = writeBatch(db);
  batch.delete(doc(db, COL, submission.id));
  if (submission.isLatest) {
    const next = nextLatestSubmission(sameLessonRows, submission.id, submission.lessonKey);
    if (next?.id) batch.update(doc(db, COL, next.id), { isLatest: true });
  }
  await batch.commit();
}

export async function deleteDriveSubmissionsAsAdmin(files = []) {
  const rows = files.filter((row) => row?.id);
  if (!rows.length) return;
  const batch = writeBatch(db);
  rows.forEach((row) => batch.delete(doc(db, COL, row.id)));
  await batch.commit();
}
