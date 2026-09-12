import { describe, expect, it } from 'vitest';
import {
  findStudentSubmissionNote,
  sanitizeStudentSubmissionNote,
  toStudentSubmissionNotes,
  upsertStudentSubmissionNote,
} from './submissionStudentNotes.js';

describe('student submission notes', () => {
  it('keeps only safe metadata', () => {
    const note = sanitizeStudentSubmissionNote({
      lessonKey: 'B03',
      originalFileName: 'game.zip',
      submittedAt: '2026-09-12T11:42:14.034Z',
      attempt: 2,
      driveFileId: 'should-not-leak',
      driveFolderId: 'folder',
    });
    expect(note).toEqual({
      lessonKey: 'B03',
      originalFileName: 'game.zip',
      submittedAt: '2026-09-12T11:42:14.034Z',
      attempt: 2,
    });
    expect(note).not.toHaveProperty('driveFileId');
  });

  it('keeps latest attempt per lesson and skips older rows', () => {
    const notes = toStudentSubmissionNotes([
      { lessonKey: 'B03', originalFileName: 'old.zip', isLatest: false, attempt: 1 },
      { lessonKey: 'B03', originalFileName: 'new.zip', isLatest: true, attempt: 2, submittedAt: '2026-09-12T10:00:00.000Z' },
      { lessonKey: 'B01', originalFileName: 'a.py', isLatest: true, attempt: 1, submittedAt: '2026-09-12T09:00:00.000Z' },
    ]);
    expect(notes.map((row) => `${row.lessonKey}:${row.originalFileName}`)).toEqual([
      'L01:a.py',
      'L03:new.zip',
    ]);
  });

  it('upserts the selected lesson and finds it', () => {
    const next = upsertStudentSubmissionNote(
      [{ lessonKey: 'B01', originalFileName: 'a.py', submittedAt: '', attempt: 1 }],
      { lessonKey: 'B01', originalFileName: 'b.py', submittedAt: '2026-09-12T12:00:00.000Z', attempt: 2 },
    );
    expect(findStudentSubmissionNote(next, 'B01')?.originalFileName).toBe('b.py');
    expect(next).toHaveLength(1);
  });
});
