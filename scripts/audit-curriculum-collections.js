/**
 * Audit curriculum-related Firestore paths for ID mismatches.
 * Usage: node scripts/audit-curriculum-collections.js
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID || 'hungtran-pm';
const ALIASES = {
  'python-app-basic': 'python-basic',
  'python-app-advanced': 'python-advanced',
};

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

function candidates(id) {
  const set = new Set([id]);
  const canonical = ALIASES[id] ?? id;
  set.add(canonical);
  for (const [legacy, can] of Object.entries(ALIASES)) {
    if (can === canonical) set.add(legacy);
  }
  return [...set];
}

async function auditProgram(docSnap) {
  const id = docSnap.id;
  const data = docSnap.data();
  const issues = [];

  const embedded = Array.isArray(data.lessons) ? data.lessons.length : 0;
  const indexLen = Array.isArray(data.lessonIndex) ? data.lessonIndex.length : 0;
  const storage = data.lessonsStorage ?? 'embedded';

  let subCount = 0;
  for (const c of candidates(id)) {
    const snap = await db.collection('curriculumPrograms').doc(c).collection('lessons').get();
    if (c === id) subCount = snap.size;
    if (c !== id && snap.size > 0) {
      issues.push(`lessons ở path khác: curriculumPrograms/${c}/lessons (${snap.size} docs)`);
    }
  }

  if (storage === 'subcollection' && subCount === 0 && indexLen > 0) {
    issues.push(`lessonsStorage=subcollection nhưng subcollection trống (lessonIndex=${indexLen})`);
  }
  if (storage === 'subcollection' && embedded > 0) {
    issues.push(`vừa có embedded lessons[] (${embedded}) vừa subcollection`);
  }
  if (storage !== 'subcollection' && embedded === 0 && indexLen === 0 && subCount > 0) {
    issues.push(`có subcollection (${subCount}) nhưng lessonsStorage không phải subcollection`);
  }

  const lessonIds = new Set();
  if (storage === 'subcollection' && indexLen) {
    for (const row of data.lessonIndex) lessonIds.add(row.id);
  }
  for (const row of data.lessonIndex ?? []) {
    for (const c of candidates(id)) {
      const quizId = `${c}__${row.id}`;
      const [pub, ans, pracPub, pracAns] = await Promise.all([
        db.collection('quizPublicQuestionBanks').doc(quizId).get(),
        db.collection('quizQuestionBanks').doc(quizId).get(),
        db.collection('practiceQuizPublicBanks').doc(quizId).get(),
        db.collection('practiceQuizAnswerBanks').doc(quizId).get(),
      ]);
      const found = [];
      if (pub.exists) found.push('quizPublic');
      if (ans.exists) found.push('quizAnswer');
      if (pracPub.exists) found.push('practicePublic');
      if (pracAns.exists) found.push('practiceAnswer');
      if (found.length && c !== id) {
        issues.push(
          `quiz/ôn tập dùng prefix "${c}__" (doc chương trình là "${id}") — đọc OK nếu app thử mọi prefix`,
        );
      }
    }
  }

  return {
    id,
    name: data.name,
    storage,
    embedded,
    indexLen,
    subCount,
    issues,
  };
}

async function main() {
  console.log(`Audit curriculum · project=${projectId}\n`);
  const programs = await db.collection('curriculumPrograms').get();
  let totalIssues = 0;

  for (const doc of programs.docs) {
    const r = await auditProgram(doc);
    const flag = r.issues.length ? '⚠' : '✓';
    console.log(`${flag} ${r.id} (${r.name})`);
    console.log(
      `   storage=${r.storage} embedded=${r.embedded} index=${r.indexLen} subcollection=${r.subCount}`,
    );
    for (const issue of r.issues) {
      console.log(`   → ${issue}`);
      totalIssues += 1;
    }
    console.log('');
  }

  const classes = await db.collection('classes').get();
  console.log('--- Classes curriculumProgramId ---');
  for (const c of classes.docs) {
    const pid = c.data().curriculumProgramId;
    const prog = pid ? await db.collection('curriculumPrograms').doc(pid).get() : null;
    const canonical = ALIASES[pid] ?? pid;
    const canonicalExists = canonical !== pid ? (await db.collection('curriculumPrograms').doc(canonical).get()).exists : false;
    if (pid && !prog?.exists) {
      console.log(`⚠ class ${c.id}: curriculumProgramId="${pid}" — doc MISSING`);
      totalIssues += 1;
    } else if (canonicalExists && pid && ALIASES[pid]) {
      console.log(`ℹ class ${c.id}: dùng legacy id "${pid}" (canonical "${canonical}" cũng tồn tại)`);
    } else if (pid) {
      console.log(`✓ class ${c.id}: curriculumProgramId="${pid}"`);
    }
  }

  console.log(`\nTổng vấn đề: ${totalIssues}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
