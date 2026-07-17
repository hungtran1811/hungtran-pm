import { studentsMissingFeedback, studentsMissingReport } from './submissionTracking.js';
import {
  FEATURE_KNOWLEDGE_FEEDBACK_ENABLED,
  FEATURE_PROGRESS_REPORTS_ENABLED,
} from '../config/features.js';

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

function classStatusBadge(cls, classStudents) {
  const needSupport = classStudents.filter(
    (s) => s.currentStatus === 'Cần hỗ trợ' || Boolean(String(s.currentDifficulties || '').trim()),
  ).length;
  if (needSupport > 0) {
    return { id: 'support', label: 'Cần hỗ trợ', tone: 'red', count: needSupport };
  }

  if (FEATURE_PROGRESS_REPORTS_ENABLED && cls.curriculumPhase === 'final') {
    const missing = studentsMissingReport(classStudents);
    if (missing.length) {
      return { id: 'missing_report', label: 'Chưa nộp báo cáo', tone: 'amber', count: missing.length };
    }
  }

  return { id: 'ok', label: 'OK', tone: 'green', count: 0 };
}

export function classComparisonRows(activeClasses, students, feedbacksByClass = {}) {
  return activeClasses.map((cls) => {
    const classStudents = students.filter((s) => s.active && s.classCode === cls.classCode);
    const total = classStudents.length;
    const done = classStudents.filter((s) => s.currentStatus === 'Hoàn thành').length;
    const avgProgress = total
      ? Math.round(classStudents.reduce((sum, s) => sum + Number(s.currentProgressPercent || 0), 0) / total)
      : 0;
    const feedbacks = feedbacksByClass[cls.classCode] || [];
    const avgUnderstanding = FEATURE_KNOWLEDGE_FEEDBACK_ENABLED
      ? (averageUnderstanding(feedbacks) ?? 0)
      : null;
    const needSupport = classStudents.filter((s) => s.currentStatus === 'Cần hỗ trợ').length;
    const missingReports =
      cls.curriculumPhase === 'final' ? studentsMissingReport(classStudents).length : 0;
    return {
      classCode: cls.classCode,
      className: cls.className,
      students: total,
      completionRate: total ? Math.round((done / total) * 100) : 0,
      avgProgress,
      avgUnderstanding,
      needSupport,
      missingReports,
      badge: classStatusBadge(cls, classStudents),
      phase: cls.curriculumPhase || 'learning',
      currentSession: Number(cls.curriculumCurrentSession || 0),
    };
  });
}

/** Phân bố trạng thái HS trong phạm vi. */
export function studentStatusDistribution(students = []) {
  const buckets = [
    { id: 'learning', label: 'Đang học', tone: 'brand', match: (s) => s.currentStatus === 'Đang học' },
    { id: 'support', label: 'Cần hỗ trợ', tone: 'red', match: (s) => s.currentStatus === 'Cần hỗ trợ' },
    { id: 'done', label: 'Hoàn thành', tone: 'green', match: (s) => s.currentStatus === 'Hoàn thành' },
    {
      id: 'other',
      label: 'Khác',
      tone: 'slate',
      match: (s) => !['Đang học', 'Cần hỗ trợ', 'Hoàn thành'].includes(s.currentStatus),
    },
  ];
  const total = students.length || 1;
  return buckets
    .map((b) => {
      const count = students.filter(b.match).length;
      return {
        ...b,
        count,
        percent: Math.round((count / total) * 100),
      };
    })
    .filter((b) => b.count > 0 || b.id !== 'other');
}

/** Phân bố tiến độ theo bucket %. */
export function progressBucketDistribution(students = []) {
  const buckets = [
    { id: '0-25', label: '0–25%', min: 0, max: 25, tone: 'red' },
    { id: '25-50', label: '25–50%', min: 25, max: 50, tone: 'amber' },
    { id: '50-75', label: '50–75%', min: 50, max: 75, tone: 'brand' },
    { id: '75-100', label: '75–100%', min: 75, max: 101, tone: 'green' },
  ];
  const total = students.length || 1;
  return buckets.map((b) => {
    const count = students.filter((s) => {
      const p = Number(s.currentProgressPercent || 0);
      return p >= b.min && p < b.max;
    }).length;
    return {
      ...b,
      count,
      percent: Math.round((count / total) * 100),
    };
  });
}

/** Lớp / HS cần chú ý — ưu tiên hỗ trợ rồi báo cáo cũ. */
export function buildAttentionItems(classRows = [], limit = 8) {
  return [...classRows]
    .filter((row) => row.badge?.id === 'support' || row.badge?.id === 'missing_report')
    .sort((a, b) => {
      const rank = (row) => (row.badge?.id === 'support' ? 0 : 1);
      const byRank = rank(a) - rank(b);
      if (byRank !== 0) return byRank;
      return (b.needSupport || 0) - (a.needSupport || 0);
    })
    .slice(0, limit)
    .map((row) => ({
      classCode: row.classCode,
      label: row.badge?.label || 'Cần xem',
      tone: row.badge?.tone || 'amber',
      detail:
        row.badge?.id === 'support'
          ? `${row.needSupport} HS cần hỗ trợ · tiến độ TB ${row.avgProgress}%`
          : `${row.missingReports} HS chưa nộp / báo cáo cũ · tiến độ TB ${row.avgProgress}%`,
    }));
}

export function phaseSplit(classes = []) {
  const learning = classes.filter((c) => c.curriculumPhase !== 'final').length;
  const finalPhase = classes.filter((c) => c.curriculumPhase === 'final').length;
  return { learning, finalPhase, total: classes.length };
}

export function buildMissingSubmissionItemsSync(activeClasses, students, feedbacksByClass = {}) {
  const items = [];
  for (const cls of activeClasses) {
    const classStudents = students.filter((s) => s.active && s.classCode === cls.classCode);
    if (!classStudents.length) continue;

    if (
      FEATURE_KNOWLEDGE_FEEDBACK_ENABLED
      && cls.curriculumPhase === 'learning'
      && Number(cls.curriculumCurrentSession) > 0
    ) {
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

    if (FEATURE_PROGRESS_REPORTS_ENABLED && cls.curriculumPhase === 'final') {
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

    if (
      FEATURE_KNOWLEDGE_FEEDBACK_ENABLED
      && cls.curriculumPhase === 'learning'
      && Number(cls.curriculumCurrentSession) > 0
    ) {
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

    if (FEATURE_PROGRESS_REPORTS_ENABLED && cls.curriculumPhase === 'final') {
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
