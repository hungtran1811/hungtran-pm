import { normalizeStudentName } from './normalizeStudentName.js';

export function getFileExtension(fileName) {
  const raw = String(fileName || '').trim();
  const lastDot = raw.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === raw.length - 1) return '';
  return `.${raw.slice(lastDot + 1).toLowerCase()}`;
}

export function sanitizeClassCodeForFile(classCode) {
  const cleaned = String(classCode || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'CLASS';
}

export function lessonKeySessionNumber(lessonKey) {
  const raw = String(lessonKey || '')
    .trim()
    .toUpperCase();
  const match = raw.match(/^[BL]?0*(\d{1,3})$/);
  return match ? Number(match[1]) || 0 : 0;
}

export function normalizeLessonKey(lesson) {
  const session = lessonKeySessionNumber(lesson);
  if (!session) return '';
  return `L${String(session).padStart(2, '0')}`;
}

export function formatLessonKey(lessonKey) {
  return normalizeLessonKey(lessonKey) || String(lessonKey || '').trim();
}

export function isValidLessonKey(lessonKey) {
  return /^[BL]\d{2,3}$/.test(String(lessonKey || ''));
}

export function lessonKeysEqual(left, right) {
  const session = lessonKeySessionNumber(left);
  return session > 0 && session === lessonKeySessionNumber(right);
}

const DEFAULT_SCHOOL_PACK_SESSION = 14;

export function schoolPackSessionNumber(totalSessionCount) {
  const count = Number(totalSessionCount);
  if (!Number.isFinite(count) || count <= 0) return DEFAULT_SCHOOL_PACK_SESSION;
  return Math.floor(count);
}

export function schoolPackLessonKey(totalSessionCount) {
  return normalizeLessonKey(schoolPackSessionNumber(totalSessionCount));
}

export function schoolPackFolderName(totalSessionCount) {
  return `Lesson_${schoolPackSessionNumber(totalSessionCount)}`;
}

export function isSchoolPackLesson(lessonKey, totalSessionCount) {
  return lessonKeysEqual(lessonKey, schoolPackLessonKey(totalSessionCount));
}

export function lessonKeyAliases(lessonKey) {
  const key = normalizeLessonKey(lessonKey);
  if (!key) return [];
  return [key, `B${key.slice(1)}`];
}

export function formatDateStamp(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function buildSubmissionDrivePath({ classCode, studentName, lessonKey } = {}) {
  return {
    classFolderName: String(classCode || '').trim() || 'CLASS',
    studentFolderName: normalizeStudentName(studentName) || 'HocSinh',
    lessonFolderName: normalizeLessonKey(lessonKey) || 'L00',
  };
}

export function sanitizeOriginalFileStem(originalFileName) {
  const raw = String(originalFileName || '').trim();
  const lastDot = raw.lastIndexOf('.');
  const stem = lastDot > 0 ? raw.slice(0, lastDot) : '';
  const cleaned = stem
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned || 'file';
}

export function buildStoredFileName({
  classCode,
  studentName,
  lessonKey,
  originalFileName,
  date = new Date(),
} = {}) {
  const ext = getFileExtension(originalFileName);
  const cls = sanitizeClassCodeForFile(classCode);
  const name = normalizeStudentName(studentName) || 'HocSinh';
  const lesson = normalizeLessonKey(lessonKey) || 'L00';
  const stem = sanitizeOriginalFileStem(originalFileName);
  return `${cls}_${name}_${lesson}_${formatDateStamp(date)}_${stem}${ext}`;
}
