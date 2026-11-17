import { latestReportForLesson, scopeDriveToLesson } from './progressReports.js';

export function lessonReportForReview(lessons, lessonKey = '') {
  if (!lessonKey) return null;
  const report = latestReportForLesson(lessons, lessonKey);
  if (!report || report.snapshotOnly) return null;
  return report;
}

export function reportsInClass(classReports = [], studentId = '') {
  return classReports
    .filter((row) => row?.studentId === studentId && !row.snapshotOnly)
    .slice()
    .sort(
      (left, right) =>
        (right.submittedAt?.getTime?.() || 0) - (left.submittedAt?.getTime?.() || 0),
    );
}

export function buildClassReviewItem({
  student,
  lessonKey = '',
  lessons,
  classReports = [],
  allDrive = null,
  requiresBoth = false,
  isAllClasses = false,
  latestReport = null,
}) {
  const reportHistory = reportsInClass(classReports, student.id);
  if (isAllClasses) {
    const report = latestReport && !latestReport.snapshotOnly ? latestReport : null;
    return {
      student,
      report,
      drive: null,
      hasReport: Boolean(report),
      hasFile: false,
      isComplete: Boolean(report),
      reportCount: report ? 1 : 0,
      showClass: true,
      reportHistory,
      driveHistory: null,
    };
  }

  const drive = scopeDriveToLesson(allDrive, lessonKey);
  const hasFile = Boolean(drive);
  if (!requiresBoth) {
    return {
      student,
      report: null,
      drive,
      hasReport: false,
      hasFile,
      isComplete: hasFile,
      reportCount: reportHistory.length,
      showClass: false,
      reportHistory,
      driveHistory: allDrive,
    };
  }

  const report = lessonReportForReview(lessons, lessonKey);
  const hasReport = Boolean(report);
  return {
    student,
    report,
    drive,
    hasReport,
    hasFile,
    isComplete: hasReport && hasFile,
    reportCount: reportHistory.length,
    showClass: false,
    reportHistory,
    driveHistory: allDrive,
  };
}
