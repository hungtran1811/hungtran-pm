import { getPracticeSubmission } from '../services/practiceQuiz.service.js';
import { getQuizLatestStatus } from '../services/quiz.service.js';

/** Load practice + quiz submit status per lesson (scores stay admin-only). */
export async function loadStudentLessonActivity(classCode, studentId, lessons) {
  if (!classCode || !studentId || !lessons?.length) return {};

  const pairs = await Promise.all(
    lessons.map(async (lesson) => {
      const [practice, quizLatest] = await Promise.all([
        getPracticeSubmission(classCode, studentId, lesson.id),
        getQuizLatestStatus(classCode, studentId, lesson.id),
      ]);
      return [
        lesson.id,
        {
          practiceDone: Boolean(practice?.mcqTotal),
          practiceScore: practice?.mcqPercent ?? null,
          quizSubmitted: Number(quizLatest?.attemptNumber ?? 0) > 0,
        },
      ];
    }),
  );

  return Object.fromEntries(pairs);
}
