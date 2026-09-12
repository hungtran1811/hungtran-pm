import { describe, expect, it } from 'vitest';
import {
  hasOverlappingLesson,
  latestReportForLesson,
  latestReportsByStudentLesson,
  nextLatestReport,
  reportsForStudentLesson,
  scopeDriveToLesson,
} from './progressReports.js';

const reports = [
  { id: 'old', studentId: 'a', lessonKey: 'B01', submittedAt: new Date('2026-09-01') },
  { id: 'new-b01', studentId: 'a', lessonKey: 'B01', submittedAt: new Date('2026-09-10') },
  { id: 'b03', studentId: 'a', lessonKey: 'B03', submittedAt: new Date('2026-09-08') },
  { id: 'legacy', studentId: 'a', lessonKey: '', submittedAt: new Date('2026-09-12') },
  { id: 'other', studentId: 'b', lessonKey: 'B02', submittedAt: new Date('2026-09-05') },
];

describe('progress report lesson helpers', () => {
  it('keeps the latest report per student and lesson, ignoring unscoped rows', () => {
    const byStudent = latestReportsByStudentLesson(reports);
    expect(byStudent.get('a').get('L01').id).toBe('new-b01');
    expect(byStudent.get('a').get('L03').id).toBe('b03');
    expect(byStudent.get('a').has('')).toBe(false);
    expect(byStudent.get('b').get('L02').id).toBe('other');
  });

  it('resolves the report for a lesson or the newest scoped report', () => {
    const lessons = latestReportsByStudentLesson(reports).get('a');
    expect(latestReportForLesson(lessons, 'B01').id).toBe('new-b01');
    expect(latestReportForLesson(lessons, 'B09')).toBeNull();
    expect(latestReportForLesson(lessons, '').id).toBe('new-b01');
  });

  it('detects overlapping lessons with Drive files', () => {
    const lessons = latestReportsByStudentLesson(reports).get('a');
    expect(hasOverlappingLesson(lessons, { files: [{ lessonKey: 'B03' }] })).toBe(true);
    expect(hasOverlappingLesson(lessons, { files: [{ lessonKey: 'B09' }] })).toBe(false);
    expect(hasOverlappingLesson(lessons, null)).toBe(false);
  });

  it('scopes Drive files to the selected lesson and keeps every attempt', () => {
    const drive = {
      files: [
        { lessonKey: 'B01', attempt: 1, isLatest: false, originalFileName: 'old.py' },
        { lessonKey: 'B01', attempt: 2, isLatest: true, originalFileName: 'new.py' },
        { lessonKey: 'B03', originalFileName: 'game.zip' },
      ],
      latest: { lessonKey: 'B03', originalFileName: 'game.zip' },
    };
    const scoped = scopeDriveToLesson(drive, 'B01');
    expect(scoped.files.map((row) => row.originalFileName)).toEqual(['old.py', 'new.py']);
    expect(scoped.latest.originalFileName).toBe('new.py');
    expect(scopeDriveToLesson(drive, 'B09')).toBeNull();
    expect(scopeDriveToLesson(drive, '').latest.originalFileName).toBe('new.py');
  });

  it('lists reports for a student lesson and the next remaining report', () => {
    expect(reportsForStudentLesson(reports, 'a', 'B01').map((row) => row.id)).toEqual([
      'old',
      'new-b01',
    ]);
    expect(nextLatestReport(reportsForStudentLesson(reports, 'a', 'B01'), 'new-b01').id).toBe('old');
  });
});
