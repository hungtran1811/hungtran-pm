import { subscribeClasses } from '../../services/classes.service.js';
import { saveClassCurriculumAssignment, subscribeCurriculumPrograms } from '../../services/curriculum.service.js';
import { subscribeKnowledgeReports } from '../../services/knowledge-reports.service.js';
import { setClassQuizStatus } from '../../services/quiz-class-control.service.js';
import { getStudentReportHistory, subscribeTodayReports } from '../../services/reports.service.js';
import { subscribeStudents } from '../../services/students.service.js';
import { getAuthState } from '../../state/auth.store.js';
import { copyTextToClipboard } from '../../utils/clipboard.js';
import { daysSince, formatDateTime } from '../../utils/date.js';
import { mapFirebaseError } from '../../utils/firebase-error.js';
import { escapeHtml, nl2br } from '../../utils/html.js';
import {
  buildPublicLibraryPath,
  buildPublicReportPath,
} from '../../utils/route.js';
import {
  getActiveCurriculumLessons,
  getCurriculumActivityTypeLabel,
  getCurriculumSessionActivity,
  isCurriculumQuizActivity,
} from '../../utils/curriculum-program.js';
import {
  getEffectiveCurriculumPhase,
  isCurriculumExerciseVisibleForSession,
  setCurriculumExerciseVisibleForSession,
} from '../../utils/curriculum.js';
import { getLessonMarkdownSource, LESSON_MARKDOWN_TAB_EXERCISE } from '../../utils/lesson-markdown.js';
import { isQuizStartedForClass } from '../../utils/quiz.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderStageBadge } from '../components/StageBadge.js';
import { renderStatusBadge } from '../components/StatusBadge.js';
import { showToast } from '../components/ToastStack.js';

const COMPLETED_STATUS = 'Hoàn thành';
const SUPPORT_STATUS = 'Cần hỗ trợ';
const NEARLY_DONE_STATUS = 'Gần hoàn thành';
const STALE_REPORT_DAYS = 7;
const REPORT_FRESH_DAYS = 7;
const PRODUCTION_PUBLIC_ORIGIN = 'https://hungtranpm.netlify.app';

const STUDENT_FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'missing-report', label: 'Chưa ghi nhận' },
  { id: 'support', label: 'Cần hỗ trợ' },
  { id: 'near-complete', label: 'Sắp hoàn thành' },
  { id: 'completed', label: 'Đã hoàn thành' },
];

function clampProgress(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

function isOperationalClass(classItem) {
  return classItem?.status === 'active' && !classItem.hidden;
}

function isTrackedStudent(student) {
  return student?.active !== false;
}

function isStudentInClass(student, classInfo) {
  return (
    student?.classCode === classInfo?.classCode ||
    student?.classId === classInfo?.classCode ||
    student?.classId === classInfo?.id
  );
}

function isCompletedStudent(student) {
  return student?.currentStatus === COMPLETED_STATUS || clampProgress(student?.currentProgressPercent) >= 100;
}

function isNearCompleteStudent(student) {
  const progress = clampProgress(student?.currentProgressPercent);
  return !isCompletedStudent(student) && (student?.currentStatus === NEARLY_DONE_STATUS || progress >= 80);
}

function getLatestReportsMap(reports = []) {
  const latestByStudent = new Map();

  for (const report of reports) {
    const current = latestByStudent.get(report.studentId);
    const currentTime = current?.submittedAt ? current.submittedAt.getTime() : 0;
    const reportTime = report?.submittedAt ? report.submittedAt.getTime() : 0;

    if (!current || reportTime >= currentTime) {
      latestByStudent.set(report.studentId, report);
    }
  }

  return latestByStudent;
}

function getLatestKnowledgeReportsMap(reports = []) {
  const latestByStudent = new Map();

  for (const report of reports) {
    const current = latestByStudent.get(report.studentId);
    const currentTime = current?.submittedAt ? current.submittedAt.getTime() : 0;
    const reportTime = report?.submittedAt ? report.submittedAt.getTime() : 0;

    if (!current || reportTime >= currentTime) {
      latestByStudent.set(report.studentId, report);
    }
  }

  return latestByStudent;
}

function splitReviewTopics(value = '') {
  return String(value || '')
    .split(/[\n;,]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3)
    .slice(0, 12);
}

function buildKnowledgeSummary(classStudents, reports = []) {
  const latestByStudent = getLatestKnowledgeReportsMap(reports);
  const latestReports = [...latestByStudent.values()];
  const averageUnderstanding = latestReports.length
    ? Math.round(
        (latestReports.reduce((sum, report) => sum + Number(report.understandingLevel || 0), 0) /
          latestReports.length) * 10,
      ) / 10
    : 0;
  const supportCount = latestReports.filter((report) =>
    Number(report.understandingLevel || 0) <= 2 || String(report.supportRequest || '').trim(),
  ).length;
  const topicCounts = new Map();

  latestReports.forEach((report) => {
    splitReviewTopics(report.unclearTopics).forEach((topic) => {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    });
  });

  const topUnclearTopics = [...topicCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'vi'))
    .slice(0, 4)
    .map(([topic, count]) => ({ topic, count }));

  return {
    latestByStudent,
    latestReports,
    respondedCount: latestReports.length,
    missingCount: Math.max(0, classStudents.length - latestReports.length),
    averageUnderstanding,
    supportCount,
    topUnclearTopics,
  };
}

function getClassStudents(classInfo, students = []) {
  return students
    .filter((student) => isTrackedStudent(student) && isStudentInClass(student, classInfo))
    .sort((left, right) => left.fullName.localeCompare(right.fullName, 'vi'));
}

function getProgramForClass(classInfo, programs = []) {
  return programs.find((program) => program.id === classInfo?.curriculumProgramId) || null;
}

function getLessonForSession(program, sessionNumber) {
  return (
    getActiveCurriculumLessons(program).find((lesson) => Number(lesson.sessionNumber || 0) === Number(sessionNumber || 0)) ||
    null
  );
}

function getStudentOperationState(student, todayReportsMap) {
  const latestReport = todayReportsMap.get(student.id) || null;
  const staleDays = daysSince(student.lastReportedAt);
  const hasRecentReport = Number.isFinite(staleDays) && staleDays < REPORT_FRESH_DAYS;
  const isStale = Number.isFinite(staleDays) && staleDays >= STALE_REPORT_DAYS;
  const isStalled = Number(student.progressStalledCount || 0) >= 2;
  const isSupport = student.currentStatus === SUPPORT_STATUS;
  const isNearComplete = isNearCompleteStudent(student);
  const isCompleted = isCompletedStudent(student);
  const reasons = [];

  if (!hasRecentReport && !isCompleted) {
    reasons.push('Chưa ghi nhận báo cáo trong 7 ngày');
  }

  if (isSupport) {
    reasons.push('Cần hỗ trợ');
  }

  if (isStale && !isCompleted) {
    reasons.push(`Lâu chưa cập nhật ${staleDays} ngày`);
  }

  if (isStalled && !isCompleted) {
    reasons.push('Tiến độ đứng yên');
  }

  if (isNearComplete) {
    reasons.push('Sắp hoàn thành');
  }

  return {
    latestReport,
    hasRecentReport,
    staleDays,
    isStale,
    isStalled,
    isSupport,
    isNearComplete,
    isCompleted,
    reasons,
  };
}

function filterOperationStudents(students, todayReportsMap, filterId) {
  return students.filter((student) => {
    const status = getStudentOperationState(student, todayReportsMap);

    if (filterId === 'missing-report') {
      return !status.hasRecentReport && !status.isCompleted;
    }

    if (filterId === 'support') {
      return status.isSupport;
    }

    if (filterId === 'near-complete') {
      return status.isNearComplete;
    }

    if (filterId === 'completed') {
      return status.isCompleted;
    }

    return true;
  });
}

function buildClassOperationSnapshot(classInfo, state) {
  if (!classInfo) {
    return null;
  }

  const classStudents = getClassStudents(classInfo, state.students);
  const classTodayReports = state.todayReports.filter((report) =>
    report.classCode === classInfo.classCode || report.classId === classInfo.classCode,
  );
  const todayReportsMap = getLatestReportsMap(classTodayReports);
  const program = getProgramForClass(classInfo, state.programs);
  const currentSession = Number(classInfo.curriculumCurrentSession || 1);
  const currentLesson = getLessonForSession(program, currentSession);
  const sessionActivity = program ? getCurriculumSessionActivity(program, currentSession) : null;
  const activityLabel = getCurriculumActivityTypeLabel(sessionActivity?.activityType);
  const curriculumPhase = getEffectiveCurriculumPhase(classInfo, program);
  const phaseLabel = curriculumPhase === 'final' ? 'Sản phẩm cuối khóa' : 'Học kiến thức';
  const isQuizSession = isCurriculumQuizActivity(sessionActivity?.activityType);
  const quizStarted = isQuizStartedForClass(classInfo, currentSession);
  const hasExerciseContent = Boolean(
    currentLesson && getLessonMarkdownSource(currentLesson, LESSON_MARKDOWN_TAB_EXERCISE),
  );
  const exerciseVisible = hasExerciseContent && isCurriculumExerciseVisibleForSession(classInfo, currentSession);
  const classKnowledgeReports = (state.knowledgeReports || []).filter((report) =>
    report.classCode === classInfo.classCode && Number(report.sessionNumber || 0) === currentSession,
  );
  const knowledgeSummary = buildKnowledgeSummary(classStudents, classKnowledgeReports);
  const completedStudents = classStudents.filter(isCompletedStudent);
  const activeStudents = classStudents.filter((student) => !isCompletedStudent(student));
  const supportStudents = classStudents.filter((student) => getStudentOperationState(student, todayReportsMap).isSupport);
  const recentReportStudents = classStudents.filter((student) => getStudentOperationState(student, todayReportsMap).hasRecentReport);
  const missingReports = classStudents.filter((student) => {
    const status = getStudentOperationState(student, todayReportsMap);
    return !status.hasRecentReport && !status.isCompleted;
  });
  const nearCompleteStudents = classStudents.filter((student) => getStudentOperationState(student, todayReportsMap).isNearComplete);
  const attentionStudents = classStudents
    .map((student) => ({
      student,
      status: getStudentOperationState(student, todayReportsMap),
    }))
    .filter((item) => item.status.reasons.length > 0)
    .sort((left, right) => {
      if (left.status.isSupport !== right.status.isSupport) {
        return left.status.isSupport ? -1 : 1;
      }

      if (left.status.hasRecentReport !== right.status.hasRecentReport) {
        return left.status.hasRecentReport ? 1 : -1;
      }

      return clampProgress(right.student.currentProgressPercent) - clampProgress(left.student.currentProgressPercent);
    });
  const averageProgress = classStudents.length
    ? Math.round(
        classStudents.reduce((sum, student) => sum + clampProgress(student.currentProgressPercent), 0) /
          classStudents.length,
      )
    : 0;

  return {
    classInfo,
    classStudents,
    classTodayReports,
    todayReportsMap,
    program,
    currentSession,
    currentLesson,
    sessionActivity,
    activityLabel,
    curriculumPhase,
    phaseLabel,
    isQuizSession,
    quizStarted,
    exerciseVisible,
    hasExerciseContent,
    classKnowledgeReports,
    knowledgeSummary,
    activeStudents,
    completedStudents,
    recentReportStudents,
    supportStudents,
    missingReports,
    nearCompleteStudents,
    attentionStudents,
    averageProgress,
  };
}

function getDashboardMetrics(state) {
  const operationalClasses = state.classes.filter(isOperationalClass);
  const operationalClassCodes = new Set(operationalClasses.map((classItem) => classItem.classCode));
  const trackedStudents = state.students.filter(
    (student) => isTrackedStudent(student) && operationalClassCodes.has(student.classCode || student.classId),
  );
  const todayReportsMap = getLatestReportsMap(
    state.todayReports.filter((report) => operationalClassCodes.has(report.classCode || report.classId)),
  );
  const completedStudents = trackedStudents.filter(isCompletedStudent);
  const missingReports = trackedStudents.filter((student) => {
    const status = getStudentOperationState(student, todayReportsMap);
    return !status.hasRecentReport && !status.isCompleted;
  });
  const recentReportsCount = trackedStudents.filter((student) => {
    const status = getStudentOperationState(student, todayReportsMap);
    return status.hasRecentReport;
  }).length;
  const supportStudents = trackedStudents.filter((student) => student.currentStatus === SUPPORT_STATUS);

  return {
    operationalClasses,
    todayReportsMap,
    activeClasses: operationalClasses.length,
    trackedStudents: trackedStudents.length,
    recentReports: recentReportsCount,
    missingReports: missingReports.length,
    supportStudents: supportStudents.length,
    completedStudents: completedStudents.length,
  };
}

function buildProductionPublicUrl(path) {
  return new URL(path, PRODUCTION_PUBLIC_ORIGIN).href;
}

function buildCurriculumPath(classCode) {
  const params = new URLSearchParams();
  params.set('workspace', 'assignment');

  if (classCode) {
    params.set('classCode', classCode);
  }

  return `#/admin/curriculum?${params.toString()}`;
}

function renderMetricCard({ label, value, icon, tone = 'primary' }) {
  return `
    <article class="ops-metric ops-metric--${tone}">
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
      <i class="bi bi-${icon}"></i>
    </article>
  `;
}

function renderTodayOverview(metrics) {
  return `
    <section class="ops-overview">
      ${renderMetricCard({ label: 'Lớp chạy', value: metrics.activeClasses, icon: 'collection' })}
      ${renderMetricCard({ label: 'Sĩ số', value: metrics.trackedStudents, icon: 'people', tone: 'info' })}
      ${renderMetricCard({ label: 'Báo cáo', value: metrics.recentReports, icon: 'calendar-check', tone: 'success' })}
      ${renderMetricCard({ label: 'Chưa báo cáo', value: metrics.missingReports, icon: 'hourglass-split', tone: 'warning' })}
      ${renderMetricCard({ label: 'Cần hỗ trợ', value: metrics.supportStudents, icon: 'life-preserver', tone: 'danger' })}
    </section>
  `;
}

function renderClassOperationCard(snapshot, selectedClassCode) {
  const { classInfo } = snapshot;
  const isSelected = classInfo.classCode === selectedClassCode;
  const reportRatio = `${snapshot.recentReportStudents.length}/${snapshot.classStudents.length}`;

  return `
    <article class="ops-class-card ${isSelected ? 'ops-class-card--active' : ''}">
      <button
        type="button"
        class="ops-class-card__select"
        data-action="select-dashboard-class"
        data-class-code="${escapeHtml(classInfo.classCode)}"
      >
        <span>${escapeHtml(classInfo.classCode)}</span>
        <strong>${escapeHtml(snapshot.program?.name || classInfo.className || 'Chưa gán chương trình')}</strong>
      </button>
      <div class="ops-class-card__meta">
        <span><i class="bi bi-calendar2-week"></i>Buổi ${snapshot.currentSession}</span>
        <span><i class="bi bi-people"></i>${snapshot.classStudents.length} học sinh</span>
        <span><i class="bi bi-clipboard-check"></i>${reportRatio} báo cáo</span>
        <span><i class="bi bi-flag"></i>${escapeHtml(snapshot.phaseLabel)}</span>
      </div>
      <div class="ops-class-card__progress">
        <div>
          <span>Tiến độ TB</span>
          <strong>${snapshot.averageProgress}%</strong>
        </div>
        <div class="ops-progress-track">
          <span style="width:${snapshot.averageProgress}%;"></span>
        </div>
      </div>
    </article>
  `;
}

function renderClassSwitcher(snapshots, selectedClassCode) {
  if (snapshots.length === 0) {
    return renderEmptyState({
      icon: 'collection',
      title: 'Chưa có lớp đang hoạt động',
      description: 'Các lớp đã hoàn thành, đang ẩn hoặc lưu trữ sẽ không xuất hiện ở trung tâm vận hành.',
    });
  }

  return `
    <section class="ops-panel ops-class-switcher">
      <div class="ops-panel__head">
        <div>
          <span>Điều phối theo lớp</span>
          <h2>Chọn lớp cần vận hành</h2>
        </div>
        <strong>${snapshots.length} lớp</strong>
      </div>
      <div class="ops-class-grid">
        ${snapshots.map((snapshot) => renderClassOperationCard(snapshot, selectedClassCode)).join('')}
      </div>
    </section>
  `;
}

function renderOperationMiniMetric({ label, value, tone = 'info' }) {
  return `
    <div class="ops-mini-metric ops-mini-metric--${escapeHtml(tone)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function renderCurrentLessonCard(snapshot) {
  const lessonTitle = snapshot.currentLesson?.title || (snapshot.isQuizSession ? `Kiểm tra buổi ${snapshot.currentSession}` : 'Chưa có nội dung buổi này');
  const lessonSummary = snapshot.currentLesson?.summary || snapshot.currentLesson?.description || '';
  const classCode = snapshot.classInfo.classCode;
  const libraryPath = buildPublicLibraryPath(classCode);
  const quizOrExerciseStatus = snapshot.isQuizSession
    ? (snapshot.quizStarted ? 'Đang mở' : 'Chưa mở')
    : (snapshot.exerciseVisible ? 'Bài tập mở' : 'Không mở');

  return `
    <section class="ops-panel ops-current-class ops-command-panel ops-command-panel--${escapeHtml(snapshot.curriculumPhase)}">
      <div class="ops-command-panel__main">
        <div class="ops-command-panel__icon">
          <i class="bi bi-${snapshot.isQuizSession ? 'clipboard-check' : 'journal-richtext'}"></i>
        </div>
        <div class="ops-command-panel__copy">
          <span>Lớp đang chọn</span>
          <h2>${escapeHtml(classCode)} · Buổi ${snapshot.currentSession}</h2>
          <strong>${escapeHtml(snapshot.program?.name || snapshot.classInfo.className || 'Chưa gán chương trình')}</strong>
          <h3>${escapeHtml(lessonTitle)}</h3>
          <p>${escapeHtml(lessonSummary || 'Theo dõi nhanh nội dung lớp đang học, bài tập đang mở và trạng thái kiểm tra trong buổi này.')}</p>
        </div>
      </div>
      <div class="ops-command-panel__metrics">
        ${renderOperationMiniMetric({
          label: 'Đã ghi nhận',
          value: `${snapshot.recentReportStudents.length}/${snapshot.classStudents.length}`,
          tone: 'success',
        })}
        ${renderOperationMiniMetric({
          label: 'Chưa ghi nhận',
          value: snapshot.missingReports.length,
          tone: snapshot.missingReports.length > 0 ? 'warning' : 'success',
        })}
        ${renderOperationMiniMetric({
          label: 'Cần hỗ trợ',
          value: snapshot.supportStudents.length,
          tone: snapshot.supportStudents.length > 0 ? 'danger' : 'success',
        })}
        ${renderOperationMiniMetric({
          label: 'Quiz/Bài tập',
          value: quizOrExerciseStatus,
          tone: snapshot.quizStarted || snapshot.exerciseVisible ? 'info' : 'muted',
        })}
      </div>
      <div class="ops-quick-actions ops-quick-actions--compact">
        <a class="btn btn-outline-primary" href="${escapeHtml(libraryPath)}" target="_blank" rel="noreferrer">
          <i class="bi bi-box-arrow-up-right me-2"></i>Mở bài giảng
        </a>
        <button type="button" class="btn btn-outline-secondary" data-action="copy-report-link" data-class-code="${escapeHtml(classCode)}">
          <i class="bi bi-send me-2"></i>Link báo cáo
        </button>
        <a class="btn btn-outline-secondary" href="${escapeHtml(buildReportsPath(classCode))}">
          <i class="bi bi-clipboard-data me-2"></i>Báo cáo lớp
        </a>
        <a class="btn btn-primary" href="${escapeHtml(buildCurriculumPath(classCode))}">
          <i class="bi bi-journal-text me-2"></i>Bài giảng
        </a>
        <button type="button" class="btn btn-success" data-action="copy-class-summary">
          <i class="bi bi-clipboard-check me-2"></i>Copy tóm tắt
        </button>
      </div>
    </section>
  `;

  return `
    <section class="ops-panel ops-current-class">
      <div class="ops-panel__head">
        <div>
          <span>Lớp đang chọn</span>
          <h2>${escapeHtml(classCode)} · Buổi ${snapshot.currentSession}</h2>
        </div>
        <strong>${escapeHtml(snapshot.activityLabel)}</strong>
      </div>
      <div class="ops-current-class__body">
        <div class="ops-lesson-card">
          <div class="ops-lesson-card__icon">
            <i class="bi bi-${snapshot.isQuizSession ? 'clipboard-check' : 'journal-richtext'}"></i>
          </div>
          <div>
            <span>${escapeHtml(snapshot.program?.name || snapshot.classInfo.className || 'Chưa gán chương trình')}</span>
            <h3>${escapeHtml(lessonTitle)}</h3>
            <p>${escapeHtml(lessonSummary || 'Theo dõi nhanh nội dung lớp đang học, bài tập đang mở và trạng thái kiểm tra trong buổi này.')}</p>
          </div>
        </div>
        <div class="ops-class-status-grid">
          <div>
            <span>Đã ghi nhận</span>
            <strong>${snapshot.recentReportStudents.length}/${snapshot.classStudents.length}</strong>
          </div>
          <div>
            <span>Chưa ghi nhận</span>
            <strong>${snapshot.missingReports.length}</strong>
          </div>
          <div>
            <span>Cần hỗ trợ</span>
            <strong>${snapshot.supportStudents.length}</strong>
          </div>
          <div>
            <span>Quiz/Bài tập</span>
            <strong>${snapshot.isQuizSession ? (snapshot.quizStarted ? 'Đang mở' : 'Chưa mở') : (snapshot.exerciseVisible ? 'Đang mở' : 'Không mở')}</strong>
          </div>
        </div>
      </div>
      <div class="ops-quick-actions">
        <a class="btn btn-outline-primary" href="${escapeHtml(libraryPath)}" target="_blank" rel="noreferrer">
          <i class="bi bi-box-arrow-up-right me-2"></i>Mở bài giảng
        </a>
        <button type="button" class="btn btn-outline-secondary" data-action="copy-report-link" data-class-code="${escapeHtml(classCode)}">
          <i class="bi bi-send me-2"></i>Gửi link báo cáo
        </button>
        <a class="btn btn-outline-secondary" href="${escapeHtml(buildReportsPath(classCode))}">
          <i class="bi bi-clipboard-data me-2"></i>Xem báo cáo lớp
        </a>
        <a class="btn btn-primary" href="${escapeHtml(buildCurriculumPath(classCode))}">
          <i class="bi bi-journal-text me-2"></i>Đi tới Bài giảng
        </a>
        <button type="button" class="btn btn-success" data-action="copy-class-summary">
          <i class="bi bi-clipboard-check me-2"></i>Copy tóm tắt lớp
        </button>
      </div>
    </section>
  `;
}

function renderAttentionList(snapshot) {
  const attentionItems = snapshot.attentionStudents.slice(0, 8);

  if (attentionItems.length === 0) {
    return `
      <div class="ops-attention-inline ops-attention-inline--calm">
        <i class="bi bi-check2-circle"></i>
        <strong>Lớp đang ổn</strong>
        <span>Chưa có học sinh nào cần ưu tiên xử lý ngay.</span>
      </div>
    `;
  }

  return `
    <section class="ops-panel ops-attention-panel ops-attention-panel--compact">
      <div class="ops-panel__head">
        <div>
          <span>Cần chú ý</span>
          <h2>Ưu tiên xử lý trong buổi này</h2>
        </div>
        <strong>${snapshot.attentionStudents.length}</strong>
      </div>
      <div class="ops-attention-strip">
        ${attentionItems
          .map(({ student, status }) => `
            <button
              type="button"
              class="ops-attention-item"
              data-action="open-student-operation-modal"
              data-student-id="${escapeHtml(student.id)}"
            >
              <div>
                <strong>${escapeHtml(student.fullName)}</strong>
                <span>${escapeHtml(student.projectName || 'Chưa có dự án')}</span>
              </div>
              <em>${escapeHtml(status.reasons[0])}</em>
            </button>
          `)
          .join('')}
      </div>
    </section>
  `;

  return `
    <section class="ops-panel ops-attention-panel">
      <div class="ops-panel__head">
        <div>
          <span>Danh sách cần chú ý</span>
          <h2>Việc nên kiểm tra trong buổi này</h2>
        </div>
        <strong>${snapshot.attentionStudents.length}</strong>
      </div>
      ${
        attentionItems.length > 0
          ? `<div class="ops-attention-list">
              ${attentionItems
                .map(({ student, status }) => `
                  <button
                    type="button"
                    class="ops-attention-item"
                    data-action="open-student-operation-modal"
                    data-student-id="${escapeHtml(student.id)}"
                  >
                    <div>
                      <strong>${escapeHtml(student.fullName)}</strong>
                      <span>${escapeHtml(student.projectName || 'Chưa có dự án')}</span>
                    </div>
                    <em>${escapeHtml(status.reasons[0])}</em>
                  </button>
                `)
                .join('')}
            </div>`
          : renderEmptyState({
              icon: 'check2-circle',
              title: 'Lớp đang ổn',
              description: 'Chưa có học sinh nào cần ưu tiên xử lý ngay.',
            })
      }
    </section>
  `;
}

function getDashboardSessionChoices(program, currentSession) {
  if (!program) {
    return [];
  }

  const activeLessons = getActiveCurriculumLessons(program);
  const lessonBySession = new Map(
    activeLessons.map((lesson) => [Number(lesson.sessionNumber || 0), lesson]),
  );
  const totalSessionCount = Math.max(
    Number(program.totalSessionCount || 0),
    Number(currentSession || 0),
    ...activeLessons.map((lesson) => Number(lesson.sessionNumber || 0)),
  );

  return Array.from({ length: totalSessionCount }, (_, index) => {
    const sessionNumber = index + 1;
    const lesson = lessonBySession.get(sessionNumber) || null;
    const activity = getCurriculumSessionActivity(program, sessionNumber);
    const activityLabel = getCurriculumActivityTypeLabel(activity?.activityType);
    const title = lesson?.title || activityLabel || `Buổi ${sessionNumber}`;

    return {
      sessionNumber,
      title,
      activityLabel,
    };
  });
}

function renderDashboardSessionControl(snapshot) {
  if (!snapshot.program?.id) {
    return `
      <div class="ops-session-control ops-session-control--empty">
        <span>Chưa gán chương trình học</span>
        <small>Vào Bài giảng để gán chương trình trước khi set buổi.</small>
      </div>
    `;
  }

  const sessionChoices = getDashboardSessionChoices(snapshot.program, snapshot.currentSession);

  return `
    <div class="ops-session-control">
      <label>
        <span>Buổi học</span>
        <select class="form-select" data-dashboard-session-select>
          ${sessionChoices.map((session) => `
            <option value="${session.sessionNumber}" ${session.sessionNumber === snapshot.currentSession ? 'selected' : ''}>
              Buổi ${session.sessionNumber} - ${escapeHtml(session.title)}
            </option>
          `).join('')}
        </select>
      </label>
      <label class="ops-session-control__phase">
        <span>Giai đoạn</span>
        <select class="form-select" data-dashboard-phase-select>
          <option value="learning" ${snapshot.curriculumPhase === 'learning' ? 'selected' : ''}>Học kiến thức</option>
          <option value="final" ${snapshot.curriculumPhase === 'final' ? 'selected' : ''}>Sản phẩm cuối khóa</option>
        </select>
      </label>
      <button type="button" class="btn btn-outline-primary" data-action="save-dashboard-session">
        <i class="bi bi-check2-circle me-2"></i>Lưu buổi
      </button>
    </div>
  `;
}

function renderDashboardQuizControl(snapshot) {
  if (!snapshot.isQuizSession) {
    return '';
  }

  return `
    <button
      type="button"
      class="btn ${snapshot.quizStarted ? 'btn-outline-danger' : 'btn-warning'}"
      data-action="toggle-dashboard-quiz"
      data-quiz-started="${snapshot.quizStarted ? 'true' : 'false'}"
    >
      <i class="bi bi-${snapshot.quizStarted ? 'stop-circle' : 'play-circle'} me-2"></i>
      ${snapshot.quizStarted ? 'Kết thúc bài kiểm tra' : 'Mở bài kiểm tra'}
    </button>
  `;
}

function renderDashboardExerciseControl(snapshot) {
  if (snapshot.isQuizSession || !snapshot.hasExerciseContent) {
    return '';
  }

  return `
    <button
      type="button"
      class="btn ${snapshot.exerciseVisible ? 'btn-outline-danger' : 'btn-success'}"
      data-action="toggle-dashboard-exercise"
      data-exercise-visible="${snapshot.exerciseVisible ? 'true' : 'false'}"
    >
      <i class="bi bi-${snapshot.exerciseVisible ? 'eye-slash' : 'journal-check'} me-2"></i>
      ${snapshot.exerciseVisible ? 'Ẩn bài tập' : 'Mở bài tập'}
    </button>
  `;
}

function renderDashboardClassOperationPanel(snapshot) {
  const lessonTitle = snapshot.currentLesson?.title || (snapshot.isQuizSession ? `Kiểm tra buổi ${snapshot.currentSession}` : 'Chưa có nội dung buổi này');
  const classCode = snapshot.classInfo.classCode;
  const libraryPath = buildPublicLibraryPath(
    classCode,
    snapshot.currentLesson?.id ? { lessonId: snapshot.currentLesson.id } : {},
  );

  return `
    <section class="ops-panel ops-current-class ops-command-panel">
      <div class="ops-command-panel__main">
        <div class="ops-command-panel__icon">
          <i class="bi bi-${snapshot.isQuizSession ? 'clipboard-check' : 'journal-richtext'}"></i>
        </div>
        <div class="ops-command-panel__copy">
          <span>Lớp đang chọn</span>
          <h2>${escapeHtml(classCode)} · Buổi ${snapshot.currentSession}</h2>
          <strong>${escapeHtml(snapshot.program?.name || snapshot.classInfo.className || 'Chưa gán chương trình')}</strong>
          <h3>${escapeHtml(lessonTitle)}</h3>
          <div class="ops-command-panel__phase">
            <i class="bi bi-flag"></i>
            <span>${escapeHtml(snapshot.phaseLabel)}</span>
          </div>
        </div>
      </div>
      <div class="ops-class-tools">
        ${renderDashboardSessionControl(snapshot)}
      </div>
      <div class="ops-quick-actions ops-quick-actions--compact">
        <a class="btn btn-outline-primary" href="${escapeHtml(libraryPath)}" target="_blank" rel="noreferrer">
          <i class="bi bi-box-arrow-up-right me-2"></i>Mở bài giảng
        </a>
        <button type="button" class="btn btn-outline-secondary" data-action="copy-report-link" data-class-code="${escapeHtml(classCode)}">
          <i class="bi bi-send me-2"></i>Link báo cáo
        </button>
        <a class="btn btn-primary" href="${escapeHtml(buildCurriculumPath(classCode))}">
          <i class="bi bi-journal-text me-2"></i>Bài giảng
        </a>
        ${renderDashboardExerciseControl(snapshot)}
        ${renderDashboardQuizControl(snapshot)}
      </div>
    </section>
  `;
}

function getKnowledgeReportForStudent(snapshot, student) {
  return snapshot.knowledgeSummary.latestByStudent.get(student.id) || null;
}

function getUnderstandingTone(level) {
  if (level >= 4) {
    return 'success';
  }

  if (level >= 3) {
    return 'warning';
  }

  if (level > 0) {
    return 'danger';
  }

  return 'muted';
}

function renderKnowledgeStudentCard(student, report) {
  const hasReport = Boolean(report);
  const level = Number(report?.understandingLevel || 0);
  const tone = getUnderstandingTone(level);

  return `
    <article
      class="ops-knowledge-student-card ${hasReport ? 'ops-knowledge-student-card--done' : 'ops-knowledge-student-card--missing'}"
      role="button"
      tabindex="0"
      data-action="open-knowledge-report-modal"
      data-student-id="${escapeHtml(student.id)}"
    >
      <div class="ops-knowledge-student-card__top">
        <div>
          <h3>${escapeHtml(student.fullName || 'Học sinh')}</h3>
          <span>${hasReport ? escapeHtml(formatDateTime(report.submittedAt)) : 'Chưa gửi phản hồi'}</span>
        </div>
        <strong class="ops-understanding-badge ops-understanding-badge--${tone}">
          ${hasReport ? `${level}/5` : 'Chưa có'}
        </strong>
      </div>
      <div class="ops-knowledge-student-card__meta">
        <span>${hasReport ? 'Đã phản hồi' : 'Chưa phản hồi'}</span>
        ${hasReport && String(report.supportRequest || '').trim() ? '<span>Cần hỗ trợ</span>' : ''}
      </div>
    </article>
  `;
}

function renderKnowledgeReportModal(student, report) {
  const hasReport = Boolean(report);
  const level = Number(report?.understandingLevel || 0);
  const tone = getUnderstandingTone(level);

  return `
    <div class="modal fade" id="dashboard-knowledge-modal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content border-0 shadow admin-modal ops-knowledge-modal">
          <div class="modal-header">
            <div>
              <h2 class="modal-title fs-5">${escapeHtml(student?.fullName || 'Học sinh')}</h2>
              <p class="text-secondary mb-0 small">
                ${hasReport ? escapeHtml(formatDateTime(report.submittedAt)) : 'Chưa gửi phản hồi buổi học'}
              </p>
            </div>
            <strong class="ops-understanding-badge ops-understanding-badge--${tone}">
              ${hasReport ? `${level}/5` : 'Chưa có'}
            </strong>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button>
          </div>
          <div class="modal-body">
            ${
              hasReport
                ? `
                  <div class="ops-knowledge-modal-grid">
                    <section>
                      <span>Kiến thức đã hiểu</span>
                      <p>${nl2br(report.understoodTopics || 'Chưa ghi nội dung')}</p>
                    </section>
                    <section>
                      <span>Kiến thức chưa rõ</span>
                      <p>${nl2br(report.unclearTopics || 'Chưa ghi nội dung')}</p>
                    </section>
                    <section class="${String(report.supportRequest || '').trim() ? 'ops-knowledge-support--hot' : ''}">
                      <span>Cần hỗ trợ</span>
                      <p>${nl2br(report.supportRequest || 'Không cần hỗ trợ thêm')}</p>
                    </section>
                  </div>
                `
                : renderEmptyState({
                    icon: 'chat-square-text',
                    title: 'Chưa có phản hồi',
                    description: 'Học sinh này chưa gửi phản hồi hiểu bài cho buổi hiện tại.',
                  })
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderKnowledgeResponseList(snapshot) {
  if (snapshot.curriculumPhase !== 'learning' || snapshot.isQuizSession) {
    return '';
  }

  const respondedCount = snapshot.knowledgeSummary.respondedCount;
  const totalCount = snapshot.classStudents.length;
  const averageUnderstanding = snapshot.knowledgeSummary.averageUnderstanding;
  const averageLabel = averageUnderstanding > 0 ? `${averageUnderstanding}/5` : 'Chưa có';

  return `
    <section class="ops-panel ops-knowledge-response-panel">
      <div class="ops-panel__head">
        <div>
          <span>Theo dõi phản hồi</span>
          <h2 class="ops-knowledge-title">
            ${escapeHtml(snapshot.classInfo.classCode)}
            <em>Hiểu bài TB: ${escapeHtml(averageLabel)}</em>
          </h2>
        </div>
        <strong>${respondedCount}/${totalCount}</strong>
      </div>
      ${
        totalCount > 0
          ? `<div class="ops-knowledge-student-grid">
              ${snapshot.classStudents
                .map((student) => renderKnowledgeStudentCard(student, getKnowledgeReportForStudent(snapshot, student)))
                .join('')}
            </div>`
          : renderEmptyState({
              icon: 'people',
              title: 'Chưa có học sinh trong lớp',
              description: '',
            })
      }
    </section>
  `;
}

function renderStudentFilterTabs(activeFilter, snapshot) {
  const countByFilter = {
    all: snapshot.classStudents.length,
    'missing-report': snapshot.missingReports.length,
    support: snapshot.supportStudents.length,
    'near-complete': snapshot.nearCompleteStudents.length,
    completed: snapshot.completedStudents.length,
  };

  return `
    <div class="ops-filter-tabs" role="tablist" aria-label="Lọc học sinh">
      ${STUDENT_FILTERS.map((filter) => `
        <button
          type="button"
          class="ops-filter-tab ${activeFilter === filter.id ? 'ops-filter-tab--active' : ''}"
          data-action="set-dashboard-student-filter"
          data-filter-id="${escapeHtml(filter.id)}"
        >
          ${escapeHtml(filter.label)}
          <span>${countByFilter[filter.id] || 0}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function renderStudentOperationCard(student, status) {
  const progress = clampProgress(student.currentProgressPercent);
  const visibleReasons = status.reasons.slice(0, 2);
  const hiddenReasonCount = Math.max(0, status.reasons.length - visibleReasons.length);

  return `
    <article
      class="ops-student-card"
      role="button"
      tabindex="0"
      data-action="open-student-operation-modal"
      data-student-id="${escapeHtml(student.id)}"
    >
      <div class="ops-student-card__main">
        <div>
          <h3>${escapeHtml(student.fullName || 'Học sinh')}</h3>
          <p>${escapeHtml(student.projectName || 'Chưa có dự án')}</p>
        </div>
        <span class="ops-report-pill ${status.hasRecentReport ? 'ops-report-pill--done' : 'ops-report-pill--missing'}">
          ${status.hasRecentReport ? 'Đã ghi nhận' : 'Chưa ghi nhận'}
        </span>
      </div>
      <div class="ops-student-card__progress">
        <strong>${progress}%</strong>
        <div class="ops-progress-track">
          <span style="width:${progress}%;"></span>
        </div>
      </div>
      <div class="ops-student-card__meta">
        ${renderStatusBadge(student.currentStatus)}
        ${renderStageBadge(student.currentStage)}
        <span><i class="bi bi-clock me-1"></i>${escapeHtml(formatDateTime(student.lastReportedAt))}</span>
      </div>
      ${
        status.reasons.length > 0
          ? `<div class="ops-student-card__reasons">
              ${visibleReasons.map((reason) => `<span>${escapeHtml(reason)}</span>`).join('')}
              ${hiddenReasonCount > 0 ? `<span>+${hiddenReasonCount}</span>` : ''}
            </div>`
          : ''
      }
    </article>
  `;
}

function renderStudentOperationList(snapshot, activeFilter) {
  const students = filterOperationStudents(snapshot.classStudents, snapshot.todayReportsMap, activeFilter);

  return `
    <section class="ops-panel ops-student-panel">
      <div class="ops-panel__head">
        <div>
          <span>Theo dõi báo cáo sản phẩm</span>
          <h2>${escapeHtml(snapshot.classInfo.classCode)}</h2>
        </div>
        <strong>${students.length}/${snapshot.classStudents.length}</strong>
      </div>
      ${renderStudentFilterTabs(activeFilter, snapshot)}
      ${
        students.length > 0
          ? `<div class="ops-student-grid">
              ${students
                .map((student) => renderStudentOperationCard(student, getStudentOperationState(student, snapshot.todayReportsMap)))
                .join('')}
            </div>`
          : renderEmptyState({
              icon: 'person-check',
              title: 'Không có học sinh trong nhóm này',
              description: '',
            })
      }
    </section>
  `;
}

function buildClassSummaryText(snapshot) {
  const attentionLines = snapshot.attentionStudents.slice(0, 12).map(({ student, status }, index) => {
    return `${index + 1}. ${student.fullName} - ${student.projectName || 'Chưa có dự án'} - ${clampProgress(student.currentProgressPercent)}% - ${status.reasons.join(', ')}`;
  });

  return [
    `TÓM TẮT LỚP ${snapshot.classInfo.classCode} - ${snapshot.classInfo.className || snapshot.program?.name || ''}`.trim(),
    `Buổi hiện tại: ${snapshot.currentSession} (${snapshot.activityLabel})`,
    `Chương trình: ${snapshot.program?.name || 'Chưa gán chương trình'}`,
    `Sĩ số theo dõi: ${snapshot.classStudents.length}`,
    `Đã ghi nhận trong 7 ngày: ${snapshot.recentReportStudents.length}`,
    `Chưa ghi nhận: ${snapshot.missingReports.length}`,
    `Cần hỗ trợ: ${snapshot.supportStudents.length}`,
    `Sắp hoàn thành: ${snapshot.nearCompleteStudents.length}`,
    `Tiến độ trung bình: ${snapshot.averageProgress}%`,
    '',
    'Điểm cần chú ý:',
    attentionLines.length > 0 ? attentionLines.join('\n') : 'Lớp đang ổn, chưa có điểm cần xử lý ngay.',
  ].join('\n');
}

function renderReportHistoryContent(student, history) {
  if (!history || history.length === 0) {
    return renderEmptyState({
      icon: 'file-earmark-text',
      title: 'Chưa có báo cáo',
      description: 'Học sinh này chưa có lịch sử báo cáo.',
    });
  }

  return `
    <div class="ops-report-history">
      ${history.slice(0, 5).map((report, index) => `
        <article class="ops-report-history__item ${index === 0 ? 'ops-report-history__item--latest' : ''}">
          <div class="ops-report-history__top">
            <div>
              <strong>${index === 0 ? 'Báo cáo mới nhất' : `Lần ${index + 1}`}</strong>
              <span>${escapeHtml(formatDateTime(report.submittedAt))}</span>
            </div>
            <div class="d-flex flex-wrap gap-2 justify-content-end">
              ${renderStatusBadge(report.status)}
              ${renderStageBadge(report.stage)}
              <span class="badge bg-white text-dark border">${Number(report.progressPercent || 0)}%</span>
            </div>
          </div>
          <div class="ops-report-history__grid">
            <div>
              <span>Đã làm</span>
              <p>${nl2br(report.doneToday || 'Chưa có nội dung')}</p>
            </div>
            <div>
              <span>Mục tiêu</span>
              <p>${nl2br(report.nextGoal || 'Chưa có nội dung')}</p>
            </div>
            <div>
              <span>Khó khăn</span>
              <p>${nl2br(report.difficulties || 'Không có')}</p>
            </div>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderStudentOperationModal(student, history, status) {
  return `
    <div class="modal fade" id="dashboard-student-modal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content border-0 shadow admin-modal ops-student-modal">
          <div class="modal-header">
            <div>
              <h2 class="modal-title fs-5">${escapeHtml(student.fullName || 'Học sinh')}</h2>
              <p class="text-secondary mb-0 small">${escapeHtml(student.projectName || 'Chưa có dự án')} · ${clampProgress(student.currentProgressPercent)}%</p>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button>
          </div>
          <div class="modal-body">
            <div class="ops-modal-summary">
              <div>
                <span>Trạng thái hôm nay</span>
                <strong>${status.hasRecentReport ? 'Đã ghi nhận' : 'Chưa ghi nhận'}</strong>
              </div>
              <div>
                <span>Cập nhật gần nhất</span>
                <strong>${escapeHtml(formatDateTime(student.lastReportedAt))}</strong>
              </div>
              <div>
                <span>Điểm cần chú ý</span>
                <strong>${status.reasons.length || 0}</strong>
              </div>
            </div>
            ${
              status.reasons.length > 0
                ? `<div class="ops-modal-reasons">${status.reasons.map((reason) => `<span>${escapeHtml(reason)}</span>`).join('')}</div>`
                : ''
            }
            ${renderReportHistoryContent(student, history)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderDashboard(state) {
  const metrics = getDashboardMetrics(state);
  const snapshots = metrics.operationalClasses.map((classInfo) => buildClassOperationSnapshot(classInfo, state));
  const selectedSnapshot =
    snapshots.find((snapshot) => snapshot.classInfo.classCode === state.selectedClassCode) ||
    snapshots[0] ||
    null;

  if (!selectedSnapshot && (state.loading.classes || state.loading.students || state.loading.reports || state.loading.programs)) {
    return renderLoadingOverlay('Đang tải trung tâm vận hành...');
  }

  return `
    ${renderTodayOverview(metrics)}
    ${renderClassSwitcher(snapshots, selectedSnapshot?.classInfo.classCode || '')}
    ${
      selectedSnapshot
        ? `
          <div class="ops-main-stack">
            ${renderDashboardClassOperationPanel(selectedSnapshot)}
            ${
              selectedSnapshot.curriculumPhase === 'final'
                ? renderStudentOperationList(selectedSnapshot, state.studentFilter)
                : renderKnowledgeResponseList(selectedSnapshot)
            }
          </div>
        `
        : ''
    }
  `;
}

export const adminDashboardPage = {
  title: 'Tổng quan',
  async render() {
    const authState = getAuthState();

    return renderAppShell({
      title: 'Tổng quan',
      subtitle: '',
      currentRoute: '/admin/dashboard',
      user: authState.user,
      content: `
        <section class="admin-page admin-page--dashboard">
          <div id="dashboard-content-slot">${renderLoadingOverlay('Đang tải trung tâm vận hành...')}</div>
          <div id="dashboard-modal-slot"></div>
        </section>
      `,
    });
  },
  async mount() {
    const contentSlot = document.getElementById('dashboard-content-slot');
    const modalSlot = document.getElementById('dashboard-modal-slot');
    const state = {
      classes: [],
      students: [],
      todayReports: [],
      knowledgeReports: [],
      programs: [],
      selectedClassCode: '',
      studentFilter: 'all',
      loading: {
        classes: true,
        students: true,
        reports: true,
        knowledgeReports: true,
        programs: true,
      },
    };

    function syncSelectedClass() {
      const operationalClasses = state.classes.filter(isOperationalClass);

      if (operationalClasses.length === 0) {
        state.selectedClassCode = '';
        return;
      }

      if (!operationalClasses.some((classInfo) => classInfo.classCode === state.selectedClassCode)) {
        state.selectedClassCode = operationalClasses[0].classCode;
      }
    }

    function getSelectedSnapshot() {
      syncSelectedClass();
      const selectedClass = state.classes.find((classInfo) => classInfo.classCode === state.selectedClassCode) || null;
      return selectedClass ? buildClassOperationSnapshot(selectedClass, state) : null;
    }

    function renderView() {
      syncSelectedClass();
      contentSlot.innerHTML = renderDashboard(state);
    }

    async function copyValue(value, successMessage, errorTitle) {
      try {
        await copyTextToClipboard(value);
        showToast({
          title: 'Đã sao chép',
          message: successMessage,
          variant: 'success',
        });
      } catch (error) {
        showToast({
          title: errorTitle,
          message: mapFirebaseError(error, 'Không thể sao chép nội dung lúc này.'),
          variant: 'danger',
        });
      }
    }

    async function openStudentModal(studentId) {
      const snapshot = getSelectedSnapshot();
      const student = snapshot?.classStudents.find((item) => item.id === studentId) || null;

      if (!student || !snapshot) {
        return;
      }

      modalSlot.innerHTML = renderLoadingOverlay('Đang tải lịch sử báo cáo...');

      try {
        const history = await getStudentReportHistory(student.id, 8);
        const status = getStudentOperationState(student, snapshot.todayReportsMap);

        modalSlot.innerHTML = renderStudentOperationModal(student, history, status);
        const modalEl = document.getElementById('dashboard-student-modal');
        const modal = new window.bootstrap.Modal(modalEl);
        modal.show();
        modalEl.addEventListener('hidden.bs.modal', () => {
          modal.dispose();
          modalSlot.innerHTML = '';
        }, { once: true });
      } catch (error) {
        modalSlot.innerHTML = '';
        showToast({
          title: 'Không tải được báo cáo',
          message: mapFirebaseError(error, 'Không thể tải lịch sử báo cáo của học sinh này.'),
          variant: 'danger',
        });
      }
    }

    function openKnowledgeReportModal(studentId) {
      const snapshot = getSelectedSnapshot();
      const student = snapshot?.classStudents.find((item) => item.id === studentId) || null;

      if (!student || !snapshot) {
        return;
      }

      const report = getKnowledgeReportForStudent(snapshot, student);
      modalSlot.innerHTML = renderKnowledgeReportModal(student, report);
      const modalEl = document.getElementById('dashboard-knowledge-modal');
      const modal = new window.bootstrap.Modal(modalEl);
      modal.show();
      modalEl.addEventListener('hidden.bs.modal', () => {
        modal.dispose();
        modalSlot.innerHTML = '';
      }, { once: true });
    }

    const unsubscribers = [
      subscribeClasses(
        (classes) => {
          state.classes = classes;
          state.loading.classes = false;
          renderView();
        },
        (error) => {
          state.loading.classes = false;
          showToast({
            title: 'Lỗi dữ liệu',
            message: mapFirebaseError(error, 'Không tải được danh sách lớp.'),
            variant: 'danger',
          });
          renderView();
        },
      ),
      subscribeStudents(
        (students) => {
          state.students = students;
          state.loading.students = false;
          renderView();
        },
        (error) => {
          state.loading.students = false;
          showToast({
            title: 'Lỗi dữ liệu',
            message: mapFirebaseError(error, 'Không tải được danh sách học sinh.'),
            variant: 'danger',
          });
          renderView();
        },
      ),
      subscribeTodayReports(
        (reports) => {
          state.todayReports = reports;
          state.loading.reports = false;
          renderView();
        },
        (error) => {
          state.loading.reports = false;
          showToast({
            title: 'Lỗi dữ liệu',
            message: mapFirebaseError(error, 'Không tải được dữ liệu báo cáo.'),
            variant: 'danger',
          });
          renderView();
        },
      ),
      subscribeKnowledgeReports(
        (reports) => {
          state.knowledgeReports = reports;
          state.loading.knowledgeReports = false;
          renderView();
        },
        (error) => {
          state.loading.knowledgeReports = false;
          showToast({
            title: 'Lỗi dữ liệu',
            message: mapFirebaseError(error, 'Không tải được phản hồi buổi học.'),
            variant: 'danger',
          });
          renderView();
        },
      ),
      subscribeCurriculumPrograms(
        (programs) => {
          state.programs = programs;
          state.loading.programs = false;
          renderView();
        },
        (error) => {
          state.loading.programs = false;
          showToast({
            title: 'Lỗi dữ liệu',
            message: mapFirebaseError(error, 'Không tải được chương trình học.'),
            variant: 'danger',
          });
          renderView();
        },
      ),
    ];

    renderView();

    contentSlot.addEventListener('click', async (event) => {
      const classButton = event.target.closest('[data-action="select-dashboard-class"]');

      if (classButton) {
        state.selectedClassCode = classButton.dataset.classCode || '';
        state.studentFilter = 'all';
        renderView();
        return;
      }

      const filterButton = event.target.closest('[data-action="set-dashboard-student-filter"]');

      if (filterButton) {
        state.studentFilter = filterButton.dataset.filterId || 'all';
        renderView();
        return;
      }

      const studentCard = event.target.closest('[data-action="open-student-operation-modal"]');

      if (studentCard) {
        await openStudentModal(studentCard.dataset.studentId || '');
        return;
      }

      const knowledgeCard = event.target.closest('[data-action="open-knowledge-report-modal"]');

      if (knowledgeCard) {
        openKnowledgeReportModal(knowledgeCard.dataset.studentId || '');
        return;
      }

      const reportLinkButton = event.target.closest('[data-action="copy-report-link"]');

      if (reportLinkButton) {
        const classCode = reportLinkButton.dataset.classCode || '';
        await copyValue(
          buildProductionPublicUrl(buildPublicReportPath(classCode)),
          `Link báo cáo lớp ${classCode} đã sẵn sàng để gửi cho học sinh.`,
          'Không thể copy link báo cáo',
        );
        return;
      }

      const saveSessionButton = event.target.closest('[data-action="save-dashboard-session"]');

      if (saveSessionButton) {
        const snapshot = getSelectedSnapshot();
        const sessionSelect = contentSlot.querySelector('[data-dashboard-session-select]');
        const phaseSelect = contentSlot.querySelector('[data-dashboard-phase-select]');
        const nextSession = Number(sessionSelect?.value || snapshot?.currentSession || 0);
        const nextPhase = phaseSelect?.value === 'final' ? 'final' : 'learning';

        if (!snapshot?.program?.id || !nextSession) {
          showToast({
            title: 'Chưa đủ dữ liệu',
            message: 'Lớp này cần được gán chương trình học trước khi lưu buổi.',
            variant: 'warning',
          });
          return;
        }

        saveSessionButton.disabled = true;

        try {
          await saveClassCurriculumAssignment(snapshot.classInfo.classCode, {
            curriculumProgramId: snapshot.program.id,
            curriculumCurrentSession: nextSession,
            curriculumPhase: nextPhase,
            curriculumExerciseVisibleSessions: snapshot.classInfo.curriculumExerciseVisibleSessions || [],
          });
          showToast({
            title: 'Đã lưu buổi học',
            message: `${snapshot.classInfo.classCode} đang ở buổi ${nextSession}.`,
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể lưu buổi',
            message: mapFirebaseError(error, 'Không thể cập nhật buổi học lúc này.'),
            variant: 'danger',
          });
        } finally {
          saveSessionButton.disabled = false;
        }
        return;
      }

      const quizButton = event.target.closest('[data-action="toggle-dashboard-quiz"]');

      if (quizButton) {
        const snapshot = getSelectedSnapshot();

        if (!snapshot) {
          return;
        }

        const shouldStart = quizButton.dataset.quizStarted !== 'true';
        quizButton.disabled = true;

        try {
          const result = await setClassQuizStatus(snapshot.classInfo.classCode, {
            sessionNumber: snapshot.currentSession,
            isStarted: shouldStart,
          });
          showToast({
            title: shouldStart ? 'Đã mở bài kiểm tra' : 'Đã kết thúc bài kiểm tra',
            message: shouldStart
              ? `Học sinh lớp ${snapshot.classInfo.classCode} có thể vào bài giảng để làm bài.`
              : `Đã ghi nhận ${result?.finalizedCount || 0} bài đang làm dở.`,
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: shouldStart ? 'Không thể mở bài kiểm tra' : 'Không thể kết thúc bài kiểm tra',
            message: mapFirebaseError(error, 'Thao tác bài kiểm tra chưa hoàn tất.'),
            variant: 'danger',
          });
        } finally {
          quizButton.disabled = false;
        }
        return;
      }

      const exerciseButton = event.target.closest('[data-action="toggle-dashboard-exercise"]');

      if (exerciseButton) {
        const snapshot = getSelectedSnapshot();

        if (!snapshot?.program?.id) {
          return;
        }

        const nextVisible = exerciseButton.dataset.exerciseVisible !== 'true';
        const nextVisibleSessions = setCurriculumExerciseVisibleForSession(
          { exerciseVisibleSessions: snapshot.classInfo.curriculumExerciseVisibleSessions || [] },
          snapshot.currentSession,
          nextVisible,
          snapshot.program,
        );
        exerciseButton.disabled = true;

        try {
          await saveClassCurriculumAssignment(snapshot.classInfo.classCode, {
            curriculumProgramId: snapshot.program.id,
            curriculumCurrentSession: snapshot.currentSession,
            curriculumPhase: snapshot.curriculumPhase,
            curriculumExerciseVisibleSessions: nextVisibleSessions,
          });
          showToast({
            title: nextVisible ? 'Đã mở bài tập' : 'Đã ẩn bài tập',
            message: nextVisible
              ? `Học sinh lớp ${snapshot.classInfo.classCode} có thể xem bài tập buổi ${snapshot.currentSession}.`
              : `Bài tập buổi ${snapshot.currentSession} đã được ẩn khỏi học sinh.`,
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể cập nhật bài tập',
            message: mapFirebaseError(error, 'Thao tác bài tập chưa hoàn tất.'),
            variant: 'danger',
          });
        } finally {
          exerciseButton.disabled = false;
        }
      }
    });

    contentSlot.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      const studentCard = event.target.closest('[data-action="open-student-operation-modal"]');
      const knowledgeCard = event.target.closest('[data-action="open-knowledge-report-modal"]');

      if (!studentCard && !knowledgeCard) {
        return;
      }

      event.preventDefault();

      if (studentCard) {
        await openStudentModal(studentCard.dataset.studentId || '');
        return;
      }

      openKnowledgeReportModal(knowledgeCard.dataset.studentId || '');
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  },
};
