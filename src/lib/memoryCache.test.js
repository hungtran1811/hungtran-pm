import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryCache, lessonHtmlDriveCacheKey, lessonHtmlPartCacheKey } from './memoryCache.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('createMemoryCache', () => {
  it('returns the stored value and evicts the oldest entry', () => {
    const cache = createMemoryCache({ max: 2, ttlMs: 60_000 });
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
  });

  it('expires entries after ttl', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T10:00:00.000Z'));
    const cache = createMemoryCache({ max: 4, ttlMs: 5_000 });
    cache.set('html', '<p>Hi</p>');
    vi.setSystemTime(new Date('2026-10-04T10:00:06.000Z'));
    expect(cache.get('html')).toBeUndefined();
  });
});

describe('lesson HTML cache keys', () => {
  it('changes when Drive file or updatedAt changes', () => {
    expect(
      lessonHtmlPartCacheKey({
        programId: 'web',
        lessonId: 'l1',
        part: 'lecture',
        driveFileId: 'file-1',
        updatedAt: 't1',
      }),
    ).not.toBe(
      lessonHtmlPartCacheKey({
        programId: 'web',
        lessonId: 'l1',
        part: 'lecture',
        driveFileId: 'file-1',
        updatedAt: 't2',
      }),
    );
    expect(lessonHtmlDriveCacheKey('file-1', 't1')).not.toBe(lessonHtmlDriveCacheKey('file-1', 't2'));
  });
});
