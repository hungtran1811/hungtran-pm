import { subscribeClasses } from '../../services/classes.service.js';
import { subscribeTodayReports } from '../../services/reports.service.js';
import { subscribeStudents } from '../../services/students.service.js';
import { getAuthState } from '../../state/auth.store.js';
import { createFilterStore } from '../../state/filter.store.js';
import { getClassCompletionStats } from '../../utils/class-completion.js';
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

function isStudentStalled(student) {
  return daysSince(student.lastReportedAt) > 7 || student.progressStalledCount >= 2;
}

function renderClassHealthTable(classSummaries) {
  if (classSummaries.length === 0) {
    return renderEmptyState({
      icon: 'collection',
      title: 'Chưa có lớp phù hợp',
      description: 'Hãy tạo lớp hoặc điều chỉnh bộ lọc để xem dữ liệu.',
    });
  }

  const rows = classSummaries
    .map(
      (summary) => `
        <tr>
          <td>
            <div class="fw-semibold">${escapeHtml(summary.classCode)}</div>
            <div class="small text-secondary">${escapeHtml(summary.className)}</div>
          </td>
          <td>${summary.studentCount}</td>
          <td>${summary.needSupportCount}</td>
          <td>${summary.stalledCount}</td>
          <td>${summary.nearDoneCount}</td>
          <td>${summary.completedCount}</td>
          <td>
            ${
              summary.completionReady
                ? '<span class="badge text-bg-success">Đủ điều kiện</span>'
                : '<span class="badge text-bg-light text-dark border">Chưa đủ</span>'
            }
          </td>
        </tr>
      `,
    )
    .join('');

  return `
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white border-0">
        <h2 class="h5 mb-0">Theo lớp</h2>
      </div>
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>Lớp</th>
              <th>Số HS</th>
              <th>Cần hỗ trợ</th>
              <th>Chậm tiến độ</th>
              <th>Gần xong</th>
              <th>Hoàn thành</th>
              <th>Điều kiện</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAttentionList(students) {
  if (students.length === 0) {
    return renderEmptyState({
      icon: 'emoji-smile',
      title: 'Không có học sinh cần chú ý',
      description: 'Tất cả học sinh đang ổn theo bộ lọc hiện tại.',
    });
  }

  const items = students
    .map(
      (student) => `
        <div class="list-group-item border-0 border-bottom py-3">
          <div class="d-flex flex-column flex-md-row justify-content-between gap-3">
            <div>
              <div class="fw-semibold">${escapeHtml(student.fullName)}</div>
              <div class="small text-secondary">${escapeHtml(student.classCode)} · ${escapeHtml(student.projectName)}</div>
              <div class="small text-secondary mt-1">Cập nhật gần nhất: ${escapeHtml(formatDateTime(student.lastReportedAt))}</div>
            </div>
            <div class="d-flex flex-wrap gap-2 align-items-start">
              ${renderStatusBadge(student.currentStatus)}
              ${renderStageBadge(student.currentStage)}
              <span class="badge bg-light text-dark border">${student.currentProgressPercent}%</span>
            </div>
          </div>
        </div>
      `,
    )
    .join('');

  return `
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white border-0">
        <h2 class="h5 mb-0">Cần chú ý</h2>
      </div>
      <div class="list-group list-group-flush">${items}</div>
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
        <div id="dashboard-filter-slot"></div>
        <div id="dashboard-content-slot">${renderLoadingOverlay()}</div>
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
      const activeClasses = state.classes.filter((item) => item.status === 'active');
      const filteredStudents = state.students.filter((student) => {
        const byClass = !filters.classId || student.classId === filters.classId;
        const byStatus = !filters.status || student.currentStatus === filters.status;
        const byStage = !filters.stage || student.currentStage === filters.stage;
        return student.active && byClass && byStatus && byStage;
      });
      const visibleClasses = activeClasses.filter((item) => !filters.classId || item.classCode === filters.classId);
      const stalledStudents = filteredStudents.filter(isStudentStalled);
      const supportStudents = filteredStudents.filter((student) => student.currentStatus === 'Cần hỗ trợ');
      const nearDoneStudents = filteredStudents.filter((student) => student.currentStatus === 'Gần hoàn thành');
      const completedStudents = filteredStudents.filter((student) => student.currentStatus === 'Hoàn thành');
      const classSummaries = visibleClasses.map((classItem) => {
        const classStudents = filteredStudents.filter((student) => student.classId === classItem.classCode);
        const classCompletion = getClassCompletionStats(classItem.classCode, state.students);

        return {
          classCode: classItem.classCode,
          className: classItem.className,
          studentCount: classStudents.length,
          needSupportCount: classStudents.filter((student) => student.currentStatus === 'Cần hỗ trợ').length,
          stalledCount: classStudents.filter(isStudentStalled).length,
          nearDoneCount: classStudents.filter((student) => student.currentStatus === 'Gần hoàn thành').length,
          completedCount: classCompletion.completedStudentCount,
          completionReady: classCompletion.completionReady,
        };
      });
      const readyToCompleteClasses = activeClasses.filter(
        (classItem) => getClassCompletionStats(classItem.classCode, state.students).completionReady,
      );
      const attentionList = [
        ...supportStudents,
        ...stalledStudents.filter((student) => student.currentStatus !== 'Cần hỗ trợ'),
      ].slice(0, 8);

      filterSlot.innerHTML = renderFilterBar({
        id: 'dashboard-filter-form',
        classes: activeClasses,
        values: filters,
      });

      contentSlot.innerHTML = `
        <div class="row g-3 mb-4">
          ${renderStatCard({ label: 'Lớp đang hoạt động', value: String(activeClasses.length), icon: 'collection', tone: 'primary' })}
          ${renderStatCard({ label: 'Học sinh đang theo dõi', value: String(filteredStudents.length), icon: 'people', tone: 'info' })}
          ${renderStatCard({ label: 'Báo cáo hôm nay', value: String(state.todayReports.filter((report) => !filters.classId || report.classId === filters.classId).length), icon: 'calendar-check', tone: 'success' })}
          ${renderStatCard({ label: 'Cần hỗ trợ', value: String(supportStudents.length), icon: 'life-preserver', tone: 'danger' })}
          ${renderStatCard({ label: 'Gần hoàn thành', value: String(nearDoneStudents.length), icon: 'flag', tone: 'warning' })}
          ${renderStatCard({ label: 'Lớp đủ điều kiện', value: String(readyToCompleteClasses.length), icon: 'check2-square', tone: 'success' })}
          ${renderStatCard({ label: 'Hoàn thành', value: String(completedStudents.length), icon: 'check-circle', tone: 'success' })}
        </div>
        <div class="row g-4">
          <div class="col-12 col-xl-7">
            ${renderClassHealthTable(classSummaries)}
          </div>
          <div class="col-12 col-xl-5">
            ${renderAttentionList(attentionList)}
          </div>
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
