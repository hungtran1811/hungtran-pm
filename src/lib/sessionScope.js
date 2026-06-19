export const ALL_SESSIONS_VALUE = 'all';

/** Buổi học tối đa học sinh được xem (theo buổi hiện tại của lớp). */
export function unlockedLessonSessionCap(classDoc) {
  return Number(classDoc?.curriculumCurrentSession) || 0;
}

/** Buổi 1 … buổi hiện tại của lớp. */
export function sessionNumbersUpToCurrent(classDoc) {
  const current = Number(classDoc?.curriculumCurrentSession) || 0;
  if (current <= 0) return [];
  return Array.from({ length: current }, (_, i) => i + 1);
}

export function isSessionWithinClassScope(sessionNumber, classDoc) {
  const session = Number(sessionNumber);
  if (!session || session < 1) return false;
  const current = Number(classDoc?.curriculumCurrentSession) || 0;
  if (current <= 0) return true;
  return session <= current;
}

export function filterBySessionScope(items, classDoc, sessionFilter, sessionKey = 'sessionNumber') {
  if (!items?.length) return [];
  if (sessionFilter && sessionFilter !== ALL_SESSIONS_VALUE) {
    const target = Number(sessionFilter);
    return items.filter((item) => Number(item[sessionKey]) === target);
  }
  const current = Number(classDoc?.curriculumCurrentSession) || 0;
  if (current <= 0) return [...items];
  return items.filter((item) => {
    const session = Number(item[sessionKey]);
    return session > 0 && session <= current;
  });
}

export function sessionNumbersUpToCurrentMulti(classDocs = []) {
  const max = Math.max(0, ...classDocs.map((c) => Number(c?.curriculumCurrentSession) || 0));
  if (max <= 0) return [];
  return Array.from({ length: max }, (_, i) => i + 1);
}

export function filterBySessionScopeMulti(
  items,
  classesByCode,
  sessionFilter,
  classCodeKey = 'classCode',
  sessionKey = 'sessionNumber',
) {
  if (!items?.length) return [];
  if (sessionFilter && sessionFilter !== ALL_SESSIONS_VALUE) {
    const target = Number(sessionFilter);
    return items.filter((item) => Number(item[sessionKey]) === target);
  }
  return items.filter((item) => {
    const classDoc = classesByCode.get(item[classCodeKey]);
    return isSessionWithinClassScope(item[sessionKey], classDoc);
  });
}

export function maxCurrentSession(classDocs = []) {
  return Math.max(0, ...classDocs.map((c) => Number(c?.curriculumCurrentSession) || 0));
}
