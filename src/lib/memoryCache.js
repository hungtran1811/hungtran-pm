export function createMemoryCache({ max = 24, ttlMs = 5 * 60 * 1000 } = {}) {
  const store = new Map();

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (ttlMs > 0 && Date.now() - entry.at > ttlMs) {
        store.delete(key);
        return undefined;
      }
      store.delete(key);
      store.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      store.delete(key);
      store.set(key, { value, at: Date.now() });
      while (store.size > max) {
        store.delete(store.keys().next().value);
      }
    },
    clear() {
      store.clear();
    },
    get size() {
      return store.size;
    },
  };
}

export function lessonHtmlPartCacheKey({
  programId = '',
  lessonId = '',
  part = '',
  driveFileId = '',
  updatedAt = '',
} = {}) {
  return [programId, lessonId, part, driveFileId, updatedAt].join('|');
}

export function lessonHtmlDriveCacheKey(driveFileId = '', updatedAt = '') {
  return `${driveFileId}|${updatedAt}`;
}

export const lessonHtmlClientCache = createMemoryCache({
  max: 32,
  ttlMs: 30 * 60 * 1000,
});

export const lessonHtmlFunctionCache = createMemoryCache({
  max: 20,
  ttlMs: 5 * 60 * 1000,
});
