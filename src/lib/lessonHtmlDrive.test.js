import { describe, expect, it } from 'vitest';
import { LESSON_DOCUMENT_MAX_BYTES } from './curriculumSize.js';
import {
  formatLessonHtmlDriveBadge,
  htmlUtf8Size,
  normalizeLessonHtmlDrivePointer,
  planLessonHtmlOverflow,
  validateCreateLessonHtmlInput,
} from './lessonHtmlDrive.js';

describe('lesson HTML Drive overflow', () => {
  it('keeps small documents inline', () => {
    expect(
      planLessonHtmlOverflow({
        id: 'l1',
        lectureHtml: '<p>Hi</p>',
        exerciseHtml: '',
      }),
    ).toEqual({ ok: true, overflowLecture: false, overflowExercise: false });
  });

  it('overflows the large lecture part so the document fits', () => {
    const lectureHtml = `<p>${'x'.repeat(LESSON_DOCUMENT_MAX_BYTES)}</p>`;
    const plan = planLessonHtmlOverflow({
      id: 'l1',
      title: 'Buổi 1',
      lectureHtml,
      exerciseHtml: '<p>ok</p>',
    });
    expect(plan.ok).toBe(true);
    expect(plan.overflowLecture).toBe(true);
    expect(plan.overflowExercise).toBe(false);
  });

  it('rejects a single part above 2 MiB', () => {
    const plan = planLessonHtmlOverflow({
      lectureHtml: 'y'.repeat(2 * 1024 * 1024 + 10),
      exerciseHtml: '',
    });
    expect(plan.ok).toBe(false);
    expect(plan.error).toMatch(/2 MiB/);
  });

  it('rejects create-session input above 2 MiB', () => {
    const result = validateCreateLessonHtmlInput({
      programId: 'web-basic',
      lessonId: 'lesson-1',
      sessionNumber: 1,
      part: 'lecture',
      fileSize: 2 * 1024 * 1024 + 20,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/2 MiB/);
  });

  it('normalizes pointers and formats the badge', () => {
    expect(normalizeLessonHtmlDrivePointer({})).toBeNull();
    expect(htmlUtf8Size('ă')).toBeGreaterThan(1);
    expect(
      formatLessonHtmlDriveBadge({
        driveFileId: 'file-1',
        byteSize: 1.2 * 1024 * 1024,
      }),
    ).toMatch(/Drive/);
  });
});
