import { FEATURE_DRIVE_SUBMISSION_ENABLED } from '../config/features.js';
import { listKnowledgeReportsByClass } from '../services/knowledgeReports.service.js';
import { loadLatestReportsForStudents } from '../services/reports.service.js';
import { listSubmissionsByClass } from '../services/submissions.service.js';
import { fetchAdminBaseData, invalidateAdminDataCache } from './adminDataCache.js';
import { collectSettledSubmissions } from './dashboardStats.js';

async function mergeByClass(classCodes, loadFn) {
  if (!classCodes.length) return [];
  const parts = await Promise.all(classCodes.map((code) => loadFn(code)));
  return parts.flat();
}

let feedbackCache = null;
let dashboardOpsCache = null;
export const FEEDBACK_CACHE_TTL_MS = 90_000;
export const DASHBOARD_OPS_CACHE_TTL_MS = 90_000;

export function invalidateAdminSnapshots() {
  invalidateAdminDataCache();
  feedbackCache = null;
  dashboardOpsCache = null;
}

export async function loadAdminClasses({ force = false } = {}) {
  const base = await fetchAdminBaseData({ force });
  return base.classes;
}

export async function loadReportsPanelSnapshot(
  classCodes,
  { force = false, includeLatestReports = true } = {},
) {
  const base = await fetchAdminBaseData({ force });
  const codeSet = new Set(classCodes || []);
  const students = (base.students || []).filter((s) => codeSet.has(s.classCode));
  const latestByStudent = includeLatestReports
    ? await loadLatestReportsForStudents(students)
    : new Map();
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

function activeClassCodesKey(classes = []) {
  return classes
    .filter((cls) => cls.status === 'active')
    .map((cls) => cls.classCode)
    .sort()
    .join('|');
}

async function loadActiveClassSubmissions(classes = []) {
  if (!FEATURE_DRIVE_SUBMISSION_ENABLED) {
    return { submissionsByClass: {}, failedClassCodes: [] };
  }
  const classCodes = classes.filter((cls) => cls.status === 'active').map((cls) => cls.classCode);
  if (!classCodes.length) {
    return { submissionsByClass: {}, failedClassCodes: [] };
  }
  const results = await Promise.allSettled(classCodes.map((code) => listSubmissionsByClass(code)));
  return collectSettledSubmissions(classCodes, results);
}

export async function loadDashboardOpsSnapshot({ force = false } = {}) {
  const base = await fetchAdminBaseData({ force });
  const cacheKey = activeClassCodesKey(base.classes);
  if (
    !force
    && dashboardOpsCache
    && dashboardOpsCache.key === cacheKey
    && Date.now() - dashboardOpsCache.fetchedAt < DASHBOARD_OPS_CACHE_TTL_MS
  ) {
    return {
      classes: base.classes,
      students: base.students,
      submissionsByClass: dashboardOpsCache.submissionsByClass,
      failedClassCodes: dashboardOpsCache.failedClassCodes,
      fromCache: true,
    };
  }

  const { submissionsByClass, failedClassCodes } = await loadActiveClassSubmissions(base.classes);
  dashboardOpsCache = {
    key: cacheKey,
    submissionsByClass,
    failedClassCodes,
    fetchedAt: Date.now(),
  };
  return {
    classes: base.classes,
    students: base.students,
    submissionsByClass,
    failedClassCodes,
    fromCache: false,
  };
}
