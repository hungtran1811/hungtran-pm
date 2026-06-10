import { fetchAdminBaseData } from './adminDataCache.js';
import { listKnowledgeReportsByClass } from '../services/knowledgeReports.service.js';
import { listPracticeSubmissionsByClass } from '../services/practiceQuiz.service.js';
import { listReportsByClass } from '../services/reports.service.js';
import { listStudentQuizSubmissions } from '../services/quiz.service.js';
import { listStudentsByClassCodes } from '../services/students.service.js';

async function mergeByClass(classCodes, loadFn) {
  if (!classCodes.length) return [];
  const parts = await Promise.all(classCodes.map((code) => loadFn(code)));
  return parts.flat();
}

export async function loadAdminClasses({ force = false } = {}) {
  const base = await fetchAdminBaseData({ force });
  return base.classes;
}

export async function loadReportsPanelSnapshot(classCodes, { force = false } = {}) {
  const [base, students, reports] = await Promise.all([
    fetchAdminBaseData({ force }),
    listStudentsByClassCodes(classCodes, { activeOnly: true }),
    mergeByClass(classCodes, listReportsByClass),
  ]);
  return { classes: base.classes, students, reports };
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
  return { classes: base.classes, submissions };
}

export async function loadPracticePanelSnapshot(classCodes, { force = false } = {}) {
  const [base, submissions] = await Promise.all([
    fetchAdminBaseData({ force }),
    mergeByClass(classCodes, listPracticeSubmissionsByClass),
  ]);
  return { classes: base.classes, submissions };
}
