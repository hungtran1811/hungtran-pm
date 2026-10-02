import { DEFAULT_DIFFICULTIES } from '../constants/index.js';
import { isValidLessonKey, lessonKeysEqual, normalizeLessonKey } from './submissionFileName.js';

export const REPORT_TEXT_MIN_CHARS = 40;
export const REPORT_TEXT_MIN_BULLETS = 3;

export function resolveDifficulties(status, difficulties) {
  const text = String(difficulties ?? '').trim();
  if (status === 'Cần hỗ trợ') return text;
  return text || DEFAULT_DIFFICULTIES;
}

export function countBulletLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .filter((line) => /^\s*[-–—*•]/.test(line) && line.replace(/^\s*[-–—*•]\s*/, '').trim())
    .length;
}

export function reportTextError(label, text, { required = true } = {}) {
  const value = String(text || '').trim();
  if (!value) return required ? `Phần "${label}" cần ít nhất ${REPORT_TEXT_MIN_BULLETS} gạch đầu dòng.` : null;
  if (countBulletLines(value) < REPORT_TEXT_MIN_BULLETS) {
    return `Phần "${label}" cần ít nhất ${REPORT_TEXT_MIN_BULLETS} gạch đầu dòng.`;
  }
  if (value.length < REPORT_TEXT_MIN_CHARS) {
    return `Phần "${label}" cần ít nhất ${REPORT_TEXT_MIN_CHARS} ký tự.`;
  }
  return null;
}

export function reportSubmittedTime(report) {
  return report?.submittedAt?.getTime?.() || 0;
}

export function latestReportsByStudentLesson(reports = []) {
  const byStudent = new Map();
  for (const report of reports) {
    const lessonKey = normalizeLessonKey(report.lessonKey);
    if (!report?.studentId || !lessonKey) continue;
    let lessons = byStudent.get(report.studentId);
    if (!lessons) {
      lessons = new Map();
      byStudent.set(report.studentId, lessons);
    }
    const current = lessons.get(lessonKey);
    if (!current || reportSubmittedTime(report) >= reportSubmittedTime(current)) {
      lessons.set(lessonKey, report);
    }
  }
  return byStudent;
}

export function latestReportForLesson(lessons, lessonKey = '') {
  if (!lessons?.size) return null;
  if (lessonKey) return lessons.get(normalizeLessonKey(lessonKey)) || null;
  let latest = null;
  for (const report of lessons.values()) {
    if (!latest || reportSubmittedTime(report) >= reportSubmittedTime(latest)) {
      latest = report;
    }
  }
  return latest;
}

export function hasOverlappingLesson(lessons, drive) {
  if (!lessons?.size || !drive?.files?.length) return false;
  return drive.files.some((file) => {
    const key = normalizeLessonKey(file.lessonKey);
    return key && lessons.has(key);
  });
}

export function scopeDriveToLesson(drive, lessonKey = '') {
  if (!drive) return null;
  const files = lessonKey
    ? (drive.files || []).filter((row) => lessonKeysEqual(row.lessonKey, lessonKey))
    : drive.files || [];
  if (!files.length) return null;
  const latest =
    files.find((row) => row.isLatest) ||
    files.reduce((best, row) => {
      const time = row.submittedAt?.getTime?.() || 0;
      const bestTime = best?.submittedAt?.getTime?.() || 0;
      if (time > bestTime) return row;
      if (time === bestTime && (Number(row.attempt) || 0) > (Number(best?.attempt) || 0)) return row;
      return best;
    }, null);
  return {
    files,
    latest,
    latestAt: latest?.submittedAt?.getTime?.() || 0,
  };
}

export function reportsForStudentLesson(reports = [], studentId, lessonKey = '') {
  return reports.filter((row) => {
    if (row?.studentId !== studentId) return false;
    if (!lessonKey) return isValidLessonKey(row.lessonKey);
    return lessonKeysEqual(row.lessonKey, lessonKey);
  });
}

export function nextLatestReport(reports = [], deletedId = '') {
  return [...reports]
    .filter((row) => row?.id && row.id !== deletedId)
    .sort((left, right) => reportSubmittedTime(right) - reportSubmittedTime(left))[0] || null;
}
