import { isArchivedClassStatus } from '../services/classes.service.js';

export const ALL_CLASSES_VALUE = 'all';

export function filterClassesForView(classes, showArchived) {
  return classes.filter((c) =>
    showArchived ? isArchivedClassStatus(c.status) : !isArchivedClassStatus(c.status),
  );
}

export function resolveScopedClasses(classes, selectedClass, showArchived) {
  const visible = filterClassesForView(classes, showArchived);
  if (selectedClass === ALL_CLASSES_VALUE) return visible;
  const match = visible.find((c) => c.classCode === selectedClass);
  return match ? [match] : [];
}

export function buildClassesByCode(classList) {
  return new Map(classList.map((c) => [c.classCode, c]));
}
