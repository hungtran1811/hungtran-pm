import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { preserveClassCode } from '../../../src/lib/upLevel.js';
import { normalizeClassLookupInput } from '../../../src/lib/classAccessCode.js';
import { LESSON_DOCUMENT_MAX_BYTES } from '../../../src/lib/curriculumSize.js';
import {
  copyDriveFile,
  findOrCreateChildFolder,
  getDriveFileMedia,
} from './driveFolders.js';
import { driveMaterialsRootFolderId } from './googleAuth.js';

const HTML_INLINE_MAX_BYTES = 200 * 1024;

function sha256(value) {
  return createHash('sha256').update(String(value ?? '')).digest('hex');
}

function byteLength(value) {
  return Buffer.byteLength(String(value ?? ''), 'utf8');
}

function lessonDocId(lesson, index) {
  const raw = String(lesson?.id || `lesson-${index + 1}`).replace(/\//g, '_').trim();
  return raw || `lesson-${index + 1}`;
}

function imageRecord(image) {
  if (!image || typeof image !== 'object') return null;
  const secureUrl = String(image.secureUrl || image.url || '').trim();
  if (!secureUrl) return null;
  const publicId = String(image.publicId || '').trim();
  return {
    id: String(image.id || ''),
    secureUrl,
    publicId,
    width: Number(image.width) || 0,
    height: Number(image.height) || 0,
    alt: String(image.alt || ''),
    order: Number(image.order) || 0,
    external: !publicId,
  };
}

function resourceRecord(resource) {
  if (!resource || typeof resource !== 'object') return null;
  const driveFileId = String(resource.driveFileId || '').trim();
  const downloadUrl = String(resource.downloadUrl || '').trim();
  if (!driveFileId && !downloadUrl) return null;
  return {
    id: String(resource.id || ''),
    title: String(resource.title || resource.fileName || ''),
    fileName: String(resource.fileName || ''),
    driveFileId,
    downloadUrl,
    external: !driveFileId,
  };
}

function drivePointer(value) {
  if (!value || typeof value !== 'object') return null;
  const driveFileId = String(value.driveFileId || '').trim();
  if (!driveFileId) return null;
  return {
    driveFileId,
    fileName: String(value.fileName || '').trim(),
    byteSize: Number(value.byteSize) || 0,
  };
}

async function loadClassByCode(db, raw) {
  const exact = preserveClassCode(raw);
  const folded = normalizeClassLookupInput(exact);
  if (!folded) return null;
  const direct = await db.collection('classes').doc(exact).get();
  if (direct.exists) return direct;
  if (folded !== exact) {
    const upper = await db.collection('classes').doc(folded).get();
    if (upper.exists) return upper;
  }
  const all = await db.collection('classes').get();
  return all.docs.find((doc) => {
    const data = doc.data() || {};
    return normalizeClassLookupInput(doc.id) === folded
      || normalizeClassLookupInput(data.classCode) === folded;
  }) || null;
}

async function loadProgramLessons(db, programId) {
  const id = String(programId || '').trim();
  if (!id) return { program: null, lessons: [] };
  const snap = await db.collection('curriculumPrograms').doc(id).get();
  if (!snap.exists) return { program: null, lessons: [] };
  const data = snap.data() || {};
  const program = { id: snap.id, name: String(data.name || '') };
  if (data.lessonsStorage === 'subcollection') {
    const lessons = await snap.ref.collection('lessons').get();
    return {
      program,
      lessons: lessons.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    };
  }
  const embedded = Array.isArray(data.lessons) ? data.lessons : [];
  return {
    program,
    lessons: embedded.map((lesson, index) => ({ id: lesson?.id || `lesson-${index + 1}`, ...lesson })),
  };
}

function selectTaughtLessons(lessons, expectedSessions) {
  const grouped = new Map();
  for (const lesson of lessons) {
    const sessionNumber = Number(lesson.sessionNumber) || 0;
    if (sessionNumber < 1 || sessionNumber > expectedSessions) continue;
    const rows = grouped.get(sessionNumber) || [];
    rows.push(lesson);
    grouped.set(sessionNumber, rows);
  }
  const missingSessions = [];
  const selected = [];
  for (let session = 1; session <= expectedSessions; session += 1) {
    const rows = grouped.get(session) || [];
    if (!rows.length) missingSessions.push(session);
    else selected.push(...rows);
  }
  return { missingSessions, selected };
}

function sourcePayload(lesson) {
  const lectureDrive = drivePointer(lesson.lectureHtmlDrive);
  const exerciseDrive = drivePointer(lesson.exerciseHtmlDrive);
  return {
    sessionNumber: Number(lesson.sessionNumber) || 0,
    title: String(lesson.title || ''),
    lectureMarkdown: String(lesson.lectureMarkdown || lesson.contentMarkdown || lesson.content || ''),
    exerciseMarkdown: String(lesson.exerciseMarkdown || lesson.exercise || ''),
    lectureHtml: lectureDrive ? '' : String(lesson.lectureHtml || ''),
    exerciseHtml: exerciseDrive ? '' : String(lesson.exerciseHtml || ''),
    lectureDriveId: lectureDrive?.driveFileId || '',
    exerciseDriveId: exerciseDrive?.driveFileId || '',
    exerciseVisible: Boolean(lesson.exerciseVisible),
    archived: Boolean(lesson.archived),
    resources: (Array.isArray(lesson.resources) ? lesson.resources : []).map(resourceRecord).filter(Boolean),
  };
}

function sourceContentHash(lesson) {
  return sha256(JSON.stringify(sourcePayload(lesson)));
}

async function defaultEnsureFolder(classCode) {
  const rootId = driveMaterialsRootFolderId();
  const archiveRoot = await findOrCreateChildFolder(rootId, 'lesson-archives');
  return findOrCreateChildFolder(archiveRoot, classCode);
}

function defaultDrive() {
  return {
    ensureFolder: defaultEnsureFolder,
    copyFile: ({ fileId, folderId, name }) => copyDriveFile({ fileId, folderId, name }),
    readFile: (fileId) => getDriveFileMedia(fileId),
  };
}

async function copyHtmlPart({ drive, folderId, sourceId, name }) {
  let sourceText = '';
  try {
    sourceText = await drive.readFile(sourceId);
  } catch {
    return { ok: false, reason: 'missing-drive' };
  }
  const sourceHash = sha256(sourceText);
  let copied;
  try {
    copied = await drive.copyFile({ fileId: sourceId, folderId, name });
  } catch {
    return { ok: false, reason: 'copy-failed' };
  }
  let copiedText = '';
  try {
    copiedText = await drive.readFile(copied.id);
  } catch {
    return { ok: false, reason: 'checksum-mismatch' };
  }
  const archiveHash = sha256(copiedText);
  if (archiveHash !== sourceHash) return { ok: false, reason: 'checksum-mismatch' };
  return {
    ok: true,
    pointer: {
      driveFileId: copied.id,
      sourceDriveFileId: sourceId,
      fileName: name,
      checksum: archiveHash,
      byteSize: byteLength(copiedText),
    },
  };
}

function inlineHtml(value, hasDrive) {
  if (hasDrive) return { html: '', tooLarge: false };
  const html = String(value || '');
  if (!html) return { html: '', tooLarge: false };
  if (byteLength(html) > HTML_INLINE_MAX_BYTES) return { html: '', tooLarge: true };
  return { html, tooLarge: false };
}

async function buildLessonRecord({ lesson, index, drive, folderId, previous }) {
  const id = lessonDocId(lesson, index);
  const source = sourcePayload(lesson);
  const sourceHash = sourceContentHash(lesson);
  const previousHash = previous?.sourceContentHash || '';
  const lectureDrive = drivePointer(lesson.lectureHtmlDrive);
  const exerciseDrive = drivePointer(lesson.exerciseHtmlDrive);
  const lectureInline = inlineHtml(lesson.lectureHtml, Boolean(lectureDrive));
  const exerciseInline = inlineHtml(lesson.exerciseHtml, Boolean(exerciseDrive));
  if (lectureInline.tooLarge || exerciseInline.tooLarge) {
    return { ok: false, id, sessionNumber: source.sessionNumber, reason: 'html-too-large' };
  }

  let lectureArchiveDrive = null;
  let exerciseArchiveDrive = null;
  if (lectureDrive) {
    if (previousHash === sourceHash && previous?.lectureArchiveDrive?.driveFileId) {
      lectureArchiveDrive = previous.lectureArchiveDrive;
    } else {
      const copied = await copyHtmlPart({
        drive,
        folderId,
        sourceId: lectureDrive.driveFileId,
        name: `${id}-lecture.html`,
      });
      if (!copied.ok) return { ok: false, id, sessionNumber: source.sessionNumber, reason: copied.reason };
      lectureArchiveDrive = copied.pointer;
    }
  }
  if (exerciseDrive) {
    if (previousHash === sourceHash && previous?.exerciseArchiveDrive?.driveFileId) {
      exerciseArchiveDrive = previous.exerciseArchiveDrive;
    } else {
      const copied = await copyHtmlPart({
        drive,
        folderId,
        sourceId: exerciseDrive.driveFileId,
        name: `${id}-exercise.html`,
      });
      if (!copied.ok) return { ok: false, id, sessionNumber: source.sessionNumber, reason: copied.reason };
      exerciseArchiveDrive = copied.pointer;
    }
  }

  const images = Array.isArray(lesson.images) ? lesson.images.map(imageRecord).filter(Boolean) : [];
  const coverImage = imageRecord(lesson.coverImage) || images[0] || null;
  const record = {
    sessionNumber: source.sessionNumber,
    title: source.title,
    sourceLessonId: id,
    lectureMarkdown: source.lectureMarkdown,
    exerciseMarkdown: source.exerciseMarkdown,
    lectureHtml: lectureInline.html,
    exerciseHtml: exerciseInline.html,
    exerciseVisible: source.exerciseVisible,
    presentationPreset: String(lesson.presentationPreset || ''),
    contentFormat: lectureDrive || exerciseDrive || lectureInline.html || exerciseInline.html ? 'html' : 'markdown',
    coverImage,
    images,
    resources: source.resources,
    lectureArchiveDrive,
    exerciseArchiveDrive,
    sourceContentHash: sourceHash,
    archived: source.archived,
  };
  record.archiveContentHash = sha256(JSON.stringify({
    title: record.title,
    lectureMarkdown: record.lectureMarkdown,
    exerciseMarkdown: record.exerciseMarkdown,
    lectureHtml: record.lectureHtml,
    exerciseHtml: record.exerciseHtml,
    lectureChecksum: lectureArchiveDrive?.checksum || '',
    exerciseChecksum: exerciseArchiveDrive?.checksum || '',
  }));
  const storedSize = byteLength(JSON.stringify(record));
  if (storedSize > LESSON_DOCUMENT_MAX_BYTES) {
    return { ok: false, id, sessionNumber: source.sessionNumber, reason: 'html-too-large' };
  }
  return { ok: true, id, record };
}

function manifestSummary(data, lessons, extra = {}) {
  return {
    state: data.state || '',
    classCode: data.classCode || '',
    sourceProgramId: data.sourceProgramId || '',
    expectedSessions: Number(data.expectedSessions) || 0,
    archiveLessonCount: Number(data.archiveLessonCount) || 0,
    missingSessions: Array.isArray(data.missingSessions) ? data.missingSessions : [],
    checksumManifest: data.checksumManifest || '',
    archiveVersion: Number(data.archiveVersion) || 0,
    operationId: data.operationId || '',
    provenance: data.provenance || '',
    failures: Array.isArray(data.failures) ? data.failures : [],
    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      sessionNumber: lesson.sessionNumber,
      title: lesson.title,
      archiveContentHash: lesson.archiveContentHash || '',
    })),
    ...extra,
  };
}

async function storedLessons(db, classId) {
  const snap = await db.collection('classLessonArchives').doc(classId).collection('lessons').get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function archiveClassLessons(db, { classCode } = {}, drive = defaultDrive()) {
  const classSnap = await loadClassByCode(db, classCode);
  if (!classSnap) return { ok: false, status: 404, error: 'Không tìm thấy lớp.' };
  const classData = classSnap.data() || {};
  const classId = classSnap.id;
  const storedCode = preserveClassCode(classData.classCode || classId);
  const expectedSessions = Math.max(0, Number(classData.curriculumCurrentSession) || 0);
  const manifestRef = db.collection('classLessonArchives').doc(classId);
  const existingSnap = await manifestRef.get();
  const existing = existingSnap.exists ? existingSnap.data() || {} : null;

  const { program, lessons } = await loadProgramLessons(db, classData.curriculumProgramId);
  const { missingSessions, selected } = selectTaughtLessons(lessons, expectedSessions);
  const sourceChecksum = sha256(selected.map((lesson, index) => `${lessonDocId(lesson, index)}:${sourceContentHash(lesson)}`).sort().join('\n'));

  if (existing?.state === 'ready') {
    const saved = await storedLessons(db, classId);
    return {
      ok: true,
      body: manifestSummary(existing, saved, {
        already: true,
        staleSource: existing.sourceChecksum !== sourceChecksum,
      }),
    };
  }

  const previousById = new Map((await storedLessons(db, classId)).map((lesson) => [lesson.id, lesson]));
  const needsDrive = selected.some((lesson) => drivePointer(lesson.lectureHtmlDrive) || drivePointer(lesson.exerciseHtmlDrive));
  let folderId = '';
  if (needsDrive) folderId = await drive.ensureFolder(storedCode);

  const operationId = existing?.operationId || `archive_${classId}`;
  const archiveVersion = Number(existing?.archiveVersion || 0) + 1;
  await manifestRef.set({
    classCode: storedCode,
    sourceProgramId: program?.id || String(classData.curriculumProgramId || ''),
    programName: program?.name || '',
    curriculumCurrentSessionAtCutover: expectedSessions,
    expectedSessions,
    state: 'preparing',
    operationId,
    archiveVersion,
    provenance: 'at_up_level',
    updatedAt: FieldValue.serverTimestamp(),
    ...(existing ? {} : { createdAt: FieldValue.serverTimestamp() }),
  }, { merge: true });

  const failures = [];
  const records = [];
  for (let index = 0; index < selected.length; index += 1) {
    const built = await buildLessonRecord({
      lesson: selected[index],
      index,
      drive,
      folderId,
      previous: previousById.get(lessonDocId(selected[index], index)),
    });
    if (!built.ok) {
      failures.push({
        lessonId: built.id,
        sessionNumber: built.sessionNumber,
        reason: built.reason,
      });
      continue;
    }
    records.push(built);
  }

  const batch = db.batch();
  const selectedIds = new Set(selected.map((lesson, index) => lessonDocId(lesson, index)));
  for (const item of records) {
    batch.set(manifestRef.collection('lessons').doc(item.id), {
      ...item.record,
      savedAt: FieldValue.serverTimestamp(),
    });
  }
  for (const previousId of previousById.keys()) {
    if (!selectedIds.has(previousId)) batch.delete(manifestRef.collection('lessons').doc(previousId));
  }
  const ready = missingSessions.length === 0 && failures.length === 0;
  const checksumManifest = sha256(records.map((item) => `${item.id}:${item.record.archiveContentHash}`).sort().join('\n'));
  batch.set(manifestRef, {
    state: ready ? 'verifying' : 'failed',
    expectedSessions,
    archiveLessonCount: records.length,
    missingSessions,
    failures,
    sourceChecksum,
    checksumManifest,
    curriculumCurrentSessionAtCutover: expectedSessions,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();

  let verified = ready;
  if (ready) {
    for (const item of records) {
      const saved = await manifestRef.collection('lessons').doc(item.id).get();
      if (!saved.exists || saved.data()?.archiveContentHash !== item.record.archiveContentHash) {
        verified = false;
        failures.push({ lessonId: item.id, sessionNumber: item.record.sessionNumber, reason: 'checksum-mismatch' });
      }
      const lectureId = item.record.lectureArchiveDrive?.driveFileId;
      if (lectureId) {
        try {
          const text = await drive.readFile(lectureId);
          if (sha256(text) !== item.record.lectureArchiveDrive.checksum) {
            verified = false;
            failures.push({ lessonId: item.id, sessionNumber: item.record.sessionNumber, reason: 'checksum-mismatch' });
          }
        } catch {
          verified = false;
          failures.push({ lessonId: item.id, sessionNumber: item.record.sessionNumber, reason: 'checksum-mismatch' });
        }
      }
    }
  }

  const state = verified ? 'ready' : 'failed';
  await manifestRef.set({
    state,
    failures,
    archiveLessonCount: records.length,
    archivedAt: verified ? FieldValue.serverTimestamp() : null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const saved = records.map((item) => ({ id: item.id, ...item.record }));
  const manifest = (await manifestRef.get()).data() || {};
  return { ok: true, body: manifestSummary(manifest, saved, { already: false, staleSource: false }) };
}

export async function readArchivedLesson(db, { classCode, lessonId } = {}) {
  const classSnap = await loadClassByCode(db, classCode);
  if (!classSnap) return { ok: false, status: 404, error: 'Không tìm thấy lớp.' };
  const id = String(lessonId || '').trim();
  if (!id) return { ok: false, status: 400, error: 'Thiếu mã bài giảng.' };
  const manifestRef = db.collection('classLessonArchives').doc(classSnap.id);
  const manifest = await manifestRef.get();
  if (!manifest.exists) return { ok: false, status: 404, error: 'Lớp này chưa có kho bài giảng.' };
  const lesson = await manifestRef.collection('lessons').doc(id).get();
  if (!lesson.exists) return { ok: false, status: 404, error: 'Không tìm thấy bài đã lưu.' };
  const data = lesson.data() || {};
  return {
    ok: true,
    body: {
      id: lesson.id,
      state: manifest.data()?.state || '',
      sessionNumber: data.sessionNumber || 0,
      title: data.title || '',
      lectureMarkdown: data.lectureMarkdown || '',
      exerciseMarkdown: data.exerciseMarkdown || '',
      lectureHtml: data.lectureHtml || '',
      exerciseHtml: data.exerciseHtml || '',
      lectureArchiveDrive: data.lectureArchiveDrive || null,
      exerciseArchiveDrive: data.exerciseArchiveDrive || null,
      sourceContentHash: data.sourceContentHash || '',
      archiveContentHash: data.archiveContentHash || '',
      resources: data.resources || [],
    },
  };
}
