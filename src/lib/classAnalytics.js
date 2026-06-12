import { studentsMissingFeedback, studentsMissingReport } from './submissionTracking.js';

export function weekLabel(date) {
  if (!date?.getTime) return '—';
  const d = new Date(date);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return start.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

/** Average progress % per calendar week from report list. */
export function aggregateWeeklyProgress(reports) {
  const buckets = new Map();
  reports.forEach((r) => {
    const key = weekLabel(r.submittedAt);
    if (key === '—') return;
    if (!buckets.has(key)) buckets.set(key, { sum: 0, count: 0, key });
    const b = buckets.get(key);
    b.sum += Number(r.progressPercent || 0);
    b.count += 1;
  });
  return [...buckets.values()]
    .map((b) => ({ week: b.key, avg: Math.round(b.sum / b.count) }))
    .slice(-8);
}

/** Per-session average understanding level (1–5). */
export function averageUnderstanding(feedbacks, sessionNumber = null) {
  const list =
    sessionNumber != null
      ? feedbacks.filter((f) => Number(f.sessionNumber) === Number(sessionNumber))
      : feedbacks;
  if (!list.length) return null;
  return Number(
    (list.reduce((sum, f) => sum + Number(f.understandingLevel || 0), 0) / list.length).toFixed(1),
  );
}

/** Heatmap data: average understanding per session. */
export function sessionUnderstandingHeatmap(feedbacks) {
  const bySession = new Map();
  feedbacks.forEach((f) => {
    const s = Number(f.sessionNumber) || 0;
    if (!bySession.has(s)) bySession.set(s, { sum: 0, count: 0 });
    const e = bySession.get(s);
    e.sum += Number(f.understandingLevel || 0);
    e.count += 1;
  });
  return [...bySession.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([session, { sum, count }]) => ({
      session: `B${session}`,
      avg: Number((sum / count).toFixed(1)),
      count,
    }));
}

export function classComparisonRows(activeClasses, students, feedbacksByClass) {
  return activeClasses.map((cls) => {
    const classStudents = students.filter((s) => s.active && s.classCode === cls.classCode);
    const total = classStudents.length;
    const done = classStudents.filter((s) => s.currentStatus === 'Hoàn thành').length;
    const avgProgress = total
      ? Math.round(classStudents.reduce((sum, s) => sum + Number(s.currentProgressPercent || 0), 0) / total)
      : 0;
    const feedbacks = feedbacksByClass[cls.classCode] || [];
    const avgUnderstanding = averageUnderstanding(feedbacks) ?? 0;
    return {
      classCode: cls.classCode,
      className: cls.className,
      students: total,
      completionRate: total ? Math.round((done / total) * 100) : 0,
      avgProgress,
      avgUnderstanding,
    };
  });
}

export function buildMissingSubmissionItemsSync(activeClasses, students, feedbacksByClass = {}) {
  const items = [];
  for (const cls of activeClasses) {
    const classStudents = students.filter((s) => s.active && s.classCode === cls.classCode);
    if (!classStudents.length) continue;

    if (cls.curriculumPhase === 'learning' && Number(cls.curriculumCurrentSession) > 0) {
      const feedbacks = feedbacksByClass[cls.classCode] || [];
      const missing = studentsMissingFeedback(classStudents, feedbacks, cls.curriculumCurrentSession);
      if (missing.length) {
        items.push({
          kind: 'feedback',
          classCode: cls.classCode,
          className: cls.className,
          session: cls.curriculumCurrentSession,
          students: missing,
        });
      }
    }

    if (cls.curriculumPhase === 'final') {
      const missing = studentsMissingReport(classStudents);
      if (missing.length) {
        items.push({
          kind: 'report',
          classCode: cls.classCode,
          className: cls.className,
          students: missing,
        });
      }
    }
  }
  return items;
}

export async function buildMissingSubmissionItems(activeClasses, students, loadFeedbacks) {
  const items = [];
  for (const cls of activeClasses) {
    const classStudents = students.filter((s) => s.active && s.classCode === cls.classCode);
    if (!classStudents.length) continue;

    if (cls.curriculumPhase === 'learning' && Number(cls.curriculumCurrentSession) > 0) {
      const feedbacks = await loadFeedbacks(cls.classCode);
      const missing = studentsMissingFeedback(classStudents, feedbacks, cls.curriculumCurrentSession);
      if (missing.length) {
        items.push({
          kind: 'feedback',
          classCode: cls.classCode,
          className: cls.className,
          session: cls.curriculumCurrentSession,
          students: missing,
        });
      }
    }

    if (cls.curriculumPhase === 'final') {
      const missing = studentsMissingReport(classStudents);
      if (missing.length) {
        items.push({
          kind: 'report',
          classCode: cls.classCode,
          className: cls.className,
          students: missing,
        });
      }
    }
  }
  return items;
}
