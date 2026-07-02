import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { toPracticeQuizSubmissionModel } from '../models/index.js';

function mapQuizLatestSnapshot(snapshot) {
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    attemptNumber: Number(data.attemptNumber ?? 0),
    lessonId: data.lessonId ?? '',
  };
}

function buildActivityMap(lessons, practiceByLesson, quizByLesson) {
  const activity = {};
  for (const lesson of lessons) {
    const practice = practiceByLesson.get(lesson.id);
    const quizLatest = quizByLesson.get(lesson.id);
    activity[lesson.id] = {
      practiceDone: Boolean(practice?.mcqTotal),
      practiceScore: practice?.mcqPercent ?? null,
      quizSubmitted: Number(quizLatest?.attemptNumber ?? 0) > 0,
    };
  }
  return activity;
}

async function loadStudentLessonActivityByQuery(classCode, studentId, lessons) {
  const lessonIds = new Set(lessons.map((lesson) => lesson.id));

  const [practiceSnap, quizLatestSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, 'practiceQuizSubmissions'),
        where('classCode', '==', classCode),
        where('studentId', '==', studentId),
        limit(100),
      ),
    ),
    getDocs(
      query(
        collection(db, 'studentQuizLatest'),
        where('classCode', '==', classCode),
        where('studentId', '==', studentId),
        limit(100),
      ),
    ),
  ]);

  const practiceByLesson = new Map();
  practiceSnap.docs.forEach((docSnap) => {
    const row = toPracticeQuizSubmissionModel(docSnap);
    if (lessonIds.has(row.lessonId)) practiceByLesson.set(row.lessonId, row);
  });

  const quizByLesson = new Map();
  quizLatestSnap.docs.forEach((docSnap) => {
    const row = mapQuizLatestSnapshot(docSnap);
    if (row?.lessonId && lessonIds.has(row.lessonId)) quizByLesson.set(row.lessonId, row);
  });

  return buildActivityMap(lessons, practiceByLesson, quizByLesson);
}

async function loadStudentLessonActivityByDocs(classCode, studentId, lessons) {
  const practiceByLesson = new Map();
  const quizByLesson = new Map();

  await Promise.all(
    lessons.flatMap((lesson) => {
      const activityId = `${classCode}__${studentId}__${lesson.id}`;
      return [
        getDoc(doc(db, 'practiceQuizSubmissions', activityId))
          .then((snapshot) => {
            if (snapshot.exists()) practiceByLesson.set(lesson.id, toPracticeQuizSubmissionModel(snapshot));
          })
          .catch(() => {
            // Optional activity preload: missing/denied docs mean no visible submission yet.
          }),
        getDoc(doc(db, 'studentQuizLatest', activityId))
          .then((snapshot) => {
            const row = mapQuizLatestSnapshot(snapshot);
            if (row) quizByLesson.set(lesson.id, { ...row, lessonId: lesson.id });
          })
          .catch(() => {
            // Optional activity preload: missing/denied docs mean no visible submission yet.
          }),
      ];
    }),
  );

  return buildActivityMap(lessons, practiceByLesson, quizByLesson);
}

/** Batch-load practice + quiz status for a student, with direct-read fallback for public rules. */
export async function loadStudentLessonActivity(classCode, studentId, lessons) {
  if (!classCode || !studentId || !lessons?.length) return {};

  try {
    return await loadStudentLessonActivityByQuery(classCode, studentId, lessons);
  } catch (error) {
    console.warn('[lessonActivity] Batch query failed, falling back to direct reads', error);
    return loadStudentLessonActivityByDocs(classCode, studentId, lessons);
  }
}
