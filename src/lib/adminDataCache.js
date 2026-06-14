import { listClasses, isOperationalClassStatus } from '../services/classes.service.js';
import { listStudentsByClassCodes } from '../services/students.service.js';

const TTL_MS = 90_000;

let cache = null;

export function invalidateAdminDataCache() {
  cache = null;
}

/** One-shot admin base data with short TTL to cut repeat reads across pages. */
export async function fetchAdminBaseData({ force = false, activeStudentsOnly = true } = {}) {
  if (!force && cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache;
  }

  const classes = await listClasses();
  const studentClassCodes = classes
    .filter((c) => isOperationalClassStatus(c.status) || c.status === 'archived')
    .map((c) => c.classCode);
  const students = await listStudentsByClassCodes(studentClassCodes, { activeOnly: activeStudentsOnly });

  cache = { classes, students, fetchedAt: Date.now() };
  return cache;
}
