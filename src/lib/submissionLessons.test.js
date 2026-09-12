import { describe, expect, it } from 'vitest';
import { buildLessonOptions, buildStudentLessonOptions, defaultLessonKey } from './submissionLessons.js';

const program = {
  lessons: [
    { sessionNumber: 1, title: 'Giới thiệu' },
    { sessionNumber: 2, title: 'Biến' },
    { sessionNumber: 8, title: 'Dự án' },
  ],
  totalSessionCount: 8,
};

describe('submission lesson options', () => {
  it('uses program lessons when present', () => {
    const options = buildLessonOptions({ curriculumCurrentSession: 2 }, program);
    expect(options).toEqual([
      { value: 'L01', sessionNumber: 1, label: 'Buổi 1 — Giới thiệu' },
      { value: 'L02', sessionNumber: 2, label: 'Buổi 2 — Biến' },
      { value: 'L08', sessionNumber: 8, label: 'Buổi 8 — Dự án' },
    ]);
    expect(defaultLessonKey({ curriculumCurrentSession: 2 }, program)).toBe('L02');
  });

  it('falls back to current session count', () => {
    const options = buildLessonOptions({ curriculumCurrentSession: 3 }, null);
    expect(options.map((item) => item.value)).toEqual(['L01', 'L02', 'L03']);
  });

  it('limits student options to sessions the class has opened', () => {
    expect(buildStudentLessonOptions({ curriculumCurrentSession: 2 }, program).map((item) => item.value)).toEqual([
      'L01',
      'L02',
    ]);
    expect(buildStudentLessonOptions({ curriculumCurrentSession: 0 }, program)).toEqual([]);
    expect(buildStudentLessonOptions({ curriculumCurrentSession: 3 }, program).map((item) => item.label)).toEqual([
      'Buổi 1 — Giới thiệu',
      'Buổi 2 — Biến',
      'Buổi 3',
    ]);
  });
});
