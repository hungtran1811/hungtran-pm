import { CURRICULUM_PHASE_LABELS } from '../constants/index.js';
import { canReviewStudentProjectName } from './classFinalMode.js';
import { isArchivedClassStatus } from './classStatus.js';
import { classRequiresProgressAndProduct } from './studentWorkspace.js';
import { summarizeDriveSubmissionsByStudent } from './submissionAdmin.js';
import { lessonKeysEqual, normalizeLessonKey } from './submissionFileName.js';

export function studentClassCode(student) {
  return student?.classCode || student?.classId || '';
}

export function classReportsHref(classCode, { filter } = {}) {
  const params = [`tab=progress`, `class=${encodeURIComponent(classCode || '')}`];
  if (filter === 'missing' || filter === 'done') params.push(`filter=${filter}`);
  return `/admin/reports?${params.join('&')}`;
}

export function classStudentsHref(classCode, { review = false } = {}) {
  const params = [`class=${encodeURIComponent(classCode || '')}`];
  if (review) params.push('review=1');
  return `/admin/students?${params.join('&')}`;
}

export function classSessionLabel(sessionNumber) {
  return normalizeLessonKey(sessionNumber) || '—';
}

export function classPhaseLabel(phase) {
  return CURRICULUM_PHASE_LABELS[phase] || (phase === 'final' ? 'Làm sản phẩm cuối khóa' : 'Học kiến thức');
}

function hasLastReport(student) {
  return Boolean(student?.lastReportedAt);
}

function sortActiveClasses(classes) {
  return [...classes].sort((a, b) =>
    (a.classCode || '').localeCompare(b.classCode || '', 'vi'),
  );
}

function countStudentsWithLessonFile(students, submissions = [], sessionNumber) {
  const lessonKey = normalizeLessonKey(sessionNumber);
  if (!lessonKey) return 0;
  const byStudent = summarizeDriveSubmissionsByStudent(submissions);
  return students.filter((student) => {
    const files = byStudent.get(student.id)?.files || [];
    return files.some((file) => lessonKeysEqual(file.lessonKey, lessonKey));
  }).length;
}

export function formatOpsRatio({
  applicable = false,
  unavailable = false,
  submitted = null,
  total = null,
} = {}) {
  if (!applicable || unavailable || submitted == null || total == null) return '—';
  return `${submitted}/${total}`;
}

export function formatReportRatio(row = {}) {
  return formatOpsRatio({
    applicable: row.reportsApplicable,
    submitted: row.reportSubmitted,
    total: row.reportTotal,
  });
}

export function formatFileRatio(row = {}) {
  return formatOpsRatio({
    applicable: row.filesApplicable,
    unavailable: row.filesUnavailable,
    submitted: row.fileSubmitted,
    total: row.fileTotal,
  });
}

/** Gộp kết quả Promise.allSettled của listSubmissionsByClass — lớp lỗi bị bỏ key. */
export function collectSettledSubmissions(classCodes = [], results = []) {
  const submissionsByClass = {};
  const failedClassCodes = [];
  classCodes.forEach((code, index) => {
    const result = results[index];
    if (result?.status === 'fulfilled') {
      submissionsByClass[code] = result.value || [];
      return;
    }
    failedClassCodes.push(code);
  });
  return { submissionsByClass, failedClassCodes };
}

export function opsRowBadge({
  needSupport = 0,
  pendingNames = 0,
  reportMissing = 0,
  fileMissing = 0,
  reportsApplicable = false,
  filesApplicable = false,
} = {}) {
  if (needSupport > 0) {
    return { id: 'support', label: 'Cần hỗ trợ', tone: 'red', count: needSupport };
  }
  if (pendingNames > 0) {
    return { id: 'pending_name', label: 'Chờ duyệt tên', tone: 'amber', count: pendingNames };
  }
  if (reportsApplicable && reportMissing > 0) {
    return { id: 'missing_report', label: 'Thiếu báo cáo', tone: 'amber', count: reportMissing };
  }
  if (filesApplicable && fileMissing > 0) {
    return { id: 'missing_file', label: 'Thiếu file', tone: 'amber', count: fileMissing };
  }
  return { id: 'ok', label: 'OK', tone: 'green', count: 0 };
}

/** Hàng bảng điều hành — chỉ lớp đang mở. */
export function buildClassOpsRows(
  classes = [],
  students = [],
  submissionsByClass = {},
  { driveEnabled = false } = {},
) {
  const activeClasses = sortActiveClasses(classes.filter((cls) => cls.status === 'active'));

  return activeClasses.map((cls) => {
    const classStudents = students.filter(
      (student) => student.active && studentClassCode(student) === cls.classCode,
    );
    const total = classStudents.length;
    const needSupport = classStudents.filter((student) => student.currentStatus === 'Cần hỗ trợ').length;
    const pendingNames = classStudents.filter((student) =>
      canReviewStudentProjectName(student, cls),
    ).length;
    const reportsApplicable = classRequiresProgressAndProduct(cls);
    const reportSubmitted = reportsApplicable ? classStudents.filter(hasLastReport).length : null;
    const reportMissing = reportsApplicable ? Math.max(0, total - reportSubmitted) : 0;

    const currentSession = Number(cls.curriculumCurrentSession || 0);
    const filesApplicable = Boolean(driveEnabled) && currentSession > 0;
    const filesLoaded = Object.prototype.hasOwnProperty.call(submissionsByClass, cls.classCode);
    const filesUnavailable = filesApplicable && !filesLoaded;
    const filesReady = filesApplicable && filesLoaded;
    const fileSubmitted = filesReady
      ? countStudentsWithLessonFile(classStudents, submissionsByClass[cls.classCode] || [], currentSession)
      : null;
    const fileMissing = filesReady ? Math.max(0, total - fileSubmitted) : 0;

    return {
      classCode: cls.classCode,
      className: cls.className || '',
      phase: cls.curriculumPhase === 'final' ? 'final' : 'learning',
      currentSession,
      students: total,
      needSupport,
      pendingNames,
      reportsApplicable,
      reportSubmitted,
      reportTotal: reportsApplicable ? total : null,
      reportMissing,
      filesApplicable,
      filesUnavailable,
      fileSubmitted,
      fileTotal: filesReady ? total : null,
      fileMissing,
      driveFolderId: cls.driveFolderId || '',
      reportsHref: classReportsHref(cls.classCode),
      studentsHref: classStudentsHref(cls.classCode),
      badge: opsRowBadge({
        needSupport,
        pendingNames,
        reportMissing,
        fileMissing,
        reportsApplicable,
        filesApplicable: filesReady,
      }),
    };
  });
}

const ATTENTION_RANK = { support: 0, pending_name: 1, missing_report: 2, missing_file: 3 };

function attentionItem(row, id, { label, tone, count, detail, href }) {
  return {
    id,
    classCode: row.classCode,
    className: row.className,
    label,
    tone,
    count,
    detail,
    href,
  };
}

export function buildOpsAttentionItems(rows = [], limit = 8) {
  const items = [];
  rows.forEach((row) => {
    if (row.needSupport > 0) {
      items.push(
        attentionItem(row, 'support', {
          label: 'Cần hỗ trợ',
          tone: 'red',
          count: row.needSupport,
          detail: `${row.needSupport} học sinh cần hỗ trợ`,
          href: row.studentsHref || classStudentsHref(row.classCode),
        }),
      );
    }
    if (row.pendingNames > 0) {
      items.push(
        attentionItem(row, 'pending_name', {
          label: 'Chờ duyệt tên',
          tone: 'amber',
          count: row.pendingNames,
          detail: `${row.pendingNames} học sinh chờ duyệt tên dự án`,
          href: classStudentsHref(row.classCode, { review: true }),
        }),
      );
    }
    if (row.reportsApplicable && row.reportMissing > 0) {
      items.push(
        attentionItem(row, 'missing_report', {
          label: 'Thiếu báo cáo',
          tone: 'amber',
          count: row.reportMissing,
          detail: `${row.reportMissing} học sinh chưa nộp báo cáo`,
          href: classReportsHref(row.classCode, { filter: 'missing' }),
        }),
      );
    }
    if (row.fileMissing > 0) {
      items.push(
        attentionItem(row, 'missing_file', {
          label: 'Thiếu file',
          tone: 'amber',
          count: row.fileMissing,
          detail: `${row.fileMissing} học sinh chưa nộp file buổi ${classSessionLabel(row.currentSession)}`,
          href: row.reportsHref || classReportsHref(row.classCode),
        }),
      );
    }
  });

  return items
    .sort((left, right) => {
      const byRank = (ATTENTION_RANK[left.id] ?? 9) - (ATTENTION_RANK[right.id] ?? 9);
      if (byRank) return byRank;
      return (right.count || 0) - (left.count || 0);
    })
    .slice(0, limit);
}

export function computeOpsKpis(rows = []) {
  return rows.reduce(
    (acc, row) => {
      acc.openClasses += 1;
      acc.needSupport += row.needSupport || 0;
      acc.missingReports += row.reportMissing || 0;
      acc.missingFiles += row.fileMissing || 0;
      return acc;
    },
    { openClasses: 0, needSupport: 0, missingReports: 0, missingFiles: 0 },
  );
}

/** Chỉ số tổng quan — tập trung lớp đang vận hành (status active). */
export function computeDashboardStats(classes = [], students = []) {
  const activeClasses = classes.filter((c) => c.status === 'active');
  const activeCodes = new Set(activeClasses.map((c) => c.classCode));

  const activeStudents = students.filter(
    (s) => s.active && activeCodes.has(studentClassCode(s)),
  );

  const archivedCodes = new Set(
    classes.filter((c) => isArchivedClassStatus(c.status)).map((c) => c.classCode),
  );

  const alumniStudents = students.filter(
    (s) => s.active && archivedCodes.has(studentClassCode(s)),
  ).length;

  const finishedClassCodes = archivedCodes;

  const completedCourse = students.filter(
    (s) =>
      s.active &&
      (s.currentStatus === 'Hoàn thành' || finishedClassCodes.has(studentClassCode(s))),
  ).length;

  const enrolledOnClassDocs = activeClasses.reduce(
    (sum, c) => sum + Number(c.studentCount || 0),
    0,
  );

  return {
    activeClasses: activeClasses.length,
    totalClasses: classes.length,
    archivedClasses: archivedCodes.size,
    activeStudents: activeStudents.length,
    enrolledOnClassDocs,
    needsHelp: activeStudents.filter((s) => s.currentStatus === 'Cần hỗ trợ').length,
    completedCourse,
    alumniStudents,
  };
}
