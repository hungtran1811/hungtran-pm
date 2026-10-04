import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lessonHtmlClientCache } from '../lib/memoryCache.js';

vi.mock('../config/features.js', () => ({
  FEATURE_DRIVE_LESSON_HTML_ENABLED: true,
}));

vi.mock('../config/firebase.js', () => ({
  auth: { currentUser: null },
}));

vi.mock('../lib/driveFunctionErrors.js', () => ({
  reportDriveFunctionError: vi.fn(),
}));

import { fetchLessonHtml, hydrateLessonHtml } from './lessonHtmlDrive.service.js';

const lecturePointer = {
  driveFileId: 'file-1',
  fileName: 'L01-lecture.html',
  byteSize: 20,
  updatedAt: '2026-10-04T10:00:00.000Z',
};

beforeEach(() => {
  lessonHtmlClientCache.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ html: '<p>Từ Drive</p>' }),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchLessonHtml client cache', () => {
  it('reuses HTML for the same Drive pointer', async () => {
    const first = await fetchLessonHtml({
      programId: 'web-basic',
      lessonId: 'lesson-1',
      part: 'lecture',
      pointer: lecturePointer,
    });
    const second = await fetchLessonHtml({
      programId: 'web-basic',
      lessonId: 'lesson-1',
      part: 'lecture',
      pointer: lecturePointer,
    });

    expect(first).toBe('<p>Từ Drive</p>');
    expect(second).toBe('<p>Từ Drive</p>');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fetches again when updatedAt changes or force is set', async () => {
    await fetchLessonHtml({
      programId: 'web-basic',
      lessonId: 'lesson-1',
      part: 'lecture',
      pointer: lecturePointer,
    });
    await fetchLessonHtml({
      programId: 'web-basic',
      lessonId: 'lesson-1',
      part: 'lecture',
      pointer: { ...lecturePointer, updatedAt: '2026-10-04T11:00:00.000Z' },
    });
    await fetchLessonHtml({
      programId: 'web-basic',
      lessonId: 'lesson-1',
      part: 'lecture',
      pointer: { ...lecturePointer, updatedAt: '2026-10-04T11:00:00.000Z' },
      force: true,
    });

    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

describe('hydrateLessonHtml parts', () => {
  it('loads only the requested Drive part', async () => {
    const lesson = {
      id: 'lesson-1',
      lectureHtmlDrive: lecturePointer,
      exerciseHtmlDrive: { ...lecturePointer, driveFileId: 'file-2' },
      content: '',
      exercise: '',
    };

    const hydrated = await hydrateLessonHtml(lesson, {
      programId: 'web-basic',
      parts: ['lecture'],
    });

    expect(hydrated.content).toBe('<p>Từ Drive</p>');
    expect(hydrated.exercise).toBe('');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
