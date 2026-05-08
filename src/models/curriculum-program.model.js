import {
  normalizeExamChecklistItemRecord,
  normalizeLessonRecord,
  normalizeProjectChecklistRecords,
  normalizeSessionActivities,
  sortCurriculumChecklist,
  sortCurriculumLessons,
} from '../utils/curriculum-program.js';

function normalizeLessons(lessons = []) {
  if (!Array.isArray(lessons)) {
    return [];
  }

  return sortCurriculumLessons(
    lessons.map((lesson, index) => normalizeLessonRecord(lesson, `lesson-${index + 1}`)),
  );
}

function normalizeChecklist(programId, finalMode, checklist = []) {
  if (!Array.isArray(checklist)) {
    return finalMode === 'project' ? normalizeProjectChecklistRecords(programId, []) : [];
  }

  if (finalMode === 'project') {
    return normalizeProjectChecklistRecords(programId, checklist);
  }

  return sortCurriculumChecklist(
    checklist.map((item, index) =>
      normalizeExamChecklistItemRecord(item, `checklist-${index + 1}`),
    ),
  );
}

export function toCurriculumProgramModelFromData(id, data = {}) {
  const finalMode = data.finalMode === 'exam' ? 'exam' : 'project';
  const totalSessionCount = Number(data.totalSessionCount ?? data.knowledgePhaseEndSession ?? 14);

  return {
    id,
    name: data.name ?? '',
    subject: data.subject ?? '',
    level: data.level ?? '',
    knowledgePhaseEndSession: Number(data.knowledgePhaseEndSession ?? 1),
    totalSessionCount,
    finalMode,
    description: data.description ?? '',
    active: Boolean(data.active ?? true),
    lessons: normalizeLessons(data.lessons),
    sessionActivities: normalizeSessionActivities(data.sessionActivities, totalSessionCount),
    finalChecklist: normalizeChecklist(id, finalMode, data.finalChecklist),
  };
}

export function toCurriculumProgramModel(snapshot) {
  return toCurriculumProgramModelFromData(snapshot.id, snapshot.data());
}
