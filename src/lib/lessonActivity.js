import { collection, getDocs, limit, query, where } from 'firebase/firestore';
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

/** Batch-load practice + quiz status for a student (2 queries instead of N×2). */
export async function loadStudentLessonActivity(classCode, studentId, lessons) {
  if (!classCode || !studentId || !lessons?.length) return {};

  const lessonIds = new Set(lessons.map((l) => l.id));

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
