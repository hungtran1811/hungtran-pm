import { normalizeKey } from './firestore.js';
import { lessonKeysEqual, lessonKeySessionNumber, normalizeLessonKey } from './submissionFileName.js';

export function driveFileViewUrl(fileId) {
  const id = String(fileId || '').trim();
  if (!id) return '';
  return `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
}

export function driveFolderUrl(folderId) {
  const id = String(folderId || '').trim();
  if (!id) return '';
  return `https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
}

export function uniqueLessonKeys(rows = []) {
  return [...new Set(rows.map((row) => normalizeLessonKey(row.lessonKey)).filter(Boolean))].sort(
    (left, right) => lessonKeySessionNumber(left) - lessonKeySessionNumber(right),
  );
}

export function filterAdminSubmissions(rows = [], { lessonKey = '', latestOnly = false, search = '' } = {}) {
  const query = normalizeKey(search);
  return rows.filter((row) => {
    if (latestOnly && !row.isLatest) return false;
    if (lessonKey && !lessonKeysEqual(row.lessonKey, lessonKey)) return false;
    if (!query) return true;
    const hay = normalizeKey(
      `${row.studentName} ${row.originalFileName} ${row.storedFileName} ${row.lessonKey}`,
    );
    return hay.includes(query);
  });
}

export function summarizeDriveSubmissionsByStudent(rows = []) {
  const byStudent = new Map();
  for (const row of rows) {
    if (!row?.studentId) continue;
    const current = byStudent.get(row.studentId) || { files: [], latest: null, latestAt: 0 };
    current.files.push(row);
    const time = row.submittedAt?.getTime?.() || 0;
    const isNewer =
      !current.latest ||
      time > current.latestAt ||
      (time === current.latestAt && row.isLatest && !current.latest.isLatest);
    if (isNewer) {
      current.latest = row;
      current.latestAt = time;
    }
    byStudent.set(row.studentId, current);
  }
  for (const current of byStudent.values()) {
    current.files.sort((left, right) => {
      const byLesson = lessonKeySessionNumber(right.lessonKey) - lessonKeySessionNumber(left.lessonKey);
      if (byLesson) return byLesson;
      const byAttempt = (Number(right.attempt) || 0) - (Number(left.attempt) || 0);
      if (byAttempt) return byAttempt;
      return (right.submittedAt?.getTime?.() || 0) - (left.submittedAt?.getTime?.() || 0);
    });
  }
  return byStudent;
}

export function nextLatestSubmission(rows = [], deletedId = '', lessonKey = '') {
  const deleted = rows.find((row) => row?.id === deletedId);
  const key = lessonKey || deleted?.lessonKey;
  return [...rows]
    .filter((row) => row?.id && row.id !== deletedId)
    .filter((row) => !key || lessonKeysEqual(row.lessonKey, key))
    .sort((left, right) => {
      const byAttempt = (Number(right.attempt) || 0) - (Number(left.attempt) || 0);
      if (byAttempt) return byAttempt;
      return (right.submittedAt?.getTime?.() || 0) - (left.submittedAt?.getTime?.() || 0);
    })[0] || null;
}

export function sortAdminSubmissions(rows = []) {
  return [...rows].sort((left, right) => {
    const byLesson = lessonKeySessionNumber(right.lessonKey) - lessonKeySessionNumber(left.lessonKey);
    if (byLesson) return byLesson;
    const byName = String(left.studentName || '').localeCompare(String(right.studentName || ''), 'vi');
    if (byName) return byName;
    if (Boolean(left.isLatest) !== Boolean(right.isLatest)) return left.isLatest ? -1 : 1;
    const byAttempt = (Number(right.attempt) || 0) - (Number(left.attempt) || 0);
    if (byAttempt) return byAttempt;
    const leftTime = left.submittedAt?.getTime?.() || 0;
    const rightTime = right.submittedAt?.getTime?.() || 0;
    return rightTime - leftTime;
  });
}
