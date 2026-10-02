import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_SIZE } from '../config/submissionConfig.js';
import {
  normalizeCompleteSubmissionItems,
  validateCreateSessionInput,
  validateStudentIdentityInput,
  validateSubmissionFile,
  validateSubmissionFiles,
} from './submissionValidate.js';

describe('validateSubmissionFile', () => {
  it('accepts an allowed zip under the size cap', () => {
    expect(
      validateSubmissionFile({
        fileName: 'game.zip',
        fileSize: 1024,
        mimeType: 'application/zip',
      }).ok,
    ).toBe(true);
  });

  it('accepts a GameMaker .yyz export', () => {
    expect(
      validateSubmissionFile({
        fileName: 'game.yyz',
        fileSize: 2048,
        mimeType: 'application/octet-stream',
      }).ok,
    ).toBe(true);
  });

  it('rejects blocked and unknown extensions', () => {
    expect(validateSubmissionFile({ fileName: 'setup.exe', fileSize: 10 }).ok).toBe(false);
    expect(validateSubmissionFile({ fileName: 'notes.docx', fileSize: 10 }).ok).toBe(false);
  });

  it('rejects oversized files', () => {
    expect(
      validateSubmissionFile({
        fileName: 'big.zip',
        fileSize: MAX_UPLOAD_SIZE + 1,
      }).ok,
    ).toBe(false);
  });

  it('accepts a 100MB zip under the 150MB cap', () => {
    expect(
      validateSubmissionFile({
        fileName: 'project.zip',
        fileSize: 100 * 1024 * 1024,
        mimeType: 'application/zip',
      }).ok,
    ).toBe(true);
  });
});

describe('validateSubmissionFiles', () => {
  const py = (name) => ({ name, size: 12, type: 'text/x-python' });

  it('accepts one to three valid files', () => {
    expect(validateSubmissionFiles([py('a.py')]).ok).toBe(true);
    expect(validateSubmissionFiles([py('a.py'), py('b.py'), py('c.py')]).ok).toBe(true);
  });

  it('rejects empty, overflow, and duplicate names', () => {
    expect(validateSubmissionFiles([]).ok).toBe(false);
    expect(validateSubmissionFiles([py('a.py'), py('b.py'), py('c.py'), py('d.py')]).ok).toBe(false);
    expect(validateSubmissionFiles([py('a.py'), py('A.py')]).ok).toBe(false);
  });
});

describe('normalizeCompleteSubmissionItems', () => {
  it('accepts the legacy single-file body', () => {
    expect(
      normalizeCompleteSubmissionItems({
        uploadToken: 'tok-1',
        driveFileId: 'drv-1',
      }),
    ).toEqual({
      ok: true,
      items: [{ uploadToken: 'tok-1', driveFileId: 'drv-1' }],
    });
  });

  it('accepts a batch of up to three items', () => {
    const result = normalizeCompleteSubmissionItems({
      items: [
        { uploadToken: 't1', driveFileId: 'd1' },
        { uploadToken: 't2', driveFileId: 'd2' },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(2);
  });

  it('rejects missing, duplicate, or too many items', () => {
    expect(normalizeCompleteSubmissionItems({}).ok).toBe(false);
    expect(
      normalizeCompleteSubmissionItems({
        items: [
          { uploadToken: 't1', driveFileId: 'd1' },
          { uploadToken: 't1', driveFileId: 'd2' },
        ],
      }).ok,
    ).toBe(false);
    expect(
      normalizeCompleteSubmissionItems({
        items: [
          { uploadToken: 't1', driveFileId: 'd1' },
          { uploadToken: 't2', driveFileId: 'd2' },
          { uploadToken: 't3', driveFileId: 'd3' },
          { uploadToken: 't4', driveFileId: 'd4' },
        ],
      }).ok,
    ).toBe(false);
  });
});

describe('validateStudentIdentityInput', () => {
  it('accepts class, student id, and name', () => {
    expect(
      validateStudentIdentityInput({
        classCode: 'PY101',
        studentId: 's1',
        studentName: 'An Nguyen',
      }),
    ).toMatchObject({ ok: true, classCode: 'PY101', studentId: 's1' });
  });

  it('rejects missing fields', () => {
    expect(validateStudentIdentityInput({ classCode: 'PY101', studentName: 'An' }).ok).toBe(false);
  });
});

describe('validateCreateSessionInput', () => {
  it('normalizes a valid payload', () => {
    const result = validateCreateSessionInput({
      classCode: 'PY101',
      studentId: 's1',
      studentName: 'An Nguyen',
      lesson: '2',
      fileName: 'main.py',
      fileSize: 128,
      mimeType: 'text/x-python',
    });
    expect(result.ok).toBe(true);
    expect(result.lessonKey).toBe('L02');
  });

  it('rejects missing identity', () => {
    expect(
      validateCreateSessionInput({
        classCode: 'PY101',
        studentName: 'An',
        lesson: '1',
        fileName: 'main.py',
        fileSize: 10,
      }).ok,
    ).toBe(false);
  });
});
