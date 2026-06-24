import { fetchAdminBaseData, invalidateAdminDataCache } from './adminDataCache.js';
import { listKnowledgeReportsByClass } from '../services/knowledgeReports.service.js';
import { listPracticeSubmissionsByClass, regradePendingPracticeSubmissions } from '../services/practiceQuiz.service.js';
import { loadLatestReportsForStudents } from '../services/reports.service.js';
import { listStudentQuizSubmissions, regradePendingQuizSubmissions } from '../services/quiz.service.js';
import { listStudentsByClassCodes } from '../services/students.service.js';

async function mergeByClass(classCodes, loadFn) {
  if (!classCodes.length) return [];
  const parts = await Promise.all(classCodes.map((code) => loadFn(code)));
  return parts.flat();
}

let feedbackCache = null;
const FEEDBACK_CACHE_TTL_MS = 90_000;

export function invalidateAdminSnapshots() {
  invalidateAdminDataCache();
  feedbackCache = null;
}

export async function loadAdminClasses({ force = false } = {}) {
  const base = await fetchAdminBaseData({ force });
  return base.classes;
}

export async function loadReportsPanelSnapshot(classCodes, { force = false } = {}) {
  const [base, students] = await Promise.all([
    fetchAdminBaseData({ force }),
    listStudentsByClassCodes(classCodes, { activeOnly: true }),
  ]);
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
  const [base, students, reports] = await Promise.all([
    fetchAdminBaseData({ force }),
    listStudentsByClassCodes(classCodes, { activeOnly: true }),
    mergeByClass(classCodes, listKnowledgeReportsByClass),
  ]);
  return { classes: base.classes, students, reports };
}

export async function loadQuizPanelSnapshot(classCodes, { force = false } = {}) {
  const [base, submissions] = await Promise.all([
    fetchAdminBaseData({ force }),
    mergeByClass(classCodes, listStudentQuizSubmissions),
  ]);
  await regradePendingQuizSubmissions(submissions);
  const refreshed = await mergeByClass(classCodes, listStudentQuizSubmissions);
  return { classes: base.classes, submissions: refreshed };
}

export async function loadPracticePanelSnapshot(classCodes, { force = false } = {}) {
  const [base, submissions] = await Promise.all([
    fetchAdminBaseData({ force }),
    mergeByClass(classCodes, listPracticeSubmissionsByClass),
  ]);
  await regradePendingPracticeSubmissions(submissions);
  const refreshed = await mergeByClass(classCodes, listPracticeSubmissionsByClass);
  return { classes: base.classes, submissions: refreshed };
}

export async function loadDashboardOpsSnapshot({ force = false } = {}) {
  const base = await fetchAdminBaseData({ force });
  const activeClasses = base.classes.filter((c) => c.status === 'active');
  const classCodes = activeClasses.map((c) => c.classCode);
  const [quizSubmissions, feedbackByClass] = await Promise.all([
    mergeByClass(classCodes, listStudentQuizSubmissions),
    loadFeedbackByClassCodes(classCodes, { force }),
  ]);
  return {
    classes: base.classes,
    students: base.students,
    quizSubmissions,
    feedbackByClass,
  };
}
