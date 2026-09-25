import { lessonKeyAliases } from './submissionFileName.js';

export function latestSubmissionLessonQueries(classCode, lessonKey) {
  const code = String(classCode || '').trim();
  const aliases = lessonKeyAliases(lessonKey);
  if (!code || !aliases.length) return [];
  return aliases.map((key) => ({
    classCode: code,
    lessonKey: key,
    isLatest: true,
  }));
}

export function uniqueSubmissionsById(rows = []) {
  const byId = new Map();
  for (const row of rows) {
    if (row?.id && !byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()];
}
