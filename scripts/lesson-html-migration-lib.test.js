import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ALLOWED_LESSON_CLASSES,
  MAX_LESSON_BYTES,
  markdownToSafeHtml,
  planEmbeddedLessons,
  planLessonMutation,
  sanitizeLessonHtml,
} from './lesson-html-migration-lib.js';
import {
  BACKUP_SCHEMA,
  WRITE_BATCH_SIZE,
  createBackupDocument,
  parseCliArguments,
  requireProjectId,
  runMigration,
} from './migrate-lessons-to-html.js';
import { describeLessonFormat, summarizeLessonFormats } from './inspect-program-lessons.js';

function fakeDatabase({ embeddedLessons = [], lessonDocuments = [] } = {}) {
  const programRef = {
    path: 'curriculumPrograms/test-program',
    collection(name) {
      assert.equal(name, 'lessons');
      return {
        async get() {
          return {
            docs: lessonDocuments.map((data, index) => ({
              data: () => data,
              ref: { path: `curriculumPrograms/test-program/lessons/sub-${index + 1}` },
            })),
          };
        },
      };
    },
  };
  const programDocument = {
    data: () => ({ name: 'Test', lessons: embeddedLessons }),
    ref: programRef,
  };

  return {
    collection(name) {
      assert.equal(name, 'curriculumPrograms');
      return {
        async get() {
          return { docs: [programDocument] };
        },
      };
    },
  };
}

test('sanitizer keeps supported lesson markup and filters classes', () => {
  const html = sanitizeLessonHtml(`
    <section class="lesson-card"><article>section content remains</article></section>
    <div class="lesson-card unknown lesson-grid-2 lesson-card">Card</div>
    <details open><summary>More</summary><p><mark>Safe</mark></p></details>
    <table><tr><th scope="col">A</th><td colspan="2">B</td></tr></table>
  `);

  assert.match(
    html,
    /<section class="lesson-card"><article>section content remains<\/article><\/section>/,
  );
  assert.match(html, /class="lesson-card lesson-grid-2"/);
  assert.doesNotMatch(html, /unknown/);
  assert.match(html, /<details open(?:="")?><summary>More<\/summary>/);
  assert.equal(ALLOWED_LESSON_CLASSES.length, 15);
  assert.ok(ALLOWED_LESSON_CLASSES.includes('lesson-hero'));
  assert.ok(ALLOWED_LESSON_CLASSES.includes('lesson-section'));
  assert.ok(ALLOWED_LESSON_CLASSES.includes('lesson-lead'));
});

test('sanitizer removes active content, handlers, inline CSS and dangerous URLs', () => {
  const html = sanitizeLessonHtml(`
    <script>alert(1)</script><style>body{display:none}</style>
    <iframe src="https://evil.example"></iframe><form><input value="x"></form>
    <p onclick="alert(3)" style="color:red">Text</p>
    <a href="java&#x0A;script:alert(4)" target="_blank">Bad</a>
    <img src="data:image/svg+xml;base64,PHN2Zy8+" onerror="alert(5)">
    <svg><script>alert(2)</script></svg>
  `);

  assert.doesNotMatch(html, /script|style=|iframe|form|input|svg|onclick|onerror|javascript/i);
  assert.match(html, /<p>Text<\/p>/);
  assert.match(html, /<a>Bad<\/a>/);
  assert.match(html, /<img\s*\/?>/);
});

test('sanitizer hardens external links and keeps safe image sources', () => {
  const html = sanitizeLessonHtml(`
    <a href="https://example.com/docs">External</a>
    <a href="/lesson/2" target="_blank" rel="opener">Internal</a>
    <img src="https://res.cloudinary.com/demo/image/upload/example.png" style="width:1px">
    <img src="data:image/png;base64,iVBORw0KGgo=">
  `);

  assert.match(
    html,
    /<a href="https:\/\/example.com\/docs" rel="noopener noreferrer">External<\/a>/,
  );
  assert.match(html, /<a href="\/lesson\/2">Internal<\/a>/);
  assert.match(html, /<img src="https:\/\/res.cloudinary.com\/.+">/);
  assert.match(html, /<img src="data:image\/png;base64,iVBORw0KGgo=">\s*$/);
});

test('Markdown conversion is sanitized', () => {
  const html = markdownToSafeHtml(
    '# Tiêu đề\n\n[Link](https://example.com)\n\n<script>bad()</script>',
  );

  assert.match(html, /<h1>Tiêu đề<\/h1>/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /script|bad\(\)/i);
});

test('Markdown conversion preserves single line breaks from the current renderer', () => {
  const html = markdownToSafeHtml('Dòng một\nDòng hai');

  assert.match(html, /Dòng một<br\s*\/?>Dòng hai/);
});

test('conversion preserves Markdown and metadata, then becomes idempotent', () => {
  const original = {
    id: 'lesson-1',
    title: 'Buổi 1',
    lectureMarkdown: '# Chào',
    exerciseMarkdown: '**Làm bài**',
    unknownMetadata: { keep: true },
  };
  const first = planLessonMutation(original);

  assert.equal(first.status, 'change');
  assert.equal(first.patch.contentFormat, 'html');
  assert.match(first.patch.lectureHtml, /<h1>Chào<\/h1>/);
  assert.equal(first.nextLesson.lectureMarkdown, '# Chào');
  assert.deepEqual(first.nextLesson.unknownMetadata, { keep: true });

  const second = planLessonMutation(first.nextLesson);
  assert.deepEqual(second, {
    status: 'skip',
    reason: 'already-html',
    metrics: {},
  });
});

test('conversion follows the legacy Markdown fallback order', () => {
  const result = planLessonMutation({
    contentMarkdown: 'preferred',
    content: 'fallback',
    exercise: 'legacy exercise',
  });

  assert.equal(result.status, 'change');
  assert.equal(result.metrics.lectureSource, 'contentMarkdown');
  assert.equal(result.metrics.exerciseSource, 'exercise');
  assert.match(result.patch.lectureHtml, /preferred/);
  assert.doesNotMatch(result.patch.lectureHtml, /fallback/);
});

test('oversized lessons are rejected before a write is planned', () => {
  const result = planLessonMutation({ lectureMarkdown: 'x'.repeat(100) }, { maxBytes: 50 });

  assert.equal(result.status, 'error');
  assert.equal(result.reason, 'lesson-too-large');
  assert.equal(result.metrics.maxBytes, 50);
  assert.equal(MAX_LESSON_BYTES, 768000);
});

test('rollback only flips contentFormat and retains HTML for a future roll-forward', () => {
  const lesson = {
    contentFormat: 'html',
    lectureHtml: '<p>Hello</p>',
    exerciseHtml: '<p>Try</p>',
    lectureMarkdown: 'Hello',
  };
  const result = planLessonMutation(lesson, { operation: 'rollback' });

  assert.equal(result.status, 'change');
  assert.deepEqual(result.patch, { contentFormat: 'markdown' });
  assert.equal(result.nextLesson.lectureHtml, '<p>Hello</p>');
  assert.equal(planLessonMutation(result.nextLesson, { operation: 'rollback' }).reason, 'not-html');
});

test('embedded lesson planning changes only eligible array entries', () => {
  const lessons = [
    { id: 'a', lectureMarkdown: '# A' },
    { id: 'b', contentFormat: 'html', lectureHtml: '<h1>B</h1>', exerciseHtml: '' },
    { id: 'c', title: 'No content' },
  ];
  const plan = planEmbeddedLessons(lessons);

  assert.equal(plan.changed, true);
  assert.equal(plan.nextLessons[0].contentFormat, 'html');
  assert.strictEqual(plan.nextLessons[1], lessons[1]);
  assert.strictEqual(plan.nextLessons[2], lessons[2]);
  assert.deepEqual(
    plan.results.map((result) => result.status),
    ['change', 'skip', 'skip'],
  );
});

test('rollback never switches an HTML-only lesson to an empty Markdown view', () => {
  const htmlOnly = {
    contentFormat: 'html',
    lectureHtml: '<p>New HTML lesson</p>',
    exerciseHtml: '<p>HTML exercise</p>',
  };

  assert.deepEqual(planLessonMutation(htmlOnly, { operation: 'rollback' }), {
    status: 'skip',
    reason: 'no-markdown-rollback-source',
    metrics: {},
  });
  assert.equal(htmlOnly.contentFormat, 'html');
});

test('conversion requires both HTML fields before treating a record as idempotent', () => {
  const result = planLessonMutation({
    contentFormat: 'html',
    lectureHtml: '<p>Partial HTML</p>',
    exerciseMarkdown: '# Recoverable but malformed',
  });

  assert.equal(result.status, 'error');
  assert.equal(result.reason, 'html-format-without-complete-html-source');
});

test('CLI is dry-run by default and requires an explicit project ID', () => {
  assert.deepEqual(parseCliArguments([]), {
    apply: false,
    operation: 'convert',
    help: false,
  });
  assert.deepEqual(parseCliArguments(['--rollback', '--apply']), {
    apply: true,
    operation: 'rollback',
    help: false,
  });
  assert.throws(() => parseCliArguments(['--apply', '--dry-run']), /either --apply or --dry-run/);
  assert.throws(() => requireProjectId({}), /FIREBASE_PROJECT_ID is required/);
  assert.equal(requireProjectId({ FIREBASE_PROJECT_ID: '  exact-project  ' }), 'exact-project');
  assert.ok(WRITE_BATCH_SIZE < 400);
});

test('dry-run plans embedded and subcollection lessons without writes', async () => {
  const db = fakeDatabase({
    embeddedLessons: [{ id: 'embedded', lectureMarkdown: '# Embedded' }],
    lessonDocuments: [{ id: 'sub', lectureMarkdown: '# Subcollection' }],
  });
  let backupCalled = false;
  let commitCalled = false;

  const result = await runMigration({
    db,
    projectId: 'test-project',
    apply: false,
    operation: 'convert',
    backupWriter: async () => {
      backupCalled = true;
    },
    operationsCommitter: async () => {
      commitCalled = true;
    },
  });

  assert.equal(result.stats.changes, 2);
  assert.equal(result.operations.length, 2);
  assert.equal(result.backup, null);
  assert.equal(backupCalled, false);
  assert.equal(commitCalled, false);
});

test('apply creates its backup before committing the complete valid plan', async () => {
  const db = fakeDatabase({
    embeddedLessons: [{ id: 'embedded', lectureMarkdown: '# Embedded' }],
    lessonDocuments: [{ id: 'sub', lectureMarkdown: '# Subcollection' }],
  });
  const order = [];

  const result = await runMigration({
    db,
    projectId: 'test-project',
    apply: true,
    operation: 'convert',
    backupWriter: async ({ snapshots }) => {
      order.push('backup');
      assert.equal(snapshots.length, 1);
      return { backupPath: '.backups/test.json', bytes: 100 };
    },
    operationsCommitter: async (_database, operations) => {
      order.push('commit');
      assert.equal(operations.length, 2);
    },
  });

  assert.deepEqual(order, ['backup', 'commit']);
  assert.equal(result.stats.errors, 0);
});

test('apply aborts the whole plan before backup or writes when any lesson errors', async () => {
  const db = fakeDatabase({
    embeddedLessons: [{ id: 'invalid', contentFormat: 'future-format', content: 'data' }],
    lessonDocuments: [{ id: 'valid', lectureMarkdown: '# Valid' }],
  });
  let sideEffects = 0;

  await assert.rejects(
    runMigration({
      db,
      projectId: 'test-project',
      apply: true,
      operation: 'convert',
      backupWriter: async () => {
        sideEffects += 1;
      },
      operationsCommitter: async () => {
        sideEffects += 1;
      },
    }),
    /Apply aborted because planning found 1 error/,
  );
  assert.equal(sideEffects, 0);
});

test('backup document preserves raw embedded and subcollection snapshots', () => {
  const rawProgram = { lessons: [{ lectureMarkdown: '# Keep me' }], unknown: 42 };
  const rawLesson = { lectureMarkdown: 'Keep me too', custom: { value: true } };
  const backup = createBackupDocument({
    projectId: 'test-project',
    operation: 'convert',
    createdAt: '2026-08-25T00:00:00.000Z',
    snapshots: [
      {
        path: 'curriculumPrograms/test',
        data: rawProgram,
        lessonDocuments: [{ path: 'curriculumPrograms/test/lessons/one', data: rawLesson }],
      },
    ],
  });

  assert.equal(backup.schema, BACKUP_SCHEMA);
  assert.strictEqual(backup.curriculumPrograms[0].data, rawProgram);
  assert.strictEqual(backup.curriculumPrograms[0].lessonDocuments[0].data, rawLesson);
});

test('lesson inspector reports declared formats, fallback and retained Markdown', () => {
  assert.deepEqual(
    describeLessonFormat({
      contentFormat: 'html',
      lectureHtml: '<p>HTML</p>',
      exerciseMarkdown: 'Markdown fallback',
    }),
    {
      declared: 'html',
      lecture: 'html:11B',
      exercise: 'markdown-fallback(exerciseMarkdown):17B',
      hasRollbackMarkdown: true,
      malformed: true,
    },
  );
  assert.deepEqual(describeLessonFormat({ contentMarkdown: 'Legacy' }), {
    declared: 'legacy',
    lecture: 'markdown(contentMarkdown):6B',
    exercise: 'missing',
    hasRollbackMarkdown: true,
    malformed: false,
  });
  assert.deepEqual(
    summarizeLessonFormats([
      { contentFormat: 'html', lectureHtml: '<p>OK</p>', exerciseHtml: '' },
      { contentFormat: 'markdown', lectureMarkdown: 'OK' },
      { contentMarkdown: 'Legacy' },
      { contentFormat: 'html', lectureMarkdown: 'Missing HTML' },
      { contentFormat: 'future' },
    ]),
    { html: 2, markdown: 1, legacy: 2, fallback: 1, malformed: 2 },
  );
});
