import { normalizeLessonKey } from './submissionFileName.js';
import { sessionNumbersUpToCurrent } from './sessionScope.js';

export function buildLessonOptions(classDoc, program) {
  const lessons = (program?.lessons || []).filter((lesson) => !lesson?.archived);
  if (lessons.length) {
    return lessons.map((lesson) => {
      const sessionNumber = Number(lesson.sessionNumber) || 0;
      const value = normalizeLessonKey(sessionNumber);
      const title = String(lesson.title || '').trim();
      return {
        value,
        sessionNumber,
        label: title ? `Buổi ${sessionNumber} — ${title}` : `Buổi ${sessionNumber}`,
      };
    });
  }

  const current = Number(classDoc?.curriculumCurrentSession || 0);
  const total = Number(program?.totalSessionCount || 0);
  const max = Math.max(current, total, 1);
  return Array.from({ length: max }, (_, index) => {
    const sessionNumber = index + 1;
    return {
      value: normalizeLessonKey(sessionNumber),
      sessionNumber,
      label: `Buổi ${sessionNumber}`,
    };
  });
}

/** Chỉ buổi giáo viên đã mở cho lớp (1 … buổi hiện tại). */
export function buildStudentLessonOptions(classDoc, program) {
  const sessions = sessionNumbersUpToCurrent(classDoc);
  if (!sessions.length) return [];
  const catalog = new Map(
    buildLessonOptions(classDoc, program).map((item) => [item.sessionNumber, item]),
  );
  return sessions.map((sessionNumber) => {
    return (
      catalog.get(sessionNumber) || {
        value: normalizeLessonKey(sessionNumber),
        sessionNumber,
        label: `Buổi ${sessionNumber}`,
      }
    );
  });
}

export function defaultLessonKey(classDoc, program) {
  const current = Number(classDoc?.curriculumCurrentSession || 0);
  if (current > 0) return normalizeLessonKey(current);
  const options = buildStudentLessonOptions(classDoc, program);
  return options[options.length - 1]?.value || '';
}
