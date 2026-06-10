import { listKnowledgeReportsByClass } from '../services/knowledgeReports.service.js';
import { listReportsByClass } from '../services/reports.service.js';

const FEEDBACK_LIMIT = 100;
const REPORT_LIMIT = 100;

/** One-shot analytics payloads — avoids 2×N realtime listeners on Spark tier. */
export async function loadAnalyticsByClass(classCodes) {
  if (!classCodes.length) {
    return { feedbacksByClass: {}, reportsByClass: {} };
  }

  const pairs = await Promise.all(
    classCodes.map(async (classCode) => {
      const [feedbacks, reports] = await Promise.all([
        listKnowledgeReportsByClass(classCode, FEEDBACK_LIMIT),
        listReportsByClass(classCode, REPORT_LIMIT),
      ]);
      return { classCode, feedbacks, reports };
    }),
  );

  const feedbacksByClass = {};
  const reportsByClass = {};
  pairs.forEach(({ classCode, feedbacks, reports }) => {
    feedbacksByClass[classCode] = feedbacks;
    reportsByClass[classCode] = reports;
  });

  return { feedbacksByClass, reportsByClass };
}
