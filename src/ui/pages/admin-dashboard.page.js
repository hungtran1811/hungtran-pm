import { subscribeClasses } from '../../services/classes.service.js';
import { subscribeTodayReports } from '../../services/reports.service.js';
import { subscribeStudents } from '../../services/students.service.js';
import { STAGES } from '../../constants/stages.js';
import { STATUSES } from '../../constants/statuses.js';
import { getAuthState } from '../../state/auth.store.js';
import { createFilterStore } from '../../state/filter.store.js';
import { daysSince, formatDateTime } from '../../utils/date.js';
import { mapFirebaseError } from '../../utils/firebase-error.js';
import { escapeHtml } from '../../utils/html.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderFilterBar } from '../components/FilterBar.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderStageBadge } from '../components/StageBadge.js';
import { renderStatCard } from '../components/StatCard.js';
import { renderStatusBadge } from '../components/StatusBadge.js';
import { showToast } from '../components/ToastStack.js';

const STATUS_COLORS = {
  'Chưa bắt đầu': '#94a3b8',
  'Đang làm': '#2f6fed',
  'Cần hỗ trợ': '#dc3545',
  'Gần hoàn thành': '#f0b429',
  'Hoàn thành': '#198754',
};

const STAGE_COLORS = ['#0f4c81', '#2874a6', '#4f8fb4', '#f0b429', '#f28c28', '#198754', '#7a9e7e'];

function toPercent(value, total) {
  if (!total) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function getStatusEntries(students) {
  return STATUSES.map((label) => ({
    label,
    value: students.filter((student) => student.currentStatus === label).length,
    color: STATUS_COLORS[label] ?? '#94a3b8',
  }));
}

function getStageEntries(students) {
  return STAGES.map((label, index) => ({
    label,
    value: students.filter((student) => student.currentStage === label).length,
    color: STAGE_COLORS[index % STAGE_COLORS.length],
  })).filter((entry) => entry.value > 0);
}

function renderStatusChart(students) {
  const entries = getStatusEntries(students);
  const maxValue = Math.max(...entries.map((entry) => entry.value), 1);

  if (students.length === 0) {
    return renderEmptyState({
      icon: 'bar-chart',
      title: 'Chưa có dữ liệu để vẽ biểu đồ',
      description: 'Hãy điều chỉnh bộ lọc hoặc chờ học sinh cập nhật báo cáo mới.',
    });
  }

  const bars = entries
    .map(
      (entry) => `
        <div class="dashboard-bar-chart__row">
          <div class="dashboard-bar-chart__meta">
            <span>${escapeHtml(entry.label)}</span>
            <strong>${entry.value}</strong>
          </div>
          <div class="dashboard-bar-chart__track">
            <div
              class="dashboard-bar-chart__fill"
              style="width: ${entry.value === 0 ? 0 : Math.max((entry.value / maxValue) * 100, 8)}%; background: ${entry.color};"
            ></div>
          </div>
          <div class="dashboard-bar-chart__foot text-secondary small">${toPercent(entry.value, students.length)}%</div>
        </div>
      `,
    )
    .join('');

  return `
    <div class="admin-data-card h-100">
      <div class="admin-data-card__header">
        <h2 class="h5 mb-0">Phân bố trạng thái</h2>
      </div>
      <div class="admin-data-card__body">
        <div class="dashboard-bar-chart">${bars}</div>
      </div>
    </div>
  `;
}

function renderStageChart(students) {
  const entries = getStageEntries(students);
  const total = students.length;

  if (total === 0 || entries.length === 0) {
    return renderEmptyState({
      icon: 'pie-chart',
      title: 'Chưa có dữ liệu giai đoạn',
      description: 'Biểu đồ tròn sẽ hiện khi có học sinh phù hợp với bộ lọc hiện tại.',
    });
  }

  let currentPercent = 0;
  const gradientStops = entries
    .map((entry) => {
      const start = currentPercent;
      currentPercent += (entry.value / total) * 100;

      return `${entry.color} ${start}% ${currentPercent}%`;
    })
    .join(', ');

  const legend = entries
    .map(
      (entry) => `
        <div class="dashboard-donut-chart__legend-item">
          <span class="dashboard-donut-chart__legend-swatch" style="background: ${entry.color};"></span>
          <div class="min-w-0">
            <div class="fw-semibold">${escapeHtml(entry.label)}</div>
            <div class="small text-secondary">${entry.value} học sinh · ${toPercent(entry.value, total)}%</div>
          </div>
        </div>
      `,
    )
    .join('');

  return `
    <div class="admin-data-card h-100">
      <div class="admin-data-card__header">
        <h2 class="h5 mb-0">Phân bố giai đoạn</h2>
      </div>
      <div class="admin-data-card__body">
        <div class="dashboard-donut-chart">
          <div class="dashboard-donut-chart__visual">
            <div class="dashboard-donut-chart__ring" style="background: conic-gradient(${gradientStops});">
              <div class="dashboard-donut-chart__center">
                <strong>${total}</strong>
                <span>học sinh</span>
              </div>
            </div>
          </div>
          <div class="dashboard-donut-chart__legend">${legend}</div>
        </div>
      </div>
    </div>
  `;
}

function renderSupportBoard(students) {
  if (students.length === 0) {
    return renderEmptyState({
      icon: 'life-preserver',
      title: 'Chưa có ca cần hỗ trợ',
      description: 'Khi học sinh chuyển sang trạng thái cần hỗ trợ, khó khăn sẽ hiện ở đây.',
    });
  }

  const items = students
    .map((student) => {
      const difficultyText = student.currentDifficulties?.trim() || 'Chưa ghi rõ khó khăn.';
      const supportBadges = [
        renderStatusBadge(student.currentStatus),
        renderStageBadge(student.currentStage),
        `<span class="badge bg-light text-dark border">${student.currentProgressPercent}%</span>`,
      ];

      return `
        <div class="dashboard-support-card">
          <div class="d-flex flex-column flex-lg-row justify-content-between gap-3">
            <div>
              <div class="fw-semibold">${escapeHtml(student.fullName)}</div>
              <div class="small text-secondary">${escapeHtml(student.classCode)} · ${escapeHtml(student.projectName)}</div>
              <div class="small text-secondary mt-1">Cập nhật gần nhất: ${escapeHtml(formatDateTime(student.lastReportedAt))}</div>
            </div>
            <div class="d-flex flex-wrap gap-2 align-items-start">
              ${supportBadges.join('')}
            </div>
          </div>
          <div class="dashboard-support-card__difficulty">
            <div class="dashboard-support-card__label">Khó khăn đang gặp</div>
            <div>${escapeHtml(difficultyText)}</div>
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="admin-data-card">
      <div class="admin-data-card__header">
        <div class="d-flex flex-column flex-md-row justify-content-between gap-2 align-items-md-center">
          <h2 class="h5 mb-0">Trường hợp cần hỗ trợ</h2>
          <span class="small text-secondary">${students.length} học sinh cần theo sát</span>
        </div>
      </div>
      <div class="admin-data-card__body">
        <div class="dashboard-support-list">${items}</div>
      </div>
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
          <div id="dashboard-filter-slot"></div>
          <div id="dashboard-content-slot">${renderLoadingOverlay()}</div>
        </section>
      `,
    });
  },
  async mount() {
    const filterSlot = document.getElementById('dashboard-filter-slot');
    const contentSlot = document.getElementById('dashboard-content-slot');
    const filterStore = createFilterStore({
      classId: '',
      status: '',
      stage: '',
    });
    const state = {
      classes: [],
      students: [],
      todayReports: [],
    };

    function renderView() {
      const filters = filterStore.getState();
      const activeClasses = state.classes.filter((item) => item.status === 'active' && !item.hidden);
      const filteredStudents = state.students.filter((student) => {
        const byClass = !filters.classId || student.classId === filters.classId;
        const byStatus = !filters.status || student.currentStatus === filters.status;
        const byStage = !filters.stage || student.currentStage === filters.stage;
        return student.active && byClass && byStatus && byStage;
      });
      const supportStudentsExact = filteredStudents.filter((student) => student.currentStatus === 'Cần hỗ trợ');
      const completedStudentsExact = filteredStudents.filter((student) => student.currentStatus === 'Hoàn thành');
      const supportBoardStudents = [...supportStudentsExact].sort((left, right) => {
        const leftOverdue = daysSince(left.lastReportedAt);
        const rightOverdue = daysSince(right.lastReportedAt);

        if (rightOverdue !== leftOverdue) {
          return rightOverdue - leftOverdue;
        }

        return (right.progressStalledCount ?? 0) - (left.progressStalledCount ?? 0);
      });

      filterSlot.innerHTML = renderFilterBar({
        id: 'dashboard-filter-form',
        classes: activeClasses,
        values: filters,
      });

      contentSlot.innerHTML = `
        <div class="admin-stat-grid mb-4">
          ${renderStatCard({ label: 'Lớp đang hoạt động', value: String(activeClasses.length), icon: 'collection', tone: 'primary' })}
          ${renderStatCard({ label: 'Học sinh đang theo dõi', value: String(filteredStudents.length), icon: 'people', tone: 'info' })}
          ${renderStatCard({ label: 'Báo cáo hôm nay', value: String(state.todayReports.filter((report) => !filters.classId || report.classId === filters.classId).length), icon: 'calendar-check', tone: 'success' })}
          ${renderStatCard({ label: 'Cần hỗ trợ', value: String(supportStudentsExact.length), icon: 'life-preserver', tone: 'danger' })}
          ${renderStatCard({ label: 'Hoàn thành', value: String(completedStudentsExact.length), icon: 'check-circle', tone: 'success' })}
        </div>
        <div class="row g-4">
          <div class="col-12 col-xl-7">
            ${renderStatusChart(filteredStudents)}
          </div>
          <div class="col-12 col-xl-5">
            ${renderStageChart(filteredStudents)}
          </div>
        </div>
        <div class="mt-4">
          ${renderSupportBoard(supportBoardStudents)}
        </div>
      `;
    }

    filterSlot.addEventListener('change', (event) => {
      if (!event.target.name) {
        return;
      }

      filterStore.set({ [event.target.name]: event.target.value });
    });

    filterSlot.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action="reset-filters"]');

      if (!button) {
        return;
      }

      filterStore.reset();
    });

    filterStore.subscribe(renderView);

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
