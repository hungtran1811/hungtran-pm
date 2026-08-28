import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { hasRenderableLessonHtml, resolveLessonPresentationPreset } from '../lib/lessonHtml.js';
import { normalizeLesson, toCurriculumProgramModel } from '../models/index.js';

const programsRef = collection(db, 'curriculumPrograms');

/**
 * Map ID cũ → ID chuẩn (dùng cho quiz bank keys khi ghi).
 * Bài giảng luôn ghi theo document ID thực trên Firestore (getProgramDocId).
 */
export const PROGRAM_ID_ALIASES = {
  'python-app-basic': 'python-basic',
  'python-app-advanced': 'python-advanced',
};

export function resolveProgramId(programId) {
  if (!programId) return programId;
  return PROGRAM_ID_ALIASES[programId] ?? programId;
}

/** Các curriculumPrograms/{id} cần thử khi đọc (ưu tiên id gốc trước). */
export function programDocIdCandidates(programId) {
  if (!programId) return [];
  const ids = [];
  const seen = new Set();
  const add = (id) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };

  add(programId);
  add(resolveProgramId(programId));
  for (const [legacy, canonical] of Object.entries(PROGRAM_ID_ALIASES)) {
    if (
      legacy === programId ||
      canonical === programId ||
      canonical === resolveProgramId(programId)
    ) {
      add(legacy);
      add(canonical);
    }
  }
  return ids;
}

function lessonsCollection(programDocId) {
  return collection(db, 'curriculumPrograms', programDocId, 'lessons');
}

function normalizeMeta(meta = {}) {
  return {
    name: meta.name?.trim() ?? '',
    subject: meta.subject?.trim() ?? '',
    level: meta.level?.trim() ?? '',
    description: meta.description?.trim() ?? '',
    active: Boolean(meta.active),
    totalSessionCount: Number(meta.totalSessionCount) || 14,
    knowledgePhaseEndSession: Number(meta.knowledgePhaseEndSession) || 1,
    finalMode: meta.finalMode === 'exam' ? 'exam' : 'project',
  };
}

function imageToStore(img) {
  if (!img || !img.secureUrl) return null;
  return {
    id: img.id || '',
    secureUrl: img.secureUrl,
    publicId: img.publicId || '',
    width: Number(img.width || 0),
    height: Number(img.height || 0),
    alt: img.alt || '',
    order: Number(img.order || 1),
  };
}

/** Gallery images (excludes banner). Preserves all supplementary images when cover is set. */
function collectLessonGalleryImages(lesson) {
  const bannerUrl = imageToStore(lesson.bannerImage)?.secureUrl;
  const seen = new Set();
  const list = [];
  const add = (img) => {
    const stored = imageToStore(img);
    if (!stored || seen.has(stored.secureUrl)) return;
    if (bannerUrl && stored.secureUrl === bannerUrl) return;
    seen.add(stored.secureUrl);
    list.push(stored);
  };
  if (Array.isArray(lesson.images)) {
    lesson.images.forEach(add);
  }
  const cover = imageToStore(lesson.coverImage);
  if (cover && !seen.has(cover.secureUrl)) {
    list.unshift({ ...cover, order: cover.order || 1 });
  }
  return list;
}

export const LESSON_DOCUMENT_MAX_BYTES = 750 * 1024;

export function lessonDocumentSizeBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function normalizeHtmlPartForStorage(source, label) {
  const rawSource = typeof source === 'string' ? source : source == null ? '' : String(source);
  if (rawSource.trim() && !hasRenderableLessonHtml(rawSource)) {
    throw new Error(
      `${label} không có nội dung HTML tĩnh có thể hiển thị sau khi loại script/iframe.`,
    );
  }
  return rawSource;
}

function serializeHtmlPart(lesson, raw, { field, renderFormatField, value, label }) {
  const rawHtml = raw[field];
  const isRetainedMarkdownFallback =
    lesson[renderFormatField] === 'markdown' && raw.contentFormat === 'html';
  // A broken historic HTML value may currently be falling back to retained
  // Markdown. Preserve that raw value when another lesson in the program is
  // saved; opening this lesson in the editor converts the fallback explicitly.
  if (isRetainedMarkdownFallback) return typeof rawHtml === 'string' ? rawHtml : '';
  return normalizeHtmlPartForStorage(value, label);
}

export function serializeLesson(lesson) {
  const raw = lesson._raw && typeof lesson._raw === 'object' ? lesson._raw : {};
  const hasRawContent = Object.prototype.hasOwnProperty.call(raw, 'content');
  const hasRawExercise = Object.prototype.hasOwnProperty.call(raw, 'exercise');
  const banner = imageToStore(lesson.bannerImage);
  const cover = imageToStore(lesson.coverImage);
  const images = collectLessonGalleryImages(lesson);
  const contentFormat = lesson.contentFormat === 'html' ? 'html' : 'markdown';
  const presentationSource = (
    contentFormat === 'html'
      ? [lesson.content, lesson.exercise, raw.lectureHtml, raw.exerciseHtml]
      : [raw.lectureHtml, raw.exerciseHtml]
  )
    .filter((value) => typeof value === 'string')
    .join('\n');
  const presentationPreset = resolveLessonPresentationPreset(
    presentationSource,
    lesson.presentationPreset ?? raw.presentationPreset,
  );

  const next = {
    ...raw,
    id: lesson.id,
    sessionNumber: Number(lesson.sessionNumber) || 1,
    title: lesson.title ?? '',
    contentFormat,
    presentationPreset,
    exerciseVisible: Boolean(lesson.exerciseVisible),
    archived: Boolean(lesson.archived),
    bannerImage: banner,
    coverImage: cover,
    images,
  };
  if (contentFormat === 'html') {
    next.lectureHtml = serializeHtmlPart(lesson, raw, {
      field: 'lectureHtml',
      renderFormatField: 'contentRenderFormat',
      value: lesson.content,
      label: 'Nội dung bài giảng',
    });
    next.exerciseHtml = serializeHtmlPart(lesson, raw, {
      field: 'exerciseHtml',
      renderFormatField: 'exerciseRenderFormat',
      value: lesson.exercise,
      label: 'Nội dung bài tập',
    });
  } else {
    next.lectureMarkdown = lesson.content ?? '';
    next.contentMarkdown = lesson.content ?? '';
    next.exerciseMarkdown = lesson.exercise ?? '';
  }
  delete next._raw;
  delete next.bannerImageUrl;
  delete next.coverImageUrl;
  delete next.content;
  delete next.exercise;
  // `content`/`exercise` are also legacy Markdown aliases. Keep the raw values
  // when they came from Firestore; the normalized editor fields must never
  // overwrite them with HTML, but rollback still needs the original text.
  if (hasRawContent) next.content = raw.content;
  if (hasRawExercise) next.exercise = raw.exercise;
  if (lessonDocumentSizeBytes(next) > LESSON_DOCUMENT_MAX_BYTES) {
    throw new Error(
      'Bài giảng vượt quá giới hạn 750 KiB. Hãy rút gọn HTML hoặc bớt nội dung nhúng.',
    );
  }
  return next;
}

function toSlimLessonIndex(lesson) {
  const banner = imageToStore(lesson.bannerImage);
  const cover = imageToStore(lesson.coverImage);
  return {
    id: lesson.id,
    sessionNumber: Number(lesson.sessionNumber) || 1,
    title: lesson.title ?? '',
    archived: Boolean(lesson.archived),
    exerciseVisible: Boolean(lesson.exerciseVisible),
    presentationPreset: resolveLessonPresentationPreset('', lesson.presentationPreset),
    bannerImage: banner,
    coverImage: cover,
    images: collectLessonGalleryImages(lesson),
  };
}

function lessonIndexFields(lesson = {}) {
  return {
    id: lesson.id,
    sessionNumber: lesson.sessionNumber,
    title: lesson.title,
    archived: lesson.archived,
    exerciseVisible: lesson.exerciseVisible,
    presentationPreset: lesson.presentationPreset,
    bannerImage: lesson.bannerImage,
    coverImage: lesson.coverImage,
    images: lesson.images,
    contentFormat: lesson.contentFormat,
  };
}

export function isSlimLesson(lesson) {
  return Boolean(lesson?._slim);
}

function slimLessonsFromIndex(lessonIndex = []) {
  return lessonIndex
    .map((row, index) => ({
      ...normalizeLesson(
        {
          ...lessonIndexFields(row),
          lectureMarkdown: '',
          contentMarkdown: '',
          exerciseMarkdown: '',
        },
        index,
      ),
      _slim: true,
    }))
    .sort((a, b) => a.sessionNumber - b.sessionNumber);
}

async function loadLessonsFromSubcollection(programDocId) {
  for (const candidateId of programDocIdCandidates(programDocId)) {
    const snapshot = await getDocs(
      query(lessonsCollection(candidateId), orderBy('sessionNumber', 'asc')),
    );
    if (!snapshot.empty) {
      return snapshot.docs
        .map((lessonDoc, index) =>
          normalizeLesson({ ...lessonDoc.data(), id: lessonDoc.id }, index),
        )
        .sort((a, b) => a.sessionNumber - b.sessionNumber);
    }
  }
  return [];
}

async function resolveLessonsForProgram(data, programDocId, { full = true } = {}) {
  if (data.lessonsStorage === 'subcollection') {
    if (full) return loadLessonsFromSubcollection(programDocId);
    const index = Array.isArray(data.lessonIndex) ? data.lessonIndex : [];
    if (index.length) return slimLessonsFromIndex(index);
    const stored = await loadLessonsFromSubcollection(programDocId);
    return slimLessonsFromIndex(stored.map(toSlimLessonIndex));
  }

  const embedded = Array.isArray(data.lessons) ? data.lessons : [];
  if (!full) return slimLessonsFromIndex(embedded);

  return embedded
    .map((lesson, index) => normalizeLesson(lesson, index))
    .sort((a, b) => a.sessionNumber - b.sessionNumber);
}

async function readProgramSnapshot(programId) {
  for (const candidateId of programDocIdCandidates(programId)) {
    const snapshot = await getDoc(doc(db, 'curriculumPrograms', candidateId));
    if (snapshot.exists()) return snapshot;
  }
  return null;
}

/** Document ID thực trên Firestore — dùng cho mọi thao tác GHI bài giảng. */
export async function getProgramDocId(programId) {
  const snapshot = await readProgramSnapshot(programId);
  return snapshot?.id ?? programId;
}

export async function createProgram(programId, meta) {
  const id = programId.trim();
  await setDoc(doc(db, 'curriculumPrograms', id), {
    ...normalizeMeta(meta),
    lessons: [],
    lessonIndex: [],
    lessonsStorage: 'embedded',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function updateProgramMeta(programId, meta) {
  const docId = await getProgramDocId(programId);
  const snapshot = await readProgramSnapshot(programId);
  if (!snapshot) {
    throw new Error('Không tìm thấy chương trình học.');
  }
  await updateDoc(doc(db, 'curriculumPrograms', docId), {
    ...normalizeMeta(meta),
    updatedAt: serverTimestamp(),
  });
}

export async function listCurriculumPrograms() {
  const snapshot = await getDocs(query(programsRef, orderBy('name', 'asc')));
  return snapshot.docs.map((snap) => toCurriculumProgramModel(snap, []));
}

/** full=false: chỉ metadata + lessonIndex (học sinh — không tải nội dung bài). */
export async function getCurriculumProgram(programId, { full = true } = {}) {
  const snapshot = await readProgramSnapshot(programId);
  if (!snapshot) return null;
  const lessons = await resolveLessonsForProgram(snapshot.data(), snapshot.id, { full });
  return toCurriculumProgramModel(snapshot, lessons);
}

export async function getProgramLesson(programId, lessonId) {
  if (!programId || !lessonId) return null;
  const snapshot = await readProgramSnapshot(programId);
  if (!snapshot) return null;

  for (const candidateId of programDocIdCandidates(snapshot.id)) {
    const lessonSnap = await getDoc(
      doc(db, 'curriculumPrograms', candidateId, 'lessons', lessonId),
    );
    if (lessonSnap.exists()) {
      return normalizeLesson({ ...lessonSnap.data(), id: lessonSnap.id }, 0);
    }
  }

  const embedded = snapshot.data()?.lessons;
  if (Array.isArray(embedded)) {
    const found = embedded.find((lesson, index) => (lesson.id || `lesson-${index + 1}`) === lessonId);
    if (found) return normalizeLesson({ ...found, id: found.id || lessonId }, 0);
  }
  return null;
}

export function subscribeCurriculumProgram(programId, onData, onError) {
  if (!programId) return () => {};

  let unsub = () => {};
  let cancelled = false;

  readProgramSnapshot(programId)
    .then((initial) => {
      if (cancelled) return;
      if (!initial) {
        onData(null);
        return;
      }
      const ref = doc(db, 'curriculumPrograms', initial.id);
      unsub = onSnapshot(
        ref,
        async (snapshot) => {
          try {
            if (!snapshot.exists()) {
              onData(null);
              return;
            }
            const lessons = await resolveLessonsForProgram(snapshot.data(), snapshot.id, {
              full: true,
            });
            onData(toCurriculumProgramModel(snapshot, lessons));
          } catch (error) {
            onError?.(error);
          }
        },
        onError,
      );
    })
    .catch((error) => onError?.(error));

  return () => {
    cancelled = true;
    unsub();
  };
}

export async function saveProgramLessons(programId, lessons) {
  const docId = await getProgramDocId(programId);
  const snapshot = await readProgramSnapshot(programId);
  if (!snapshot) {
    throw new Error('Không tìm thấy chương trình học.');
  }

  const progRef = doc(db, 'curriculumPrograms', docId);
  const existing = await getDocs(collection(db, 'curriculumPrograms', docId, 'lessons'));
  const nextIds = new Set(lessons.map((lesson) => lesson.id));

  const batch = writeBatch(db);
  lessons.forEach((lesson) => {
    if (isSlimLesson(lesson)) return;
    batch.set(doc(db, 'curriculumPrograms', docId, 'lessons', lesson.id), serializeLesson(lesson), {
      merge: true,
    });
  });
  existing.docs.forEach((lessonDoc) => {
    if (!nextIds.has(lessonDoc.id)) {
      batch.delete(lessonDoc.ref);
    }
  });

  batch.update(progRef, {
    lessonIndex: lessons.map(toSlimLessonIndex),
    lessonsStorage: 'subcollection',
    lessons: deleteField(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}
