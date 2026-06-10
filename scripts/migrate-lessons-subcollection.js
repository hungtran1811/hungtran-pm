/**
 * Migrate embedded curriculumPrograms.lessons[] to subcollection lessons/.
 *
 * Usage (from project root):
 *   npx firebase-tools@latest login
 *   node scripts/migrate-lessons-subcollection.js --dry-run
 *   node scripts/migrate-lessons-subcollection.js
 */

import { FieldValue, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const dryRun = process.argv.includes('--dry-run');
const projectId = process.env.FIREBASE_PROJECT_ID || 'hungtran-pm';

initializeApp({ credential: applicationDefault(), projectId });

const db = getFirestore();

function toSlimLessonIndex(lesson) {
  return {
    id: lesson.id,
    sessionNumber: Number(lesson.sessionNumber) || 1,
    title: lesson.title ?? '',
    archived: Boolean(lesson.archived),
    exerciseVisible: Boolean(lesson.exerciseVisible),
    bannerImage: lesson.bannerImage ?? null,
    coverImage: lesson.coverImage ?? null,
    images: Array.isArray(lesson.images) ? lesson.images : [],
  };
}

async function migrateProgram(programId, data) {
  if (data.lessonsStorage === 'subcollection') {
    console.log(`  Skip ${programId}: already subcollection`);
    return { skipped: true };
  }
  const lessons = Array.isArray(data.lessons) ? data.lessons : [];
  if (!lessons.length) {
    console.log(`  Skip ${programId}: no embedded lessons`);
    return { skipped: true };
  }

  console.log(`  ${programId}: ${lessons.length} lessons`);
  if (dryRun) return { dryRun: true, count: lessons.length };

  const batch = db.batch();
  const programRef = db.collection('curriculumPrograms').doc(programId);

  lessons.forEach((lesson) => {
    if (!lesson?.id) return;
    batch.set(programRef.collection('lessons').doc(lesson.id), lesson, { merge: true });
  });

  batch.update(programRef, {
    lessonIndex: lessons.map(toSlimLessonIndex),
    lessonsStorage: 'subcollection',
    lessons: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
  return { migrated: true, count: lessons.length };
}

async function main() {
  console.log(`Project: ${projectId} · dry-run: ${dryRun}`);
  const snapshot = await db.collection('curriculumPrograms').get();
  let migrated = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const result = await migrateProgram(doc.id, doc.data());
    if (result.skipped) skipped += 1;
    else if (result.migrated || result.dryRun) migrated += 1;
  }

  console.log(`\nDone. processed=${snapshot.size} migrated=${migrated} skipped=${skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
