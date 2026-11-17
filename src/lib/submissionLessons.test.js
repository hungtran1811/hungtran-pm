import { describe, expect, it } from 'vitest';
import {
  buildLessonOptions,
  buildStudentLessonOptions,
  classRoadmapSessions,
  defaultLessonKey,
  lockedSessionNumbers,
} from './submissionLessons.js';

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

describe('class roadmap sessions', () => {
  it('uses the program session count and marks sessions after the current one locked', () => {
    const sessions = classRoadmapSessions({ curriculumCurrentSession: 2 }, { totalSessionCount: 8 });
    expect(sessions).toHaveLength(8);
    expect(sessions.map((item) => item.state)).toEqual([
      'opened',
      'current',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
    ]);
    expect(sessions[1].lessonKey).toBe('L02');
    expect(classRoadmapSessions({ curriculumCurrentSession: 2 }, { totalSessionCount: 0 })).toEqual([]);
  });

  it('keeps sessions after the current one unreadable', () => {
    expect(lockedSessionNumbers({ curriculumCurrentSession: 2 }, program)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(lockedSessionNumbers({ curriculumCurrentSession: 8 }, program)).toEqual([]);
    expect(lockedSessionNumbers({ curriculumCurrentSession: 0 }, { totalSessionCount: 3 })).toEqual([1, 2, 3]);
  });
});
