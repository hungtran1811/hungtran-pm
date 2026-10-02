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

function pushUniqueName(names, value) {
  const name = String(value || '').trim();
  if (name && !names.includes(name)) names.push(name);
}

/** Metadata HS được xem: không gồm driveFileId / folder / token. */
export function sanitizeStudentSubmissionNote(row = {}) {
  const lessonKey = String(row.lessonKey || '').trim();
  if (!lessonKey) return null;
  const names = [];
  if (Array.isArray(row.originalFileNames)) {
    row.originalFileNames.forEach((name) => pushUniqueName(names, name));
  }
  pushUniqueName(names, row.originalFileName);
  if (!names.length) pushUniqueName(names, row.storedFileName);
  return {
    lessonKey,
    originalFileName: names[0] || '',
    originalFileNames: names,
    submittedAt: toIso(row.submittedAt),
    attempt: Number(row.attempt) || 1,
  };
}

export function noteFileNames(note = {}) {
  if (Array.isArray(note.originalFileNames) && note.originalFileNames.length) {
    return note.originalFileNames.filter(Boolean);
  }
  return note.originalFileName ? [note.originalFileName] : [];
}

export function sortStudentSubmissionNotes(notes = []) {
  return [...notes].sort((left, right) =>
    String(left.lessonKey || '').localeCompare(String(right.lessonKey || '')),
  );
}

export function toStudentSubmissionNotes(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    if (row?.isLatest === false) continue;
    const note = sanitizeStudentSubmissionNote(row);
    if (!note) continue;
    const key = normalizeLessonKey(note.lessonKey) || note.lessonKey;
    const attempt = Number(row.attempt) || note.attempt || 1;
    const current = grouped.get(key);
    if (!current || attempt > current.attempt) {
      grouped.set(key, {
        ...note,
        lessonKey: key,
        attempt,
      });
      continue;
    }
    if (attempt === current.attempt) {
      noteFileNames(note).forEach((name) => pushUniqueName(current.originalFileNames, name));
      current.originalFileName = current.originalFileNames[0] || current.originalFileName;
      if (note.submittedAt && (!current.submittedAt || note.submittedAt > current.submittedAt)) {
        current.submittedAt = note.submittedAt;
      }
    }
  }
  return sortStudentSubmissionNotes([...grouped.values()]);
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
