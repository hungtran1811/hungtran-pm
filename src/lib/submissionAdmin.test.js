import { describe, expect, it } from 'vitest';
import {
  driveFileViewUrl,
  driveFolderUrl,
  filterAdminSubmissions,
  sortAdminSubmissions,
  nextLatestSubmission,
  summarizeDriveSubmissionsByStudent,
  uniqueLessonKeys,
} from './submissionAdmin.js';

describe('submission admin helpers', () => {
  it('builds Drive URLs', () => {
    expect(driveFileViewUrl('abc123')).toBe('https://drive.google.com/file/d/abc123/view');
    expect(driveFolderUrl('folder-1')).toBe('https://drive.google.com/drive/folders/folder-1');
    expect(driveFileViewUrl('')).toBe('');
  });

  it('filters latest, lesson, and student search', () => {
    const rows = [
      { studentName: 'Nguyễn Văn An', lessonKey: 'B03', isLatest: true, originalFileName: 'a.zip' },
      { studentName: 'Nguyễn Văn An', lessonKey: 'B03', isLatest: false, originalFileName: 'old.zip' },
      { studentName: 'Trần Bình', lessonKey: 'B01', isLatest: true, originalFileName: 'b.py' },
    ];
    expect(filterAdminSubmissions(rows, { latestOnly: true })).toHaveLength(2);
    expect(filterAdminSubmissions(rows, { lessonKey: 'B03' })).toHaveLength(2);
    expect(filterAdminSubmissions(rows, { search: 'binh' }).map((row) => row.studentName)).toEqual([
      'Trần Bình',
    ]);
  });

  it('sorts by lesson, name, then latest attempt', () => {
    const sorted = sortAdminSubmissions([
      { studentName: 'Bình', lessonKey: 'B01', isLatest: true, attempt: 1 },
      { studentName: 'An', lessonKey: 'B03', isLatest: false, attempt: 1 },
      { studentName: 'An', lessonKey: 'B03', isLatest: true, attempt: 2 },
    ]);
    expect(sorted.map((row) => `${row.lessonKey}-${row.studentName}-${row.attempt}`)).toEqual([
      'B03-An-2',
      'B03-An-1',
      'B01-Bình-1',
    ]);
  });

  it('groups every Drive attempt by student', () => {
    const byStudent = summarizeDriveSubmissionsByStudent([
      {
        studentId: 'a',
        lessonKey: 'B01',
        isLatest: false,
        submittedAt: new Date('2026-09-01'),
      },
      {
        studentId: 'a',
        lessonKey: 'B03',
        isLatest: true,
        originalFileName: 'game.zip',
        submittedAt: new Date('2026-09-12'),
      },
      {
        studentId: 'a',
        lessonKey: 'B01',
        isLatest: true,
        originalFileName: 'old.py',
        submittedAt: new Date('2026-09-10'),
      },
      { studentId: 'b', lessonKey: 'B02', isLatest: true, originalFileName: 'app.py' },
    ]);
    expect(byStudent.get('a').files).toHaveLength(3);
    expect(byStudent.get('a').latest.originalFileName).toBe('game.zip');
    expect(byStudent.get('b').files).toHaveLength(1);
    expect(byStudent.has('missing')).toBe(false);
  });

  it('picks the newest remaining submission after a delete', () => {
    const next = nextLatestSubmission(
      [
        { id: 'old', attempt: 1, submittedAt: new Date('2026-09-01') },
        { id: 'new', attempt: 2, submittedAt: new Date('2026-09-12') },
      ],
      'new',
    );
    expect(next.id).toBe('old');
  });

  it('promotes the nearest remaining file in the same lesson', () => {
    const next = nextLatestSubmission(
      [
        { id: 'other-lesson', lessonKey: 'L02', attempt: 9, submittedAt: new Date('2026-09-20') },
        { id: 'old', lessonKey: 'L01', attempt: 1, submittedAt: new Date('2026-09-01') },
        { id: 'new', lessonKey: 'L01', attempt: 2, submittedAt: new Date('2026-09-12') },
      ],
      'new',
      'L01',
    );
    expect(next.id).toBe('old');
  });

  it('lists unique lesson keys', () => {
    expect(uniqueLessonKeys([{ lessonKey: 'B03' }, { lessonKey: 'L01' }, { lessonKey: 'B03' }])).toEqual([
      'L01',
      'L03',
    ]);
  });
});
