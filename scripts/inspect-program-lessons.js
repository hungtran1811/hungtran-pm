/**
 * Inspect where lesson data lives for a curriculum program.
 * Usage: node scripts/inspect-program-lessons.js [programId]
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const programId = process.argv[2] || 'python-app-basic';
const projectId = process.env.FIREBASE_PROJECT_ID || 'hungtran-pm';

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const CANDIDATE_IDS = [
  programId,
  'python-app-basic',
  'python-basic',
  'python-app-advanced',
  'python-advanced',
  'python-intensive',
];

async function inspectDoc(id) {
  const ref = db.collection('curriculumPrograms').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`\n[${id}] doc: MISSING`);
    return;
  }
  const data = snap.data();
  const embedded = Array.isArray(data.lessons) ? data.lessons.length : 0;
  const index = Array.isArray(data.lessonIndex) ? data.lessonIndex.length : 0;
  console.log(`\n[${id}] doc: EXISTS`);
  console.log(`  name: ${data.name ?? '—'}`);
  console.log(`  lessonsStorage: ${data.lessonsStorage ?? '—'}`);
  console.log(`  embedded lessons[]: ${embedded}`);
  console.log(`  lessonIndex[]: ${index}`);

  const lessonsSnap = await ref.collection('lessons').get();
  console.log(`  subcollection lessons/: ${lessonsSnap.size}`);
  if (lessonsSnap.size) {
    lessonsSnap.docs.slice(0, 3).forEach((d) => {
      const l = d.data();
      const md = (l.lectureMarkdown || l.contentMarkdown || '').length;
      console.log(`    - ${d.id} buổi ${l.sessionNumber}: "${l.title}" (${md} chars markdown)`);
    });
    if (lessonsSnap.size > 3) console.log(`    ... +${lessonsSnap.size - 3} more`);
  }
}

async function main() {
  console.log(`Project: ${projectId}`);
  const ids = [...new Set(CANDIDATE_IDS)];
  for (const id of ids) {
    await inspectDoc(id);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
