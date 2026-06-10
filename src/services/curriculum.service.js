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
import { normalizeLesson, toCurriculumProgramModel } from '../models/index.js';

const programsRef = collection(db, 'curriculumPrograms');

export const PROGRAM_ID_ALIASES = {
  'python-app-basic': 'python-basic',
  'python-app-advanced': 'python-advanced',
};

export function resolveProgramId(programId) {
  if (!programId) return programId;
  return PROGRAM_ID_ALIASES[programId] ?? programId;
}

function lessonsCollection(programId) {
  const resolved = resolveProgramId(programId);
  return collection(db, 'curriculumPrograms', resolved, 'lessons');
}

function programDocRef(programId) {
  return doc(db, 'curriculumPrograms', resolveProgramId(programId));
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

function serializeLesson(lesson) {
  const raw = lesson._raw && typeof lesson._raw === 'object' ? lesson._raw : {};
  const banner = imageToStore(lesson.bannerImage);
  const cover = imageToStore(lesson.coverImage);
  const images = cover
    ? [{ ...cover, order: 1 }]
    : (Array.isArray(lesson.images) ? lesson.images.map(imageToStore).filter(Boolean) : []);

  const next = {
    ...raw,
    id: lesson.id,
    sessionNumber: Number(lesson.sessionNumber) || 1,
    title: lesson.title ?? '',
    lectureMarkdown: lesson.content ?? '',
    contentMarkdown: lesson.content ?? '',
    exerciseMarkdown: lesson.exercise ?? '',
    exerciseVisible: Boolean(lesson.exerciseVisible),
    archived: Boolean(lesson.archived),
    bannerImage: banner,
    coverImage: cover,
    images,
  };
  delete next._raw;
  delete next.bannerImageUrl;
  delete next.coverImageUrl;
  delete next.content;
  delete next.exercise;
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
    bannerImage: banner,
    coverImage: cover,
    images: cover ? [{ ...cover, order: 1 }] : [],
  };
}

function slimLessonsFromIndex(lessonIndex = []) {
  return lessonIndex
    .map((row, index) =>
      normalizeLesson(
        {
          ...row,
          lectureMarkdown: '',
          contentMarkdown: '',
          exerciseMarkdown: '',
        },
        index,
      ),
    )
    .sort((a, b) => a.sessionNumber - b.sessionNumber);
}

async function loadLessonsFromSubcollection(programId) {
  const snapshot = await getDocs(
    query(lessonsCollection(programId), orderBy('sessionNumber', 'asc')),
  );
  return snapshot.docs
    .map((lessonDoc, index) =>
      normalizeLesson({ ...lessonDoc.data(), id: lessonDoc.id }, index),
    )
    .sort((a, b) => a.sessionNumber - b.sessionNumber);
}

async function resolveLessonsForProgram(data, programId, { full = true } = {}) {
  if (data.lessonsStorage === 'subcollection') {
    if (full) return loadLessonsFromSubcollection(programId);
    return slimLessonsFromIndex(data.lessonIndex || []);
  }

  const embedded = Array.isArray(data.lessons) ? data.lessons : [];
  const normalized = embedded
    .map((lesson, index) => normalizeLesson(lesson, index))
    .sort((a, b) => a.sessionNumber - b.sessionNumber);

  if (full) return normalized;
  return normalized.map((lesson) => ({
    ...lesson,
    content: '',
    exercise: '',
  }));
}

async function readProgramSnapshot(programId) {
  const resolved = resolveProgramId(programId);
  let snapshot = await getDoc(doc(db, 'curriculumPrograms', resolved));
  if (!snapshot.exists() && resolved !== programId) {
    snapshot = await getDoc(doc(db, 'curriculumPrograms', programId));
  }
  return snapshot.exists() ? snapshot : null;
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
  await updateDoc(programDocRef(programId), {
    ...normalizeMeta(meta),
    updatedAt: serverTimestamp(),
  });
}

export async function listCurriculumPrograms() {
  const snapshot = await getDocs(query(programsRef, orderBy('name', 'asc')));
  return snapshot.docs.map((snap) => toCurriculumProgramModel(snap, []));
}

/** full=false: chỉ metadata + lessonIndex (học sinh — không tải markdown). */
export async function getCurriculumProgram(programId, { full = true } = {}) {
  const snapshot = await readProgramSnapshot(programId);
  if (!snapshot) return null;
  const lessons = await resolveLessonsForProgram(snapshot.data(), snapshot.id, { full });
  return toCurriculumProgramModel(snapshot, lessons);
}

export async function getProgramLesson(programId, lessonId) {
  if (!programId || !lessonId) return null;
  const resolved = resolveProgramId(programId);
  const lessonSnap = await getDoc(doc(db, 'curriculumPrograms', resolved, 'lessons', lessonId));
  if (lessonSnap.exists()) {
    return normalizeLesson({ ...lessonSnap.data(), id: lessonSnap.id }, 0);
  }
  const program = await getCurriculumProgram(programId, { full: true });
  return program?.lessons?.find((lesson) => lesson.id === lessonId) ?? null;
}

export function subscribeCurriculumProgram(programId, onData, onError) {
  if (!programId) return () => {};
  const resolved = resolveProgramId(programId);
  const ref = doc(db, 'curriculumPrograms', resolved);
  return onSnapshot(
    ref,
    async (snapshot) => {
      try {
        if (!snapshot.exists()) {
          if (resolved !== programId) {
            const legacy = await getDoc(doc(db, 'curriculumPrograms', programId));
            onData(legacy.exists() ? toCurriculumProgramModel(legacy) : null);
            return;
          }
          onData(null);
          return;
        }
        const lessons = await resolveLessonsForProgram(snapshot.data(), snapshot.id, { full: true });
        onData(toCurriculumProgramModel(snapshot, lessons));
      } catch (error) {
        onError?.(error);
      }
    },
    onError,
  );
}

export async function saveProgramLessons(programId, lessons) {
  const resolved = resolveProgramId(programId);
  const progRef = doc(db, 'curriculumPrograms', resolved);
  const existing = await getDocs(lessonsCollection(resolved));
  const nextIds = new Set(lessons.map((lesson) => lesson.id));

  const batch = writeBatch(db);
  lessons.forEach((lesson) => {
    batch.set(
      doc(db, 'curriculumPrograms', resolved, 'lessons', lesson.id),
      serializeLesson(lesson),
      { merge: true },
    );
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
