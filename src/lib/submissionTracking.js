/** Days without a progress report before flagging on dashboard/analytics. */
export const STALE_REPORT_DAYS = 7;

export function daysSince(date) {
  if (!date?.getTime) return null;
  const ms = Date.now() - date.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function isStaleReport(lastReportedAt, thresholdDays = STALE_REPORT_DAYS) {
  if (!lastReportedAt) return true;
  const days = daysSince(lastReportedAt);
  return days === null || days >= thresholdDays;
}

/** Latest feedback per student for a given session (or all sessions if null). */
export function latestFeedbackPerStudent(feedbacks, sessionNumber = null) {
  const filtered =
    sessionNumber != null
      ? feedbacks.filter((f) => Number(f.sessionNumber) === Number(sessionNumber))
      : feedbacks;
  const seen = new Set();
  return filtered.filter((f) => {
    if (seen.has(f.studentId)) return false;
    seen.add(f.studentId);
    return true;
  });
}

/** Student IDs that submitted feedback for the session. */
export function submittedStudentIdsForSession(feedbacks, sessionNumber) {
  const ids = new Set();
  feedbacks.forEach((f) => {
    if (Number(f.sessionNumber) === Number(sessionNumber)) ids.add(f.studentId);
  });
  return ids;
}

export function studentsMissingFeedback(activeStudents, feedbacks, sessionNumber) {
  const submitted = submittedStudentIdsForSession(feedbacks, sessionNumber);
  return activeStudents.filter((s) => !submitted.has(s.id));
}

export function studentsMissingReport(activeStudents, thresholdDays = STALE_REPORT_DAYS) {
  return activeStudents.filter((s) => isStaleReport(s.lastReportedAt, thresholdDays));
}
