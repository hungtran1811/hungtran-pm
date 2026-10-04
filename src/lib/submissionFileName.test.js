import { describe, expect, it } from 'vitest';
import {
  buildStoredFileName,
  buildSubmissionDrivePath,
  formatDateStamp,
  formatLessonKey,
  getFileExtension,
  isSchoolPackLesson,
  isValidLessonKey,
  lessonKeysEqual,
  normalizeLessonKey,
  schoolPackFolderName,
  schoolPackLessonKey,
  sanitizeClassCodeForFile,
  sanitizeOriginalFileStem,
} from './submissionFileName.js';

describe('submission file names', () => {
  it('normalizes class codes and lesson keys', () => {
    expect(sanitizeClassCodeForFile('PVĐ-CSB02')).toBe('PVD-CSB02');
    expect(normalizeLessonKey('3')).toBe('L03');
    expect(normalizeLessonKey('b3')).toBe('L03');
    expect(normalizeLessonKey('L3')).toBe('L03');
    expect(formatLessonKey('B03')).toBe('L03');
    expect(formatLessonKey('')).toBe('');
    expect(isValidLessonKey('L03')).toBe(true);
    expect(isValidLessonKey('B03')).toBe(true);
    expect(isValidLessonKey('lesson')).toBe(false);
    expect(lessonKeysEqual('B09', 'L09')).toBe(true);
    expect(lessonKeysEqual('L01', 'L02')).toBe(false);
  });

  it('marks only the last program session for the school pack folder', () => {
    expect(schoolPackLessonKey(14)).toBe('L14');
    expect(schoolPackLessonKey(8)).toBe('L08');
    expect(schoolPackLessonKey(0)).toBe('L14');
    expect(schoolPackFolderName(14)).toBe('Lesson_14');
    expect(schoolPackFolderName(8)).toBe('Lesson_8');
    expect(isSchoolPackLesson('L14', 14)).toBe(true);
    expect(isSchoolPackLesson('B14', 14)).toBe(true);
    expect(isSchoolPackLesson('L08', 8)).toBe(true);
    expect(isSchoolPackLesson('L03', 14)).toBe(false);
    expect(isSchoolPackLesson('L14', 8)).toBe(false);
  });

  it('reads the last extension in lowercase', () => {
    expect(getFileExtension('demo.ZIP')).toBe('.zip');
    expect(getFileExtension('noext')).toBe('');
  });

  it('builds the nested Drive folder path', () => {
    expect(
      buildSubmissionDrivePath({
        classCode: 'PVĐ-CSB02',
        studentName: 'Nguyễn Văn An',
        lessonKey: '3',
      }),
    ).toEqual({
      classFolderName: 'PVĐ-CSB02',
      studentFolderName: 'NguyenVanAn',
      lessonFolderName: 'L03',
    });
  });

  it('sanitizes the original file stem', () => {
    expect(sanitizeOriginalFileStem('Final Project - Lesson_05.ZIP')).toBe('Final-Project-Lesson-05');
    expect(sanitizeOriginalFileStem('.zip')).toBe('file');
  });

  it('builds the stored Drive file name', () => {
    const date = new Date(2026, 8, 12);
    expect(
      buildStoredFileName({
        classCode: 'PVĐ-CSB02',
        studentName: 'Nguyễn Văn An',
        lessonKey: '3',
        originalFileName: 'bai-tap.ZIP',
        date,
      }),
    ).toBe(`PVD-CSB02_NguyenVanAn_L03_${formatDateStamp(date)}_bai-tap.zip`);
  });
});
