import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_SIZE } from '../config/submissionConfig.js';
import {
  validateCreateSessionInput,
  validateStudentIdentityInput,
  validateSubmissionFile,
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
