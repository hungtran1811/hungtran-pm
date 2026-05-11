import { toDate } from '../utils/date.js';
import { normalizeQuizMode, QUIZ_MODE_OFFICIAL } from '../utils/quiz.js';
import { normalizeCurriculumExerciseVisibleSessions } from '../utils/curriculum.js';

export function toClassModel(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    classCode: data.classCode ?? snapshot.id,
    className: data.className ?? '',
    status: data.status ?? 'active',
    hidden: Boolean(data.hidden),
    startDate: data.startDate ?? '',
    endDate: data.endDate ?? '',
    studentCount: Number(data.studentCount ?? 0),
    curriculumProgramId: data.curriculumProgramId ?? '',
    curriculumCurrentSession: Number(data.curriculumCurrentSession ?? 1),
    curriculumPhase: data.curriculumPhase === 'final' ? 'final' : 'learning',
    curriculumExerciseVisibleSessions: normalizeCurriculumExerciseVisibleSessions(data.curriculumExerciseVisibleSessions),
    activeQuizSessionNumber: Number(data.activeQuizSessionNumber ?? 0),
    activeQuizMode: normalizeQuizMode(data.activeQuizMode || QUIZ_MODE_OFFICIAL),
    quizStatus: String(data.quizStatus ?? 'idle').trim().toLowerCase() === 'started' ? 'started' : 'idle',
    quizStartedAt: toDate(data.quizStartedAt),
    quizEndedAt: toDate(data.quizEndedAt),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function getClassDefaults() {
  return {
    classCode: '',
    className: '',
    status: 'active',
    hidden: false,
    startDate: '',
    endDate: '',
    curriculumProgramId: '',
    curriculumCurrentSession: 1,
    curriculumPhase: 'learning',
    curriculumExerciseVisibleSessions: [],
    activeQuizSessionNumber: 0,
    activeQuizMode: QUIZ_MODE_OFFICIAL,
    quizStatus: 'idle',
  };
}
