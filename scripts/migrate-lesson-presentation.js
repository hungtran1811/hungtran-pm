/**
 * Assign HungTran lesson presentation presets without rewriting lesson HTML.
 * Dry-run is the default and FIREBASE_PROJECT_ID is always required.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  planLessonPresentationMutation,
  serializedLessonByteSize,
} from './lesson-presentation-migration-lib.js';

export const WRITE_BATCH_SIZE = 350;
export const FIRESTORE_SAFE_DOCUMENT_MAX_BYTES = 900 * 1024;
export const BACKUP_SCHEMA = 'hungtran-pm-lesson-presentation-backup-v2';
export const FIRESTORE_BACKUP_TYPE_KEY = '__hungtranFirestoreType';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');

function usage() {
  return `
Set lesson presentationPreset without changing HTML (dry-run by default).

Required environment:
  FIREBASE_PROJECT_ID=<exact-project-id>

Options:
  --apply       Write the planned changes.
  --rollback    Change hungtran-v1 back to legacy-document; HTML is retained.
  --dry-run     Explicit dry-run (the default).
  --program=ID  Only inspect one program ID. May be repeated.
  --lesson=ID   Only inspect one lesson ID. May be repeated.
  --help        Show this help.
`;
}

export function parseCliArguments(argv) {
  const supported = new Set(['--apply', '--rollback', '--dry-run', '--help']);
  const programIds = [];
  const lessonIds = [];
  const unknown = [];
  for (const value of argv) {
    if (supported.has(value)) continue;
    if (value.startsWith('--program=') && value.slice('--program='.length).trim()) {
      programIds.push(value.slice('--program='.length).trim());
      continue;
    }
    if (value.startsWith('--lesson=') && value.slice('--lesson='.length).trim()) {
      lessonIds.push(value.slice('--lesson='.length).trim());
      continue;
    }
    unknown.push(value);
  }
  if (unknown.length) throw new Error(`Unknown option(s): ${unknown.join(', ')}`);
  if (argv.includes('--apply') && argv.includes('--dry-run')) {
    throw new Error('Use either --apply or --dry-run, not both.');
  }
  return {
    apply: argv.includes('--apply'),
    operation: argv.includes('--rollback') ? 'rollback' : 'managed',
    help: argv.includes('--help'),
    programIds: [...new Set(programIds)],
    lessonIds: [...new Set(lessonIds)],
  };
}

export function requireProjectId(environment = process.env) {
  const projectId = environment.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error(
      'FIREBASE_PROJECT_ID is required. Set the exact Firebase project before running.',
    );
  }
  return projectId;
}

function createStats() {
  return {
    programs: 0,
    lessons: 0,
    changes: 0,
    skips: 0,
    errors: 0,
    writes: 0,
    sourceBytes: 0,
    managedBytes: 0,
    serializedBytes: 0,
    skipReasons: new Map(),
    errorReasons: new Map(),
  };
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function formatBytes(value = 0) {
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(1)} KiB`;
}

function recordResult(stats, displayPath, planned, logger) {
  stats.lessons += 1;
  const metrics = planned.metrics ?? {};
  if (planned.status === 'change') {
    stats.changes += 1;
    stats.sourceBytes += metrics.sourceBytes ?? 0;
    stats.managedBytes += metrics.managedBytes ?? 0;
    stats.serializedBytes += metrics.serializedBytes ?? 0;
    logger.log(
      `CHANGE ${displayPath} (${planned.reason}) ` +
        `source=${formatBytes(metrics.sourceBytes)} managed=${formatBytes(metrics.managedBytes)} ` +
        `serialized=${formatBytes(metrics.serializedBytes)}`,
    );
  } else if (planned.status === 'skip') {
    stats.skips += 1;
    increment(stats.skipReasons, planned.reason);
    logger.log(`SKIP   ${displayPath} (${planned.reason})`);
  } else {
    stats.errors += 1;
    increment(stats.errorReasons, planned.reason);
    logger.error(`ERROR  ${displayPath} (${planned.reason})`);
  }
}

function taggedBackupValue(type, value) {
  return { [FIRESTORE_BACKUP_TYPE_KEY]: type, value };
}

function constructorName(value) {
  return value?.constructor?.name || '';
}

/**
 * Converts Firestore values to unambiguous JSON while retaining enough type
 * information for a lossless restore tool. Plain objects containing our tag
 * key are wrapped so user data cannot be mistaken for metadata.
 */
export function encodeFirestoreBackupValue(value, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (Number.isFinite(value) && !Object.is(value, -0)) return value;
    return taggedBackupValue('number', Object.is(value, -0) ? '-0' : String(value));
  }
  if (typeof value === 'undefined') return taggedBackupValue('undefined', null);
  if (typeof value === 'bigint') return taggedBackupValue('bigint', value.toString());

  if (value instanceof Date) return taggedBackupValue('date', value.toISOString());
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return taggedBackupValue('bytes', value.toString('base64'));
  }
  if (value instanceof Uint8Array) {
    return taggedBackupValue('bytes', Buffer.from(value).toString('base64'));
  }

  const typeName = constructorName(value);
  const seconds = value?.seconds ?? value?._seconds;
  const nanoseconds = value?.nanoseconds ?? value?._nanoseconds;
  if (
    typeName === 'Timestamp' &&
    Number.isFinite(Number(seconds)) &&
    Number.isFinite(Number(nanoseconds))
  ) {
    return taggedBackupValue('timestamp', {
      seconds: Number(seconds),
      nanoseconds: Number(nanoseconds),
    });
  }

  const latitude = value?.latitude ?? value?._latitude;
  const longitude = value?.longitude ?? value?._longitude;
  if (
    typeName === 'GeoPoint' &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude))
  ) {
    return taggedBackupValue('geopoint', {
      latitude: Number(latitude),
      longitude: Number(longitude),
    });
  }

  if (/DocumentReference$/i.test(typeName) && typeof value?.path === 'string') {
    return taggedBackupValue('reference', {
      path: value.path,
      projectId: value.firestore?.projectId ?? value.firestore?._settings?.projectId ?? null,
      databaseId: value.firestore?.databaseId ?? null,
    });
  }

  if (typeof value !== 'object') return taggedBackupValue(typeof value, String(value));
  if (seen.has(value)) throw new TypeError('Cannot back up a cyclic Firestore value.');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => encodeFirestoreBackupValue(item, seen));
    }
    const output = Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, encodeFirestoreBackupValue(item, seen)]),
    );
    return Object.prototype.hasOwnProperty.call(output, FIRESTORE_BACKUP_TYPE_KEY)
      ? taggedBackupValue('map', output)
      : output;
  } finally {
    seen.delete(value);
  }
}

export function createBackupDocument({ projectId, operation, snapshots, createdAt }) {
  return {
    schema: BACKUP_SCHEMA,
    projectId,
    operation,
    createdAt,
    note: 'Tagged, lossless pre-write snapshots. This migration changes presentationPreset only.',
    curriculumPrograms: snapshots.map((snapshot) => ({
      path: snapshot.path,
      updateTime: encodeFirestoreBackupValue(snapshot.updateTime),
      data: encodeFirestoreBackupValue(snapshot.data),
      lessonDocuments: snapshot.lessonDocuments.map((lesson) => ({
        path: lesson.path,
        updateTime: encodeFirestoreBackupValue(lesson.updateTime),
        data: encodeFirestoreBackupValue(lesson.data),
      })),
    })),
  };
}

async function writeBackup({ projectId, operation, snapshots }) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const safeProjectId = projectId.replace(/[^a-z0-9_-]/gi, '_');
  const directory = path.join(PROJECT_ROOT, '.backups');
  const backupPath = path.join(
    directory,
    `lesson-presentation-${safeProjectId}-${operation}-${timestamp}.json`,
  );
  const backup = createBackupDocument({
    projectId,
    operation,
    snapshots,
    createdAt: now.toISOString(),
  });
  await mkdir(directory, { recursive: true });
  await writeFile(backupPath, `${JSON.stringify(backup, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  return { backupPath, bytes: serializedLessonByteSize(backup) };
}

function documentId(snapshot) {
  return snapshot.id ?? snapshot.ref?.path?.split('/').filter(Boolean).at(-1) ?? '';
}

function addPlanningError(stats, reason, displayPath, logger, detail = '') {
  stats.errors += 1;
  increment(stats.errorReasons, reason);
  logger.error(`ERROR  ${displayPath} (${reason})${detail ? ` ${detail}` : ''}`);
}

function updateTimePrecondition(snapshot) {
  return snapshot.updateTime ? { lastUpdateTime: snapshot.updateTime } : null;
}

export async function buildMigrationPlan(
  db,
  { operation = 'managed', logger = console, programIds = [], lessonIds = [] } = {},
) {
  const programs = await db.collection('curriculumPrograms').get();
  const operations = [];
  const snapshots = [];
  const stats = createStats();
  const selectedPrograms = new Set(programIds);
  const selectedLessons = new Set(lessonIds);

  for (const programDoc of programs.docs) {
    const programId = documentId(programDoc);
    if (selectedPrograms.size && !selectedPrograms.has(programId)) continue;
    stats.programs += 1;
    const programData = programDoc.data();
    const subcollection = await programDoc.ref.collection('lessons').get();
    snapshots.push({
      path: programDoc.ref.path,
      updateTime: programDoc.updateTime ?? null,
      data: programData,
      lessonDocuments: subcollection.docs.map((lessonDoc) => ({
        path: lessonDoc.ref.path,
        updateTime: lessonDoc.updateTime ?? null,
        data: lessonDoc.data(),
      })),
    });

    if (Array.isArray(programData.lessons)) {
      let embeddedChanged = false;
      const nextLessons = [...programData.lessons];
      const changedResults = [];
      for (const [index, lesson] of programData.lessons.entries()) {
        const lessonId = lesson?.id ?? '';
        if (selectedLessons.size && !selectedLessons.has(String(lessonId))) continue;
        const planned = planLessonPresentationMutation(lesson, { operation });
        recordResult(stats, `${programDoc.ref.path}#lessons[${index}]`, planned, logger);
        if (planned.status === 'change') {
          embeddedChanged = true;
          nextLessons[index] = planned.nextLesson;
          changedResults.push(planned);
        }
      }

      if (embeddedChanged) {
        const nextProgramBytes = serializedLessonByteSize(
          encodeFirestoreBackupValue({ ...programData, lessons: nextLessons }),
        );
        const precondition = updateTimePrecondition(programDoc);
        if (nextProgramBytes > FIRESTORE_SAFE_DOCUMENT_MAX_BYTES) {
          addPlanningError(
            stats,
            'embedded-program-too-large',
            programDoc.ref.path,
            logger,
            `serialized=${formatBytes(nextProgramBytes)} limit=${formatBytes(FIRESTORE_SAFE_DOCUMENT_MAX_BYTES)}`,
          );
        } else if (!precondition) {
          addPlanningError(stats, 'missing-update-time-precondition', programDoc.ref.path, logger);
        } else {
          operations.push({
            ref: programDoc.ref,
            path: programDoc.ref.path,
            patch: { lessons: nextLessons },
            precondition,
            affectedLessons: changedResults.length,
          });
        }
      }
    }

    for (const lessonDoc of subcollection.docs) {
      const lessonId = documentId(lessonDoc);
      if (selectedLessons.size && !selectedLessons.has(lessonId)) continue;
      const planned = planLessonPresentationMutation(lessonDoc.data(), { operation });
      recordResult(stats, lessonDoc.ref.path, planned, logger);
      if (planned.status === 'change') {
        const precondition = updateTimePrecondition(lessonDoc);
        if (!precondition) {
          addPlanningError(stats, 'missing-update-time-precondition', lessonDoc.ref.path, logger);
        } else {
          operations.push({
            ref: lessonDoc.ref,
            path: lessonDoc.ref.path,
            patch: planned.patch,
            precondition,
            affectedLessons: 1,
          });
        }
      }
    }
  }

  stats.writes = operations.length;
  if (operations.length > WRITE_BATCH_SIZE) {
    addPlanningError(
      stats,
      'atomic-write-limit-exceeded',
      'migration-plan',
      logger,
      `writes=${operations.length} limit=${WRITE_BATCH_SIZE}; use --program/--lesson filters`,
    );
  }
  return { operations, snapshots, stats };
}

export async function commitOperations(db, operations, logger = console) {
  if (operations.length > WRITE_BATCH_SIZE) {
    throw new Error(
      `Atomic migration supports at most ${WRITE_BATCH_SIZE} writes; received ${operations.length}.`,
    );
  }
  if (!operations.length) return;
  for (const operation of operations) {
    if (!operation.precondition?.lastUpdateTime) {
      throw new Error(`Missing lastUpdateTime precondition for ${operation.path}.`);
    }
  }
  const batch = db.batch();
  for (const operation of operations) {
    batch.update(operation.ref, operation.patch, operation.precondition);
  }
  await batch.commit();
  logger.log(`Atomically committed ${operations.length} document writes.`);
}

export async function runMigration({
  db,
  projectId,
  apply = false,
  operation = 'managed',
  programIds = [],
  lessonIds = [],
  backupWriter = writeBackup,
  operationsCommitter = commitOperations,
  logger = console,
}) {
  logger.log(`Project: ${projectId}`);
  logger.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}; operation=${operation}`);
  const plan = await buildMigrationPlan(db, {
    operation,
    logger,
    programIds,
    lessonIds,
  });
  logger.log(
    `Programs=${plan.stats.programs} lessons=${plan.stats.lessons} ` +
      `changes=${plan.stats.changes} skips=${plan.stats.skips} ` +
      `errors=${plan.stats.errors} writes=${plan.stats.writes}`,
  );
  logger.log(
    `Source=${formatBytes(plan.stats.sourceBytes)} managed=${formatBytes(plan.stats.managedBytes)} ` +
      `serializedLessons=${formatBytes(plan.stats.serializedBytes)}`,
  );

  if (!apply) return { ...plan, backup: null };
  if (plan.stats.errors) {
    throw new Error(
      `Apply aborted because planning found ${plan.stats.errors} error(s). No writes were made.`,
    );
  }
  if (!plan.operations.length) return { ...plan, backup: null };

  const backup = await backupWriter({ projectId, operation, snapshots: plan.snapshots });
  logger.log(`Backup created before writes: ${backup.backupPath}`);
  await operationsCommitter(db, plan.operations, logger);
  return { ...plan, backup };
}

async function main() {
  const options = parseCliArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const projectId = requireProjectId();
  const [{ applicationDefault, initializeApp }, { getFirestore }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/firestore'),
  ]);
  initializeApp({ credential: applicationDefault(), projectId });
  await runMigration({ db: getFirestore(), projectId, ...options });
}

const isDirectInvocation =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectInvocation) {
  main().catch((error) => {
    console.error(`Migration failed: ${error instanceof Error ? error.stack : String(error)}`);
    process.exitCode = 1;
  });
}
