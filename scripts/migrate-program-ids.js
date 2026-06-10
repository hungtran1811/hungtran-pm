/**
 * One-time migration: curriculumPrograms ID rename.
 *
 *   python-app-basic   -> python-basic
 *   python-app-advanced -> python-advanced
 *
 * Usage (from project root):
 *   npx firebase-tools@latest login
 *   node scripts/migrate-program-ids.js --dry-run
 *   node scripts/migrate-program-ids.js
 *
 * Requires Application Default Credentials (firebase login) or
 * GOOGLE_APPLICATION_CREDENTIALS pointing to a service account key.
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const MIGRATIONS = [
  { from: 'python-app-basic', to: 'python-basic' },
  { from: 'python-app-advanced', to: 'python-advanced' },
];

const dryRun = process.argv.includes('--dry-run');
const projectId = process.env.FIREBASE_PROJECT_ID || 'hungtran-pm';

initializeApp({ credential: applicationDefault(), projectId });

const db = getFirestore();

async function migratePair({ from, to }) {
  console.log(`\n--- ${from} -> ${to} ---`);
  const oldRef = db.collection('curriculumPrograms').doc(from);
  const newRef = db.collection('curriculumPrograms').doc(to);

  const [oldSnap, newSnap] = await Promise.all([oldRef.get(), newRef.get()]);

  if (!oldSnap.exists) {
    console.log(`  Skip: source doc "${from}" not found.`);
    return { copied: false, classes: 0, feedbacks: 0 };
  }

  if (newSnap.exists) {
    console.log(`  Target "${to}" already exists — skipping copy.`);
  } else if (dryRun) {
    console.log(`  [dry-run] Would copy curriculumPrograms/${from} -> ${to}`);
  } else {
    await newRef.set(oldSnap.data());
    console.log(`  Copied curriculumPrograms/${from} -> ${to}`);
  }

  const classesSnap = await db.collection('classes').where('curriculumProgramId', '==', from).get();
  console.log(`  Classes to update: ${classesSnap.size}`);
  if (!dryRun) {
    const batch = db.batch();
    classesSnap.docs.forEach((d) => batch.update(d.ref, { curriculumProgramId: to }));
    if (classesSnap.size) await batch.commit();
  }

  const feedbacksSnap = await db
    .collection('knowledgeReports')
    .where('curriculumProgramId', '==', from)
    .get();
  console.log(`  Knowledge reports to update: ${feedbacksSnap.size}`);
  if (!dryRun && feedbacksSnap.size) {
    let batch = db.batch();
    let count = 0;
    for (const d of feedbacksSnap.docs) {
      batch.update(d.ref, { curriculumProgramId: to });
      count += 1;
      if (count % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    if (count % 400 !== 0) await batch.commit();
  }

  if (newSnap.exists || !dryRun) {
    if (dryRun) {
      console.log(`  [dry-run] Would delete curriculumPrograms/${from}`);
    } else if (oldSnap.exists) {
      await oldRef.delete();
      console.log(`  Deleted old doc curriculumPrograms/${from}`);
    }
  }

  return {
    copied: !newSnap.exists && oldSnap.exists,
    classes: classesSnap.size,
    feedbacks: feedbacksSnap.size,
  };
}

async function main() {
  console.log(`Project: ${projectId}`);
  console.log(dryRun ? 'MODE: dry-run (no writes)' : 'MODE: live migration');

  for (const pair of MIGRATIONS) {
    await migratePair(pair);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
