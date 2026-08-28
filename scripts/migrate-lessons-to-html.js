/**
 * Convert legacy lesson Markdown to sanitized static HTML without deleting Markdown.
 *
 * This command is dry-run by default and requires an explicit FIREBASE_PROJECT_ID.
 *
 * Usage (from project root):
 *   FIREBASE_PROJECT_ID=your-project node scripts/migrate-lessons-to-html.js
 *   FIREBASE_PROJECT_ID=your-project node scripts/migrate-lessons-to-html.js --apply
 *   FIREBASE_PROJECT_ID=your-project node scripts/migrate-lessons-to-html.js --rollback
 *   FIREBASE_PROJECT_ID=your-project node scripts/migrate-lessons-to-html.js --rollback --apply
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  MAX_LESSON_BYTES,
  planEmbeddedLessons,
  planLessonMutation,
  serializedByteSize,
} from './lesson-html-migration-lib.js';

export const WRITE_BATCH_SIZE = 350;
export const BACKUP_SCHEMA = 'hungtran-pm-lessons-html-backup-v1';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');

function usage() {
  return `
Migrate lesson Markdown to sanitized HTML (dry-run by default).

Required environment:
  FIREBASE_PROJECT_ID=<exact-project-id>

Options:
  --apply       Write the planned changes. Without this flag, no writes occur.
  --rollback    Plan changing contentFormat from "html" back to "markdown".
                Combine with --apply to write the rollback. HTML is retained.
  --dry-run     Explicit dry-run (the default).
  --help        Show this help.
`;
}

export function parseCliArguments(argv) {
  const supported = new Set(['--apply', '--rollback', '--dry-run', '--help']);
  const unknown = argv.filter((value) => !supported.has(value));
  if (unknown.length) throw new Error(`Unknown option(s): ${unknown.join(', ')}`);
  if (argv.includes('--apply') && argv.includes('--dry-run')) {
    throw new Error('Use either --apply or --dry-run, not both.');
  }

  return {
    apply: argv.includes('--apply'),
    operation: argv.includes('--rollback') ? 'rollback' : 'convert',
    help: argv.includes('--help'),
  };
}

export function requireProjectId(environment = process.env) {
  const projectId = environment.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error(
      'FIREBASE_PROJECT_ID is required. Set it to the exact Firebase project before running this script.',
    );
  }
  return projectId;
}

function formatBytes(value = 0) {
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(1)} KiB`;
}

function createStats() {
  return {
    programs: 0,
    lessons: 0,
    changes: 0,
    skips: 0,
    errors: 0,
    writes: 0,
    markdownBytes: 0,
    htmlBytes: 0,
    serializedBytes: 0,
    skipReasons: new Map(),
    errorReasons: new Map(),
  };
}

function incrementReason(map, reason) {
  map.set(reason, (map.get(reason) ?? 0) + 1);
}

function recordResult(stats, displayPath, result) {
  stats.lessons += 1;
  const metrics = result.metrics ?? {};

  if (result.status === 'change') {
    stats.changes += 1;
    stats.markdownBytes += metrics.markdownBytes ?? 0;
    stats.htmlBytes += metrics.htmlBytes ?? 0;
    stats.serializedBytes += metrics.serializedBytes ?? 0;
    console.log(
      `  CHANGE ${displayPath} · source=${formatBytes(metrics.markdownBytes)} ` +
        `html=${formatBytes(metrics.htmlBytes)} serialized=${formatBytes(metrics.serializedBytes)}`,
    );
    return;
  }

  if (result.status === 'skip') {
    stats.skips += 1;
    incrementReason(stats.skipReasons, result.reason);
    console.log(`  SKIP   ${displayPath} · ${result.reason}`);
    return;
  }

  stats.errors += 1;
  incrementReason(stats.errorReasons, result.reason);
  const detail = metrics.message ? ` · ${metrics.message}` : '';
  const size = metrics.serializedBytes
    ? ` · serialized=${formatBytes(metrics.serializedBytes)} limit=${formatBytes(metrics.maxBytes)}`
    : '';
  console.error(`  ERROR  ${displayPath} · ${result.reason}${size}${detail}`);
}

export function createBackupDocument({ projectId, operation, snapshots, createdAt }) {
  return {
    schema: BACKUP_SCHEMA,
    projectId,
    operation,
    createdAt,
    note: 'Raw pre-write snapshots. Markdown and HTML fields are intentionally retained by the migration.',
    curriculumPrograms: snapshots.map((snapshot) => ({
      path: snapshot.path,
      data: snapshot.data,
      lessonDocuments: snapshot.lessonDocuments.map((lesson) => ({
        path: lesson.path,
        data: lesson.data,
      })),
    })),
  };
}

async function writeBackup({ projectId, operation, snapshots }) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const safeProjectId = projectId.replace(/[^a-z0-9_-]/gi, '_');
  const backupDirectory = path.join(PROJECT_ROOT, '.backups');
  const backupPath = path.join(
    backupDirectory,
    `lessons-html-${safeProjectId}-${operation}-${timestamp}.json`,
  );
  const backup = createBackupDocument({
    projectId,
    operation,
    snapshots,
    createdAt: now.toISOString(),
  });

  await mkdir(backupDirectory, { recursive: true });
  await writeFile(backupPath, `${JSON.stringify(backup, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  return { backupPath, bytes: serializedByteSize(backup) };
}

export async function buildMigrationPlan(db, { operation = 'convert' } = {}) {
  const programSnapshot = await db.collection('curriculumPrograms').get();
  const operations = [];
  const snapshots = [];
  const stats = createStats();

  for (const programDoc of programSnapshot.docs) {
    stats.programs += 1;
    const programPath = programDoc.ref.path;
    const programData = programDoc.data();
    const lessonSnapshot = await programDoc.ref.collection('lessons').get();
    snapshots.push({
      path: programPath,
      data: programData,
      lessonDocuments: lessonSnapshot.docs.map((lessonDoc) => ({
        path: lessonDoc.ref.path,
        data: lessonDoc.data(),
      })),
    });

    console.log(`\n${programPath}`);

    if (Array.isArray(programData.lessons)) {
      const embedded = planEmbeddedLessons(programData.lessons, { operation });
      for (const result of embedded.results) {
        const label = result.lessonId ? ` id=${result.lessonId}` : '';
        recordResult(stats, `${programPath}#lessons[${result.index}]${label}`, result);
      }

      if (embedded.changed) {
        const programBytes = serializedByteSize({ ...programData, lessons: embedded.nextLessons });
        if (programBytes > MAX_LESSON_BYTES) {
          stats.errors += 1;
          incrementReason(stats.errorReasons, 'embedded-program-too-large');
          console.error(
            `  ERROR  ${programPath} · embedded-program-too-large ` +
              `serialized=${formatBytes(programBytes)} limit=${formatBytes(MAX_LESSON_BYTES)}`,
          );
        } else {
          operations.push({
            ref: programDoc.ref,
            path: programPath,
            patch: { lessons: embedded.nextLessons },
            affectedLessons: embedded.results.filter((result) => result.status === 'change').length,
          });
        }
      }
    }

    for (const lessonDoc of lessonSnapshot.docs) {
      const result = planLessonMutation(lessonDoc.data(), { operation });
      recordResult(stats, lessonDoc.ref.path, result);
      if (result.status === 'change') {
        operations.push({
          ref: lessonDoc.ref,
          path: lessonDoc.ref.path,
          patch: result.patch,
          affectedLessons: 1,
        });
      }
    }
  }

  stats.writes = operations.length;
  return { operations, snapshots, stats };
}

async function commitOperations(db, operations) {
  let committed = 0;
  for (let index = 0; index < operations.length; index += WRITE_BATCH_SIZE) {
    const chunk = operations.slice(index, index + WRITE_BATCH_SIZE);
    const batch = db.batch();
    for (const operation of chunk) batch.update(operation.ref, operation.patch);
    await batch.commit();
    committed += chunk.length;
    console.log(`Committed ${committed}/${operations.length} document writes.`);
  }
}

function printReasonMap(label, values) {
  if (!values.size) return;
  console.log(
    `${label}: ${[...values.entries()].map(([key, count]) => `${key}=${count}`).join(', ')}`,
  );
}

function printSummary(stats, { apply, operation }) {
  console.log('\n--- Summary ---');
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'} · operation=${operation}`);
  console.log(
    `Programs=${stats.programs} lessons=${stats.lessons} changes=${stats.changes} ` +
      `skips=${stats.skips} errors=${stats.errors} documentWrites=${stats.writes}`,
  );
  console.log(
    `Markdown=${formatBytes(stats.markdownBytes)} HTML=${formatBytes(stats.htmlBytes)} ` +
      `plannedLessonData=${formatBytes(stats.serializedBytes)}`,
  );
  printReasonMap('Skip reasons', stats.skipReasons);
  printReasonMap('Error reasons', stats.errorReasons);
}

export async function runMigration({
  db,
  projectId,
  apply,
  operation,
  backupWriter = writeBackup,
  operationsCommitter = commitOperations,
}) {
  console.log(`Project: ${projectId}`);
  console.log(`Mode: ${apply ? 'APPLY (writes enabled)' : 'DRY-RUN (no writes)'}`);
  console.log(`Operation: ${operation}`);
  console.log(`Lesson size limit: ${formatBytes(MAX_LESSON_BYTES)}`);

  const plan = await buildMigrationPlan(db, { operation });
  printSummary(plan.stats, { apply, operation });

  if (!apply) {
    console.log('\nDry-run complete. No backup was needed and no Firestore writes were made.');
    return { ...plan, backup: null };
  }

  if (plan.stats.errors > 0) {
    throw new Error(
      `Apply aborted because planning found ${plan.stats.errors} error(s). ` +
        'No backup or Firestore writes were made. Resolve every error and run dry-run again.',
    );
  }

  const backup = await backupWriter({
    projectId,
    operation,
    snapshots: plan.snapshots,
  });
  console.log(
    `\nBackup created before writes: ${backup.backupPath} (${formatBytes(backup.bytes)})`,
  );

  if (!plan.operations.length) {
    console.log('Nothing to write. Firestore was not changed.');
    return { ...plan, backup };
  }

  await operationsCommitter(db, plan.operations);
  console.log('Migration complete. Markdown and existing metadata were retained.');
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
  const db = getFirestore();
  await runMigration({ db, projectId, ...options });
}

const isDirectInvocation =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectInvocation) {
  main().catch((error) => {
    console.error(`Migration failed: ${error instanceof Error ? error.stack : String(error)}`);
    process.exitCode = 1;
  });
}
