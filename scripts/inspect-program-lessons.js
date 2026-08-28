/**
 * Inspect lesson storage and the HTML/Markdown rollout state for curriculum programs.
 * Usage: FIREBASE_PROJECT_ID=your-project node scripts/inspect-program-lessons.js [programId]
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';

const requestedProgramId = process.argv[2] || 'python-app-basic';
const projectId = process.env.FIREBASE_PROJECT_ID || 'hungtran-pm';

const CANDIDATE_IDS = [
  requestedProgramId,
  'python-app-basic',
  'python-basic',
  'python-app-advanced',
  'python-advanced',
  'python-intensive',
];

function byteLength(value) {
  return Buffer.byteLength(typeof value === 'string' ? value : '', 'utf8');
}

function firstStringField(record, names) {
  for (const name of names) {
    if (typeof record?.[name] === 'string') return { name, value: record[name] };
  }
  return null;
}

export function describeLessonFormat(lesson = {}) {
  const rawFormat = lesson.contentFormat;
  const declared = ['html', 'markdown'].includes(lesson.contentFormat)
    ? lesson.contentFormat
    : 'legacy';
  const lectureHtml = firstStringField(lesson, ['lectureHtml']);
  const exerciseHtml = firstStringField(lesson, ['exerciseHtml']);
  const lectureMarkdown = firstStringField(lesson, [
    'lectureMarkdown',
    'contentMarkdown',
    'content',
  ]);
  const exerciseMarkdown = firstStringField(lesson, ['exerciseMarkdown', 'exercise']);
  const malformed =
    (rawFormat != null && rawFormat !== '' && !['html', 'markdown'].includes(rawFormat)) ||
    (rawFormat === 'html' && (!lectureHtml || !exerciseHtml));

  const describePart = (html, markdown) => {
    if (declared === 'html' && html) return `html:${byteLength(html.value)}B`;
    if (declared === 'html' && markdown) {
      return `markdown-fallback(${markdown.name}):${byteLength(markdown.value)}B`;
    }
    if (declared === 'legacy' && html) return `html-legacy:${byteLength(html.value)}B`;
    if (markdown) return `markdown(${markdown.name}):${byteLength(markdown.value)}B`;
    return 'missing';
  };

  return {
    declared,
    lecture: describePart(lectureHtml, lectureMarkdown),
    exercise: describePart(exerciseHtml, exerciseMarkdown),
    hasRollbackMarkdown: Boolean(lectureMarkdown || exerciseMarkdown),
    malformed,
  };
}

export function summarizeLessonFormats(lessons = []) {
  const counts = { html: 0, markdown: 0, legacy: 0, fallback: 0 };
  for (const lesson of lessons) {
    const info = describeLessonFormat(lesson);
    counts[info.declared] += 1;
    if (info.malformed) counts.malformed = (counts.malformed ?? 0) + 1;
    if (
      info.lecture.startsWith('markdown-fallback') ||
      info.exercise.startsWith('markdown-fallback')
    ) {
      counts.fallback += 1;
    }
  }
  return { ...counts, malformed: counts.malformed ?? 0 };
}

function formatSummary(lessons) {
  const counts = summarizeLessonFormats(lessons);
  return (
    `html=${counts.html} markdown=${counts.markdown} legacy=${counts.legacy} ` +
    `htmlFallback=${counts.fallback} malformed=${counts.malformed}`
  );
}

function printLessonSamples(label, lessons, getId) {
  console.log(`  ${label} formats: ${formatSummary(lessons)}`);
  lessons.slice(0, 5).forEach((lesson, index) => {
    const info = describeLessonFormat(lesson);
    const rollback = info.hasRollbackMarkdown ? 'yes' : 'no';
    const malformed = info.malformed ? ' malformed=yes' : '';
    console.log(
      `    - ${getId(lesson, index)} · session=${lesson.sessionNumber ?? '—'} ` +
        `format=${info.declared} lecture=${info.lecture} exercise=${info.exercise} ` +
        `rollbackMarkdown=${rollback}${malformed} · "${lesson.title ?? ''}"`,
    );
  });
  if (lessons.length > 5) console.log(`    ... +${lessons.length - 5} more`);
}

async function inspectDoc(db, id) {
  const ref = db.collection('curriculumPrograms').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`\n[${id}] doc: MISSING`);
    return;
  }

  const data = snap.data();
  const embeddedLessons = Array.isArray(data.lessons) ? data.lessons : [];
  const lessonIndexCount = Array.isArray(data.lessonIndex) ? data.lessonIndex.length : 0;
  const lessonSnapshot = await ref.collection('lessons').get();
  const lessonDocuments = lessonSnapshot.docs.map((lessonDoc) => ({
    ...lessonDoc.data(),
    _documentId: lessonDoc.id,
  }));

  console.log(`\n[${id}] doc: EXISTS`);
  console.log(`  name: ${data.name ?? '—'}`);
  console.log(`  lessonsStorage: ${data.lessonsStorage ?? '—'}`);
  console.log(`  embedded lessons[]: ${embeddedLessons.length}`);
  console.log(`  lessonIndex[]: ${lessonIndexCount}`);
  console.log(`  subcollection lessons/: ${lessonDocuments.length}`);

  if (embeddedLessons.length) {
    printLessonSamples('embedded', embeddedLessons, (lesson, index) => lesson.id ?? `[${index}]`);
  }
  if (lessonDocuments.length) {
    printLessonSamples('subcollection', lessonDocuments, (lesson) => lesson._documentId);
  }
}

async function main() {
  const [{ applicationDefault, initializeApp }, { getFirestore }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/firestore'),
  ]);
  initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore();
  console.log(`Project: ${projectId}`);
  const ids = [...new Set(CANDIDATE_IDS)];
  for (const id of ids) await inspectDoc(db, id);
}

const isDirectInvocation =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectInvocation) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
