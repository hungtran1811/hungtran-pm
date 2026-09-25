import { describe, expect, it } from 'vitest';
import { latestSubmissionLessonQueries, uniqueSubmissionsById } from './submissionQueries.js';

describe('latestSubmissionLessonQueries', () => {
  it('builds L and B alias queries for the current session', () => {
    expect(latestSubmissionLessonQueries('K24', 3)).toEqual([
      { classCode: 'K24', lessonKey: 'L03', isLatest: true },
      { classCode: 'K24', lessonKey: 'B03', isLatest: true },
    ]);
  });

  it('accepts an existing lesson key and skips empty class codes', () => {
    expect(latestSubmissionLessonQueries('K24', 'B09')[0].lessonKey).toBe('L09');
    expect(latestSubmissionLessonQueries('', 3)).toEqual([]);
    expect(latestSubmissionLessonQueries('K24', 0)).toEqual([]);
  });
});

describe('uniqueSubmissionsById', () => {
  it('keeps the first row per id', () => {
    expect(
      uniqueSubmissionsById([
        { id: 'a', lessonKey: 'L03' },
        { id: 'a', lessonKey: 'B03' },
        { id: 'b', lessonKey: 'L03' },
        { lessonKey: 'L03' },
      ]).map((row) => row.id),
    ).toEqual(['a', 'b']);
  });
});
