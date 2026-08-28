import { fetchAdminBaseData, invalidateAdminDataCache } from './adminDataCache.js';
import { listKnowledgeReportsByClass } from '../services/knowledgeReports.service.js';
import { loadLatestReportsForStudents } from '../services/reports.service.js';

async function mergeByClass(classCodes, loadFn) {
  if (!classCodes.length) return [];
  const parts = await Promise.all(classCodes.map((code) => loadFn(code)));
  return parts.flat();
}

let feedbackCache = null;
export const FEEDBACK_CACHE_TTL_MS = 90_000;

export function invalidateAdminSnapshots() {
  invalidateAdminDataCache();
  feedbackCache = null;
}

export async function loadAdminClasses({ force = false } = {}) {
  const base = await fetchAdminBaseData({ force });
  return base.classes;
}

export async function loadReportsPanelSnapshot(classCodes, { force = false } = {}) {
  const base = await fetchAdminBaseData({ force });
  const codeSet = new Set(classCodes || []);
  const students = (base.students || []).filter((s) => codeSet.has(s.classCode));
  const latestByStudent = await loadLatestReportsForStudents(students);
  return { classes: base.classes, students, latestByStudent };
}

export async function loadFeedbackByClassCodes(classCodes, { force = false } = {}) {
  if (!classCodes.length) return {};
  const key = [...classCodes].sort().join('|');
  if (
    !force
    && feedbackCache
    && feedbackCache.key === key
    && Date.now() - feedbackCache.fetchedAt < FEEDBACK_CACHE_TTL_MS
  ) {
    return feedbackCache.data;
  }
  const parts = await Promise.all(classCodes.map((code) => listKnowledgeReportsByClass(code, 300)));
  const data = {};
  classCodes.forEach((code, index) => {
    data[code] = parts[index];
  });
  feedbackCache = { key, data, fetchedAt: Date.now() };
  return data;
}

export async function loadFeedbackPanelSnapshot(classCodes, { force = false } = {}) {
  const [base, reports] = await Promise.all([
    fetchAdminBaseData({ force }),
    mergeByClass(classCodes, listKnowledgeReportsByClass),
  ]);
  const codeSet = new Set(classCodes || []);
  const students = (base.students || []).filter((s) => codeSet.has(s.classCode));
  return { classes: base.classes, students, reports };
}

export async function loadDashboardOpsSnapshot({ force = false } = {}) {
  const base = await fetchAdminBaseData({ force });
  return {
    classes: base.classes,
    students: base.students,
  };
}
