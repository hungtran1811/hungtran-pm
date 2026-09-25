import { describe, expect, it } from 'vitest';
import {
  canAddLessonResource,
  findExistingLessonResource,
  materialDownloadUrl,
  normalizeLessonResources,
  sanitizeMaterialFileName,
  validateCreateMaterialInput,
  validateLessonResourceFile,
} from './lessonResources.js';

describe('validateLessonResourceFile', () => {
  it('accepts a starter zip under 100MB', () => {
    expect(
      validateLessonResourceFile({
        fileName: 'starter-l03.zip',
        fileSize: 99 * 1024 * 1024,
        mimeType: 'application/zip',
      }).ok,
    ).toBe(true);
  });

  it('rejects exe and oversized files', () => {
    expect(validateLessonResourceFile({ fileName: 'a.exe', fileSize: 10 }).ok).toBe(false);
    expect(
      validateLessonResourceFile({
        fileName: 'big.zip',
        fileSize: 101 * 1024 * 1024,
      }).error,
    ).toMatch(/100MB/);
  });
});

describe('normalizeLessonResources', () => {
  it('keeps valid rows and drops unsafe urls', () => {
    expect(
      normalizeLessonResources([
        {
          id: '1',
          fileName: 'a.zip',
          downloadUrl: 'https://drive.google.com/uc?export=download&id=abc',
          size: 12,
        },
        { id: '2', fileName: 'b.zip', downloadUrl: 'javascript:alert(1)' },
        { fileName: 'no-id.zip', downloadUrl: 'https://drive.google.com/uc?id=x' },
      ]),
    ).toEqual([
      {
        id: '1',
        title: 'a.zip',
        fileName: 'a.zip',
        size: 12,
        mimeType: '',
        driveFileId: '',
        downloadUrl: 'https://drive.google.com/uc?export=download&id=abc',
        addedAt: '',
      },
    ]);
  });

  it('caps at five files', () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({
      id: String(index + 1),
      fileName: `${index}.zip`,
      downloadUrl: `https://example.com/${index}.zip`,
    }));
    expect(normalizeLessonResources(rows)).toHaveLength(5);
    expect(canAddLessonResource(rows.slice(0, 5))).toBe(false);
  });
});

describe('validateCreateMaterialInput', () => {
  it('builds L03 key and sanitized name', () => {
    expect(
      validateCreateMaterialInput({
        programId: 'web-basic',
        sessionNumber: 3,
        fileName: 'Starter buổi 3.zip',
        fileSize: 100,
      }),
    ).toMatchObject({
      ok: true,
      lessonKey: 'L03',
      storedFileName: 'Starter-buoi-3.zip',
    });
  });

  it('rejects missing program or session', () => {
    expect(validateCreateMaterialInput({ sessionNumber: 1, fileName: 'a.zip', fileSize: 1 }).ok).toBe(
      false,
    );
    expect(
      validateCreateMaterialInput({ programId: 'web-basic', sessionNumber: 0, fileName: 'a.zip', fileSize: 1 })
        .ok,
    ).toBe(false);
  });
});

describe('findExistingLessonResource', () => {
  it('matches the same file name case-insensitively', () => {
    const rows = [
      {
        id: '1',
        fileName: 'Starter.zip',
        downloadUrl: 'https://drive.google.com/uc?export=download&id=abc',
      },
    ];
    expect(findExistingLessonResource(rows, 'starter.zip')?.id).toBe('1');
    expect(findExistingLessonResource(rows, 'other.py')).toBeNull();
  });
});

describe('helpers', () => {
  it('builds download url and sanitizes names', () => {
    expect(materialDownloadUrl('abc/def')).toBe(
      'https://drive.google.com/uc?export=download&id=abc%2Fdef',
    );
    expect(sanitizeMaterialFileName('C:\\tmp\\bài (1).py')).toBe('bai-1.py');
  });
});
