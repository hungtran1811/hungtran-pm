import { lessonKeysEqual, normalizeLessonKey } from './submissionFileName.js';

function toIso(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }
  if (typeof value.toDate === 'function') {
    return toIso(value.toDate());
  }
  if (typeof value.seconds === 'number') {
    return toIso(new Date(value.seconds * 1000));
  }
  return '';
}

/** Metadata HS được xem: không gồm driveFileId / folder / token. */
export function sanitizeStudentSubmissionNote(row = {}) {
  const lessonKey = String(row.lessonKey || '').trim();
  if (!lessonKey) return null;
  const originalFileName = String(row.originalFileName || row.storedFileName || '').trim();
  return {
    lessonKey,
    originalFileName,
    submittedAt: toIso(row.submittedAt),
    attempt: Number(row.attempt) || 1,
  };
}

export function sortStudentSubmissionNotes(notes = []) {
  return [...notes].sort((left, right) =>
    String(left.lessonKey || '').localeCompare(String(right.lessonKey || '')),
  );
}

export function toStudentSubmissionNotes(rows = []) {
  const latest = new Map();
  for (const row of rows) {
    if (row?.isLatest === false) continue;
    const note = sanitizeStudentSubmissionNote(row);
    if (!note) continue;
    const key = normalizeLessonKey(note.lessonKey) || note.lessonKey;
    const previous = latest.get(key);
    if (!previous || (Number(row.attempt) || 0) >= previous.attempt) {
      latest.set(key, { ...note, lessonKey: key });
    }
  }
  return sortStudentSubmissionNotes([...latest.values()]);
}

export function upsertStudentSubmissionNote(notes = [], next) {
  const note = sanitizeStudentSubmissionNote(next);
  if (!note) return sortStudentSubmissionNotes(notes);
  return sortStudentSubmissionNotes([
    ...notes.filter((item) => !lessonKeysEqual(item.lessonKey, note.lessonKey)),
    note,
  ]);
}

export function findStudentSubmissionNote(notes = [], lessonKey) {
  return notes.find((item) => lessonKeysEqual(item.lessonKey, lessonKey)) || null;
}
