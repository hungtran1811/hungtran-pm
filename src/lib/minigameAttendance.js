const storageKey = (classCode) => `minigame-present:${classCode}`;

export function normalizePresentIds(allStudentIds, storedIds) {
  if (!allStudentIds?.length) return new Set();
  const allowed = new Set(allStudentIds);
  if (!storedIds?.length) return new Set();
  return new Set(storedIds.filter((id) => allowed.has(id)));
}

export function loadPresentStudentIds(classCode, allStudentIds) {
  if (!classCode || !allStudentIds?.length) return new Set();
  try {
    const raw = sessionStorage.getItem(storageKey(classCode));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return normalizePresentIds(allStudentIds, parsed);
  } catch {
    return new Set();
  }
}

export function savePresentStudentIds(classCode, ids) {
  if (!classCode) return;
  try {
    sessionStorage.setItem(storageKey(classCode), JSON.stringify([...ids]));
  } catch {
    // best-effort
  }
}

export function filterPresentStudents(students, presentStudentIds) {
  if (!presentStudentIds?.size) return [];
  return students.filter((s) => presentStudentIds.has(s.id));
}

export function maxSpyCount(presentCount) {
  if (presentCount < 3) return 0;
  return Math.max(1, Math.floor(presentCount / 3));
}
