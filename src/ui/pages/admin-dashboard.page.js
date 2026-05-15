import { STAGES } from '../../constants/stages.js';
import { STATUSES } from '../../constants/statuses.js';
import { subscribeClasses } from '../../services/classes.service.js';
import { subscribeTodayReports } from '../../services/reports.service.js';
import { subscribeStudents } from '../../services/students.service.js';
import { getAuthState } from '../../state/auth.store.js';
import { formatDateTime } from '../../utils/date.js';
import { mapFirebaseError } from '../../utils/firebase-error.js';
import { escapeHtml } from '../../utils/html.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { showToast } from '../components/ToastStack.js';

const COMPLETED_STATUS = 'Hoàn thành';
const SUPPORT_STATUS = 'Cần hỗ trợ';

const STATUS_COLORS = {
  'Chưa bắt đầu': '#94a3b8',
  'Đang làm': '#2563eb',
  'Cần hỗ trợ': '#ef4444',
  'Gần hoàn thành': '#f59e0b',
  'Hoàn thành': '#16a34a',
};

const STAGE_COLORS = ['#c026d3', '#0ea5e9', '#ef4444', '#f97316', '#22c55e'];

const PROGRESS_BUCKETS = [
  { label: '0-24%', min: 0, max: 24, color: '#94a3b8' },
  { label: '25-49%', min: 25, max: 49, color: '#0ea5e9' },
  { label: '50-74%', min: 50, max: 74, color: '#f59e0b' },
  { label: '75-99%', min: 75, max: 99, color: '#f97316' },
  { label: '100%', min: 100, max: 100, color: '#16a34a' },
];

function clampProgress(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

function isTrackedStudent(student) {
  return student?.active !== false;
}

function isCompletedStudent(student) {
  return student?.currentStatus === COMPLETED_STATUS || clampProgress(student?.currentProgressPercent) >= 100;
}

function toPercent(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function sortByProgress(students = []) {
  return [...students].sort((left, right) => {
    const progressDiff = clampProgress(right.currentProgressPercent) - clampProgress(left.currentProgressPercent);

    if (progressDiff !== 0) {
      return progressDiff;
    }

    const leftTime = left.lastReportedAt ? left.lastReportedAt.getTime() : 0;
    const rightTime = right.lastReportedAt ? right.lastReportedAt.getTime() : 0;
    return rightTime - leftTime;
  });
}

function getStatusEntries(students) {
  return STATUSES.map((label) => ({
    label,
    value: students.filter((student) => student.currentStatus === label).length,
    color: STATUS_COLORS[label] || '#94a3b8',
  }));
}

function getStageEntries(students) {
  return STAGES.map((label, index) => ({
    label,
    value: students.filter((student) => student.currentStage === label).length,
    color: STAGE_COLORS[index % STAGE_COLORS.length],
  }));
}

function getProgressEntries(students) {
  return PROGRESS_BUCKETS.map((bucket) => ({
    ...bucket,
    value: students.filter((student) => {
      const progress = clampProgress(student.currentProgressPercent);
      return progress >= bucket.min && progress <= bucket.max;
    }).length,
  }));
}

function getClassProgressEntries(classes, students) {
  return classes
    .map((classInfo) => {
      const classStudents = students.filter((student) => {
        return student.classId === classInfo.id || student.classCode === classInfo.classCode;
      });
      const averageProgress = classStudents.length
        ? Math.round(
            classStudents.reduce((sum, student) => sum + clampProgress(student.currentProgressPercent), 0) /
              classStudents.length,
          )
        : 0;

      return {
        label: classInfo.classCode || classInfo.className || 'Lớp',
        total: classStudents.length,
        percent: averageProgress,
      };
    })
    .filter((entry) => entry.total > 0)
    .sort((left, right) => right.percent - left.percent || right.total - left.total)
    .slice(0, 8);
}

function renderKpiCard({ label, value, icon, tone = 'primary' }) {
  return `
    <article class="dashboard-kpi-card dashboard-kpi-card--${tone}">
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
      <i class="bi bi-${icon}"></i>
    </article>
  `;
}

function renderCompletionChart(metrics) {
  const doneRate = metrics.completionRate;
  const activeRate = metrics.totalStudents ? Math.max(0, 100 - doneRate) : 0;

  return `
    <section class="dashboard-chart-card dashboard-chart-card--ring">
      <div class="dashboard-card-head">
        <h2>Tổng hợp</h2>
        <span>${metrics.totalStudents} học sinh</span>
      </div>
      <div
        class="dashboard-ring"
        style="background: conic-gradient(#16a34a 0 ${doneRate}%, #2563eb ${doneRate}% 100%);"
      >
        <div class="dashboard-ring__center">
          <strong>${doneRate}%</strong>
          <span>hoàn thành</span>
        </div>
      </div>
      <div class="dashboard-legend">
        <span><i style="background:#16a34a"></i>${metrics.completedStudents} hoàn thành</span>
        <span><i style="background:#2563eb"></i>${metrics.activeStudents} đang làm</span>
        <span><i style="background:#e6edf5"></i>${activeRate}% còn lại</span>
      </div>
    </section>
  `;
}

function renderBarChart(title, entries, total) {
  const maxValue = Math.max(...entries.map((entry) => entry.value), 1);

  return `
    <section class="dashboard-chart-card">
      <div class="dashboard-card-head">
        <h2>${escapeHtml(title)}</h2>
        <span>${escapeHtml(total)}</span>
      </div>
      <div class="dashboard-bar-list">
        ${entries
          .map((entry) => {
            const width = entry.value === 0 ? 0 : Math.max((entry.value / maxValue) * 100, 8);

            return `
              <div class="dashboard-bar-row">
                <div class="dashboard-bar-row__meta">
                  <span>${escapeHtml(entry.label)}</span>
                  <strong>${entry.value}</strong>
                </div>
                <div class="dashboard-bar-track">
                  <span style="width:${width}%;background:${entry.color};"></span>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
}

function renderProjectCard(student) {
  const progress = clampProgress(student.currentProgressPercent);
  const projectName = student.projectName || 'Chưa đặt tên sản phẩm';
  const studentName = student.fullName || 'Học sinh';
  const classCode = student.classCode || student.classId || '';

  return `
    <article class="dashboard-project-card">
      <div class="dashboard-project-card__main">
        <h3>${escapeHtml(projectName)}</h3>
        <p>${escapeHtml(studentName)}${classCode ? ` · ${escapeHtml(classCode)}` : ''}</p>
      </div>
      <div class="dashboard-project-card__score">
        <strong>${progress}%</strong>
        <span>${escapeHtml(formatDateTime(student.lastReportedAt))}</span>
      </div>
    </article>
  `;
}

function renderProjectList(title, students, emptyTitle) {
  return `
    <section class="dashboard-list-card">
      <div class="dashboard-card-head">
        <h2>${escapeHtml(title)}</h2>
        <span>${students.length}</span>
      </div>
      ${
        students.length
          ? `<div class="dashboard-project-list">${students.map(renderProjectCard).join('')}</div>`
          : renderEmptyState({
              icon: 'folder2-open',
              title: emptyTitle,
              description: '',
            })
      }
    </section>
  `;
}

function renderClassProgressChart(entries) {
  return `
    <section class="dashboard-list-card">
      <div class="dashboard-card-head">
        <h2>Theo lớp</h2>
        <span>${entries.length}</span>
      </div>
      ${
        entries.length
          ? `<div class="dashboard-class-chart">
              ${entries
                .map(
                  (entry) => `
                    <div class="dashboard-class-row">
                      <div class="dashboard-class-row__meta">
                        <span>${escapeHtml(entry.label)}</span>
                        <strong>${entry.percent}%</strong>
                      </div>
                      <div class="dashboard-class-track">
                        <span style="width:${entry.percent}%;"></span>
                      </div>
                    </div>
                  `,
                )
                .join('')}
            </div>`
          : renderEmptyState({
              icon: 'collection',
              title: 'Chưa có dữ liệu lớp',
              description: '',
            })
      }
    </section>
  `;
}

function renderDashboard(state) {
  const activeClasses = state.classes.filter((item) => item.status === 'active' && !item.hidden);
  const trackedStudents = state.students.filter(isTrackedStudent);
  const completedStudents = trackedStudents.filter(isCompletedStudent);
  const activeStudents = trackedStudents.filter((student) => !isCompletedStudent(student));
  const supportStudents = trackedStudents.filter((student) => student.currentStatus === SUPPORT_STATUS);
  const metrics = {
    activeClasses: activeClasses.length,
    totalStudents: trackedStudents.length,
    activeStudents: activeStudents.length,
    completedStudents: completedStudents.length,
    supportStudents: supportStudents.length,
    projectCount: trackedStudents.length,
    todayReports: state.todayReports.length,
    completionRate: toPercent(completedStudents.length, trackedStudents.length),
  };
  const activeProjects = sortByProgress(activeStudents).slice(0, 5);
  const classProgressEntries = getClassProgressEntries(activeClasses, trackedStudents);

  return `
    <div class="dashboard-kpi-grid">
      ${renderKpiCard({ label: 'Lớp hoạt động', value: metrics.activeClasses, icon: 'collection' })}
      ${renderKpiCard({ label: 'Đang làm', value: metrics.activeStudents, icon: 'person-workspace', tone: 'info' })}
      ${renderKpiCard({ label: 'Hoàn thành', value: metrics.completedStudents, icon: 'patch-check', tone: 'success' })}
      ${renderKpiCard({ label: 'Tổng dự án', value: metrics.projectCount, icon: 'kanban', tone: 'warning' })}
      ${renderKpiCard({ label: 'Báo cáo hôm nay', value: metrics.todayReports, icon: 'calendar-check', tone: 'success' })}
      ${renderKpiCard({ label: 'Cần hỗ trợ', value: metrics.supportStudents, icon: 'life-preserver', tone: 'danger' })}
    </div>

    <div class="dashboard-chart-grid">
      ${renderCompletionChart(metrics)}
      ${renderBarChart('Trạng thái', getStatusEntries(trackedStudents), trackedStudents.length)}
      ${renderBarChart('Giai đoạn', getStageEntries(trackedStudents), trackedStudents.length)}
      ${renderBarChart('Tiến độ', getProgressEntries(trackedStudents), trackedStudents.length)}
    </div>

    <div class="dashboard-lower-grid">
      ${renderClassProgressChart(classProgressEntries)}
      ${renderProjectList('Sản phẩm đang làm', activeProjects, 'Chưa có sản phẩm đang làm')}
    </div>
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
          <div id="dashboard-content-slot">${renderLoadingOverlay()}</div>
        </section>
      `,
    });
  },
  async mount() {
    const contentSlot = document.getElementById('dashboard-content-slot');
    const state = {
      classes: [],
      students: [],
      todayReports: [],
    };

    function renderView() {
      contentSlot.innerHTML = renderDashboard(state);
    }

    const unsubscribers = [
      subscribeClasses(
        (classes) => {
          state.classes = classes;
          renderView();
        },
        (error) => {
          showToast({
            title: 'Lỗi dữ liệu',
            message: mapFirebaseError(error, 'Không tải được danh sách lớp.'),
            variant: 'danger',
          });
        },
      ),
      subscribeStudents(
        (students) => {
          state.students = students;
          renderView();
        },
        (error) => {
          showToast({
            title: 'Lỗi dữ liệu',
            message: mapFirebaseError(error, 'Không tải được danh sách học sinh.'),
            variant: 'danger',
          });
        },
      ),
      subscribeTodayReports(
        (reports) => {
          state.todayReports = reports;
          renderView();
        },
        (error) => {
          showToast({
            title: 'Lỗi dữ liệu',
            message: mapFirebaseError(error, 'Không tải được báo cáo hôm nay.'),
            variant: 'danger',
          });
        },
      ),
    ];

    renderView();

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  },
};
