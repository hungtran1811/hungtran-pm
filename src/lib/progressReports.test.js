import { describe, expect, it } from 'vitest';
import { DEFAULT_DIFFICULTIES } from '../constants/index.js';
import {
  countBulletLines,
  hasOverlappingLesson,
  latestReportForLesson,
  latestReportsByStudentLesson,
  nextLatestReport,
  reportTextError,
  reportsForStudentLesson,
  resolveDifficulties,
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

describe('resolveDifficulties', () => {
  it('fills empty difficulties unless the student needs support', () => {
    expect(resolveDifficulties('Đang làm', '')).toBe(DEFAULT_DIFFICULTIES);
    expect(resolveDifficulties('Đang làm', '   ')).toBe(DEFAULT_DIFFICULTIES);
    expect(resolveDifficulties('Hoàn thành', 'Mắc lỗi CSS')).toBe('Mắc lỗi CSS');
  });

  it('keeps empty text when status is Cần hỗ trợ', () => {
    expect(resolveDifficulties('Cần hỗ trợ', '')).toBe('');
    expect(resolveDifficulties('Cần hỗ trợ', '  Nút nộp không chạy  ')).toBe('Nút nộp không chạy');
  });
});

describe('report text bullets', () => {
  it('counts non-empty bullet lines and requires three plus 40 characters', () => {
    expect(countBulletLines('- Một\n- Hai\n- Ba việc đã làm được hôm nay')).toBe(3);
    expect(countBulletLines('- Một\n\n-  ')).toBe(1);
    expect(reportTextError('đã làm được', '- Một\n- Hai')).toMatch(/3 gạch đầu dòng/);
    expect(
      reportTextError(
        'đã làm được',
        '- Dựng trang chủ\n- Nối nút nộp bài\n- Chỉnh chữ trên điện thoại',
      ),
    ).toBeNull();
    expect(reportTextError('khó khăn', '', { required: false })).toBeNull();
  });
});
