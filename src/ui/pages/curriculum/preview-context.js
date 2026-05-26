import { normalizeCurriculumExerciseVisibleSessions } from '../../../utils/curriculum.js';
import {
  buildCurriculumVisibleLessons,
  getActiveCurriculumChecklist,
  getActiveCurriculumLessons,
} from '../../../utils/curriculum-program.js';
import { normalizeLessonMarkdownTab } from '../../../utils/lesson-markdown.js';

function applyAssignmentExerciseVisibility(lessons = [], assignment = null) {
  const visibleSessions = new Set(normalizeCurriculumExerciseVisibleSessions(assignment?.exerciseVisibleSessions));

  return lessons.map((lesson) => ({
    ...lesson,
    exerciseVisible: visibleSessions.has(Number(lesson.sessionNumber || 0)),
  }));
}

export function buildPreviewView(classItem, assignment, program) {
  if (!classItem || !assignment || !program) {
    return null;
  }

  const lessons = applyAssignmentExerciseVisibility(getActiveCurriculumLessons(program), assignment);
  const checklistItems = getActiveCurriculumChecklist(program);
  const visibleLessons = buildCurriculumVisibleLessons(program, lessons, assignment);

  return {
    classInfo: classItem,
    assignment,
    program: {
      ...program,
      lessons,
      finalChecklist: checklistItems,
    },
    lessons,
    visibleLessons,
    checklistItems,
  };
}

export function normalizePreviewTab(value) {
  return normalizeLessonMarkdownTab(value);
}

export function getDefaultPreviewLessonId(preview, preferredLessonId = '') {
  const lessons = preview?.visibleLessons || [];

  if (preferredLessonId && lessons.some((lesson) => lesson.id === preferredLessonId)) {
    return preferredLessonId;
  }

  return (
    lessons.find((lesson) => lesson.sessionNumber === preview?.assignment?.currentSession)?.id ||
    lessons[lessons.length - 1]?.id ||
    ''
  );
}
