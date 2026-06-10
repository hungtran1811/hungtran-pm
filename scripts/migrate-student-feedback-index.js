/**
 * Backfill studentFeedbackIndex from knowledgeReports (one doc per class+student).
 *
 * Usage:
 *   node scripts/migrate-student-feedback-index.js --dry-run
 *   node scripts/migrate-student-feedback-index.js
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const dryRun = process.argv.includes('--dry-run');
const projectId = process.env.FIREBASE_PROJECT_ID || 'hungtran-pm';

initializeApp({ credential: applicationDefault(), projectId });

const db = getFirestore();

async function main() {
  console.log(`Project: ${projectId} · dry-run: ${dryRun}`);
  const snapshot = await db.collection('knowledgeReports').get();
  const byIndex = new Map();

  snapshot.docs.forEach((doc) => {
    const { classCode, studentId, lessonId } = doc.data();
    if (!classCode || !studentId || !lessonId) return;
    const indexId = `${classCode}__${studentId}`;
    if (!byIndex.has(indexId)) {
      byIndex.set(indexId, { classCode, studentId, lessonIds: new Set() });
    }
    byIndex.get(indexId).lessonIds.add(lessonId);
  });

  console.log(`Found ${byIndex.size} student indexes from ${snapshot.size} reports`);

  if (dryRun) return;

  const entries = [...byIndex.entries()];
  const chunkSize = 400;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const batch = db.batch();
    entries.slice(i, i + chunkSize).forEach(([indexId, row]) => {
      batch.set(
        db.collection('studentFeedbackIndex').doc(indexId),
        {
          classCode: row.classCode,
          studentId: row.studentId,
          lessonIds: [...row.lessonIds],
          updatedAt: new Date(),
        },
        { merge: true },
      );
    });
    await batch.commit();
    console.log(`  Wrote ${Math.min(i + chunkSize, entries.length)}/${entries.length}`);
  }

  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
