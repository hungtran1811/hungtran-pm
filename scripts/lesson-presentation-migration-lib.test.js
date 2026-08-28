import assert from 'node:assert/strict';
import test from 'node:test';

import {
  planEmbeddedLessonPresentations,
  planLessonPresentationMutation,
} from './lesson-presentation-migration-lib.js';
import {
  FIRESTORE_BACKUP_TYPE_KEY,
  FIRESTORE_SAFE_DOCUMENT_MAX_BYTES,
  buildMigrationPlan,
  commitOperations,
  createBackupDocument,
  encodeFirestoreBackupValue,
  parseCliArguments,
  requireProjectId,
  runMigration,
} from './migrate-lesson-presentation.js';

const silentLogger = { log() {}, error() {} };

function fakeDatabase({
  embeddedLessons = [],
  subcollectionLessons = [],
  programData = {},
  programUpdateTime = 'program-update',
} = {}) {
  const lessonDocs = subcollectionLessons.map((data, index) => ({
    id: String(data.id ?? index),
    ref: { path: `curriculumPrograms/web/lessons/${data.id ?? index}` },
    updateTime: `lesson-update-${index}`,
    data: () => data,
  }));
  const programRef = {
    path: 'curriculumPrograms/web',
    collection: () => ({ get: async () => ({ docs: lessonDocs }) }),
  };
  const programDoc = {
    id: 'web',
    ref: programRef,
    updateTime: programUpdateTime,
    data: () => ({ name: 'Web', lessons: embeddedLessons, ...programData }),
  };
  return {
    collection: () => ({ get: async () => ({ docs: [programDoc] }) }),
  };
}

test('plans a preset-only managed conversion without rewriting HTML or metadata', () => {
  const lesson = {
    id: 'web-1',
    contentFormat: 'html',
    presentationPreset: 'legacy-document',
    lectureHtml:
      '<!doctype html><html><head><style>.page{color:red}</style></head><body><main><h1>Lesson</h1></main></body></html>',
    exerciseHtml: '',
    lectureMarkdown: '# Rollback',
    unknown: { retained: true },
  };

  const planned = planLessonPresentationMutation(lesson);

  assert.equal(planned.status, 'change');
  assert.deepEqual(planned.patch, { presentationPreset: 'hungtran-v1' });
  assert.equal(planned.nextLesson.lectureHtml, lesson.lectureHtml);
  assert.equal(planned.nextLesson.lectureMarkdown, '# Rollback');
  assert.deepEqual(planned.nextLesson.unknown, { retained: true });
});

test('managed planning is idempotent', () => {
  const planned = planLessonPresentationMutation({
    contentFormat: 'html',
    presentationPreset: 'hungtran-v1',
    lectureHtml: '<h1>Lesson</h1>',
    exerciseHtml: '',
  });

  assert.deepEqual(planned, { status: 'skip', reason: 'already-managed' });
});

test('skips JavaScript-only documents that would become blank in managed mode', () => {
  const planned = planLessonPresentationMutation({
    contentFormat: 'html',
    presentationPreset: 'legacy-document',
    lectureHtml:
      '<!doctype html><body><div id="root"></div><script>root.textContent="Lesson"</script></body>',
    exerciseHtml: '',
  });

  assert.equal(planned.status, 'skip');
  assert.equal(planned.reason, 'unrenderable-managed-html');
  assert.deepEqual(planned.metrics.unrenderableFields, ['lectureHtml']);
});

test('skips when either non-empty lesson part would disappear', () => {
  const planned = planLessonPresentationMutation({
    contentFormat: 'html',
    lectureHtml: '<h1>Visible lecture</h1>',
    exerciseHtml: '<script>generateExercise()</script>',
  });

  assert.equal(planned.status, 'skip');
  assert.deepEqual(planned.metrics.unrenderableFields, ['exerciseHtml']);
});

test('does not activate retained HTML on Markdown lessons', () => {
  const planned = planLessonPresentationMutation({
    contentFormat: 'markdown',
    lectureHtml: '<h1>Retained HTML</h1>',
  });

  assert.deepEqual(planned, { status: 'skip', reason: 'not-html' });
});

test('rejects unknown preset values instead of overwriting future metadata', () => {
  const planned = planLessonPresentationMutation({
    contentFormat: 'html',
    presentationPreset: 'future-preset',
    lectureHtml: '<h1>Lesson</h1>',
    exerciseHtml: '',
  });

  assert.deepEqual(planned, { status: 'error', reason: 'unknown-presentation-preset' });
});

test('rollback changes only the preset and retains managed HTML', () => {
  const lesson = {
    contentFormat: 'html',
    presentationPreset: 'hungtran-v1',
    lectureHtml: '<h1>Lesson</h1>',
    exerciseHtml: '',
    custom: 'keep',
  };
  const planned = planLessonPresentationMutation(lesson, { operation: 'rollback' });

  assert.equal(planned.status, 'change');
  assert.deepEqual(planned.patch, { presentationPreset: 'legacy-document' });
  assert.equal(planned.nextLesson.lectureHtml, lesson.lectureHtml);
  assert.equal(planned.nextLesson.custom, 'keep');
});

test('embedded planning covers changes, skips and remains idempotent', () => {
  const lessons = [
    {
      id: 'a',
      contentFormat: 'html',
      lectureHtml: '<h1>A</h1>',
      exerciseHtml: '',
    },
    { id: 'b', contentFormat: 'markdown', lectureMarkdown: '# B' },
  ];
  const first = planEmbeddedLessonPresentations(lessons);
  const second = planEmbeddedLessonPresentations(first.nextLessons);

  assert.equal(first.changed, true);
  assert.equal(first.nextLessons[0].presentationPreset, 'hungtran-v1');
  assert.equal(first.nextLessons[0].lectureHtml, lessons[0].lectureHtml);
  assert.equal(first.nextLessons[1], lessons[1]);
  assert.equal(second.changed, false);
  assert.equal(second.results[0].reason, 'already-managed');
});

test('enforces the serialized lesson size limit', () => {
  const planned = planLessonPresentationMutation(
    {
      contentFormat: 'html',
      lectureHtml: '<h1>Lesson</h1>',
      exerciseHtml: '',
    },
    { maxBytes: 20 },
  );

  assert.equal(planned.status, 'error');
  assert.equal(planned.reason, 'lesson-too-large');
});

test('CLI parsing is dry-run by default and requires an explicit project', () => {
  assert.deepEqual(parseCliArguments([]), {
    apply: false,
    operation: 'managed',
    help: false,
    programIds: [],
    lessonIds: [],
  });
  assert.deepEqual(
    parseCliArguments([
      '--rollback',
      '--apply',
      '--program=web',
      '--program=web',
      '--lesson=lesson-1',
    ]),
    {
      apply: true,
      operation: 'rollback',
      help: false,
      programIds: ['web'],
      lessonIds: ['lesson-1'],
    },
  );
  assert.throws(() => parseCliArguments(['--apply', '--dry-run']), /either/);
  assert.throws(() => requireProjectId({}), /FIREBASE_PROJECT_ID/);
  assert.equal(requireProjectId({ FIREBASE_PROJECT_ID: ' project-id ' }), 'project-id');
});

test('builds changes for both embedded and subcollection lessons', async () => {
  const db = fakeDatabase({
    embeddedLessons: [
      { id: 'embedded', contentFormat: 'html', lectureHtml: '<h1>A</h1>', exerciseHtml: '' },
    ],
    subcollectionLessons: [
      { id: 'nested', contentFormat: 'html', lectureHtml: '<h1>B</h1>', exerciseHtml: '' },
    ],
  });
  const plan = await buildMigrationPlan(db, { logger: silentLogger });

  assert.equal(plan.stats.lessons, 2);
  assert.equal(plan.stats.changes, 2);
  assert.equal(plan.operations.length, 2);
  assert.equal(plan.operations[0].patch.lessons[0].presentationPreset, 'hungtran-v1');
  assert.deepEqual(plan.operations[1].patch, { presentationPreset: 'hungtran-v1' });
});

test('dry-run never creates a backup or commits operations', async () => {
  const events = [];
  const result = await runMigration({
    db: fakeDatabase({
      subcollectionLessons: [
        { contentFormat: 'html', lectureHtml: '<h1>A</h1>', exerciseHtml: '' },
      ],
    }),
    projectId: 'test-project',
    apply: false,
    logger: silentLogger,
    backupWriter: async () => {
      events.push('backup');
    },
    operationsCommitter: async () => {
      events.push('commit');
    },
  });

  assert.equal(result.stats.changes, 1);
  assert.equal(result.backup, null);
  assert.deepEqual(events, []);
});

test('apply backs up raw snapshots before committing preset-only operations', async () => {
  const events = [];
  const result = await runMigration({
    db: fakeDatabase({
      subcollectionLessons: [
        { contentFormat: 'html', lectureHtml: '<h1>A</h1>', exerciseHtml: '', keep: true },
      ],
    }),
    projectId: 'test-project',
    apply: true,
    logger: silentLogger,
    backupWriter: async ({ snapshots }) => {
      events.push('backup');
      assert.equal(snapshots[0].lessonDocuments[0].data.keep, true);
      return { backupPath: '.backups/test.json', bytes: 1 };
    },
    operationsCommitter: async (_db, operations) => {
      events.push('commit');
      assert.deepEqual(operations[0].patch, { presentationPreset: 'hungtran-v1' });
    },
  });

  assert.deepEqual(events, ['backup', 'commit']);
  assert.equal(result.backup.backupPath, '.backups/test.json');
});

test('rollback planning works for embedded and subcollection lessons', async () => {
  const managed = {
    contentFormat: 'html',
    presentationPreset: 'hungtran-v1',
    lectureHtml: '<h1>A</h1>',
    exerciseHtml: '',
  };
  const plan = await buildMigrationPlan(
    fakeDatabase({ embeddedLessons: [managed], subcollectionLessons: [managed] }),
    { operation: 'rollback', logger: silentLogger },
  );

  assert.equal(plan.stats.changes, 2);
  assert.equal(plan.operations[0].patch.lessons[0].presentationPreset, 'legacy-document');
  assert.deepEqual(plan.operations[1].patch, { presentationPreset: 'legacy-document' });
});

test('build plan carries update-time preconditions for every planned write', async () => {
  const plan = await buildMigrationPlan(
    fakeDatabase({
      embeddedLessons: [
        { id: 'embedded', contentFormat: 'html', lectureHtml: '<h1>A</h1>', exerciseHtml: '' },
      ],
      subcollectionLessons: [
        { id: 'nested', contentFormat: 'html', lectureHtml: '<h1>B</h1>', exerciseHtml: '' },
      ],
    }),
    { logger: silentLogger },
  );

  assert.deepEqual(
    plan.operations.map((operation) => operation.precondition),
    [{ lastUpdateTime: 'program-update' }, { lastUpdateTime: 'lesson-update-0' }],
  );
});

test('refuses an embedded array write without an update-time precondition', async () => {
  const plan = await buildMigrationPlan(
    fakeDatabase({
      embeddedLessons: [
        { id: 'embedded', contentFormat: 'html', lectureHtml: '<h1>A</h1>', exerciseHtml: '' },
      ],
      programUpdateTime: null,
    }),
    { logger: silentLogger },
  );

  assert.equal(plan.operations.length, 0);
  assert.equal(plan.stats.errors, 1);
  assert.equal(plan.stats.errorReasons.get('missing-update-time-precondition'), 1);
});

test('preflights the complete embedded program below a conservative Firestore limit', async () => {
  const plan = await buildMigrationPlan(
    fakeDatabase({
      embeddedLessons: [
        { id: 'embedded', contentFormat: 'html', lectureHtml: '<h1>A</h1>', exerciseHtml: '' },
      ],
      programData: { padding: 'x'.repeat(FIRESTORE_SAFE_DOCUMENT_MAX_BYTES) },
    }),
    { logger: silentLogger },
  );

  assert.equal(plan.operations.length, 0);
  assert.equal(plan.stats.errorReasons.get('embedded-program-too-large'), 1);
});

test('supports bounded program and lesson filters', async () => {
  const db = fakeDatabase({
    embeddedLessons: [
      { id: 'a', contentFormat: 'html', lectureHtml: '<h1>A</h1>', exerciseHtml: '' },
      { id: 'b', contentFormat: 'html', lectureHtml: '<h1>B</h1>', exerciseHtml: '' },
    ],
    subcollectionLessons: [
      { id: 'a', contentFormat: 'html', lectureHtml: '<h1>A</h1>', exerciseHtml: '' },
      { id: 'b', contentFormat: 'html', lectureHtml: '<h1>B</h1>', exerciseHtml: '' },
    ],
  });
  const filtered = await buildMigrationPlan(db, {
    logger: silentLogger,
    programIds: ['web'],
    lessonIds: ['b'],
  });
  const excluded = await buildMigrationPlan(db, {
    logger: silentLogger,
    programIds: ['another-program'],
  });

  assert.equal(filtered.stats.lessons, 2);
  assert.equal(filtered.operations.length, 2);
  assert.equal(filtered.operations[0].patch.lessons[0].presentationPreset, undefined);
  assert.equal(filtered.operations[0].patch.lessons[1].presentationPreset, 'hungtran-v1');
  assert.equal(filtered.operations[1].path.endsWith('/b'), true);
  assert.equal(excluded.stats.programs, 0);
  assert.equal(excluded.operations.length, 0);
});

test('encodes Firestore special values with unambiguous backup type tags', () => {
  class Timestamp {
    constructor(seconds, nanoseconds) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
  }
  class GeoPoint {
    constructor(latitude, longitude) {
      this.latitude = latitude;
      this.longitude = longitude;
    }
  }
  class DocumentReference {
    constructor(path) {
      this.path = path;
      this.firestore = { projectId: 'test-project' };
    }
  }
  const encoded = encodeFirestoreBackupValue({
    timestamp: new Timestamp(12, 34),
    geopoint: new GeoPoint(10.5, 106.7),
    reference: new DocumentReference('curriculumPrograms/web'),
    bytes: Buffer.from([0, 1, 2]),
    date: new Date('2026-01-02T03:04:05.000Z'),
    specialNumber: Number.NaN,
    userMapWithReservedKey: { [FIRESTORE_BACKUP_TYPE_KEY]: 'user-value' },
  });

  assert.deepEqual(encoded.timestamp, {
    [FIRESTORE_BACKUP_TYPE_KEY]: 'timestamp',
    value: { seconds: 12, nanoseconds: 34 },
  });
  assert.equal(encoded.geopoint[FIRESTORE_BACKUP_TYPE_KEY], 'geopoint');
  assert.equal(encoded.reference.value.path, 'curriculumPrograms/web');
  assert.equal(encoded.bytes.value, 'AAEC');
  assert.equal(encoded.date.value, '2026-01-02T03:04:05.000Z');
  assert.equal(encoded.specialNumber.value, 'NaN');
  assert.equal(encoded.userMapWithReservedKey[FIRESTORE_BACKUP_TYPE_KEY], 'map');
  assert.doesNotThrow(() => JSON.stringify(encoded));
});

test('backup documents encode snapshot data and update times without dropping types', () => {
  class Timestamp {
    constructor(seconds, nanoseconds) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
  }
  const backup = createBackupDocument({
    projectId: 'test-project',
    operation: 'managed',
    createdAt: '2026-01-01T00:00:00.000Z',
    snapshots: [
      {
        path: 'curriculumPrograms/web',
        updateTime: new Timestamp(1, 2),
        data: { updatedAt: new Timestamp(3, 4) },
        lessonDocuments: [],
      },
    ],
  });

  assert.equal(backup.curriculumPrograms[0].updateTime[FIRESTORE_BACKUP_TYPE_KEY], 'timestamp');
  assert.equal(backup.curriculumPrograms[0].data.updatedAt[FIRESTORE_BACKUP_TYPE_KEY], 'timestamp');
});

test('commits all writes in one atomic batch with last-update-time preconditions', async () => {
  const calls = [];
  let commits = 0;
  const db = {
    batch: () => ({
      update: (...args) => calls.push(args),
      commit: async () => {
        commits += 1;
      },
    }),
  };
  await commitOperations(
    db,
    [
      {
        ref: { path: 'a/1' },
        path: 'a/1',
        patch: { presentationPreset: 'hungtran-v1' },
        precondition: { lastUpdateTime: 'time-1' },
      },
      {
        ref: { path: 'a/2' },
        path: 'a/2',
        patch: { presentationPreset: 'hungtran-v1' },
        precondition: { lastUpdateTime: 'time-2' },
      },
    ],
    silentLogger,
  );

  assert.equal(commits, 1);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0][2], { lastUpdateTime: 'time-1' });
});

test('atomic committer rejects unsafe or oversized plans before creating a batch', async () => {
  let batches = 0;
  const db = { batch: () => (batches += 1) };
  await assert.rejects(
    () =>
      commitOperations(db, [{ ref: {}, path: 'a/1', patch: {}, precondition: null }], silentLogger),
    /Missing lastUpdateTime/,
  );
  await assert.rejects(
    () =>
      commitOperations(
        db,
        Array.from({ length: 351 }, (_, index) => ({
          ref: {},
          path: `a/${index}`,
          patch: {},
          precondition: { lastUpdateTime: `time-${index}` },
        })),
        silentLogger,
      ),
    /at most 350 writes/,
  );
  assert.equal(batches, 0);
});
