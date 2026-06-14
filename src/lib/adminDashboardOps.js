import { STALE_REPORT_DAYS, studentsMissingFeedback, studentsMissingReport } from './submissionTracking.js';
import { summarizeQuizScoresByClass } from './quizAdminScores.js';

export function buildDashboardTodayItems({
  classes = [],
  students = [],
  feedbackByClass = {},
  quizSubmissions = [],
}) {
  const activeClasses = classes.filter((c) => c.status === 'active');
  const items = [];

  activeClasses.forEach((cls) => {
    const classStudents = students.filter((s) => s.active && s.classCode === cls.classCode);
    const session = Number(cls.curriculumCurrentSession ?? 0);
    if (session <= 0) return;

    const feedbacks = feedbackByClass[cls.classCode] ?? [];
    const missingFeedback = studentsMissingFeedback(classStudents, feedbacks, session);
    if (missingFeedback.length) {
      items.push({
        id: `feedback-${cls.classCode}-${session}`,
        tone: 'amber',
        label: `${cls.classCode} · ${missingFeedback.length} HS chưa phản hồi buổi ${session}`,
        to: `/admin/reports?tab=feedback&class=${encodeURIComponent(cls.classCode)}&session=${session}`,
      });
    }

    const missingReports = studentsMissingReport(classStudents, STALE_REPORT_DAYS).filter(
      (s) => cls.curriculumPhase === 'final',
    );
    if (missingReports.length) {
      items.push({
        id: `report-${cls.classCode}`,
        tone: 'red',
        label: `${cls.classCode} · ${missingReports.length} HS báo cáo cũ / chưa nộp`,
        to: `/admin/reports?tab=progress&class=${encodeURIComponent(cls.classCode)}`,
      });
    }
  });

  const quizSummaries = summarizeQuizScoresByClass(quizSubmissions, activeClasses);
  quizSummaries.forEach((summary) => {
    if (summary.submissionCount > 0) {
      items.push({
        id: `quiz-${summary.classCode}`,
        tone: 'brand',
        label: `${summary.classCode} · buổi ${summary.currentSession}: TB ${summary.averagePercent}% (${summary.submissionCount} HS)`,
        to: `/admin/scores?tab=quiz&class=${encodeURIComponent(summary.classCode)}&session=${summary.currentSession}`,
      });
    }
  });

  return items;
}
