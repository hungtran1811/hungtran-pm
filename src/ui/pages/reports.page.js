import { subscribeClasses } from '../../services/classes.service.js';
import { getStudentReportHistory, subscribeReports } from '../../services/reports.service.js';
import { subscribeStudents } from '../../services/students.service.js';
import { getAuthState } from '../../state/auth.store.js';
import { createFilterStore } from '../../state/filter.store.js';
import { formatDateTime, toDateKey } from '../../utils/date.js';
import { mapFirebaseError } from '../../utils/firebase-error.js';
import { escapeHtml, nl2br } from '../../utils/html.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderFilterBar } from '../components/FilterBar.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderReportsTable } from '../components/ReportsTable.js';
import { renderStageBadge } from '../components/StageBadge.js';
import { renderStatusBadge } from '../components/StatusBadge.js';
import { showToast } from '../components/ToastStack.js';

function renderHistoryPanel(history, studentName = '') {
  if (!history || history.length === 0) {
    return renderEmptyState({
      icon: 'clock-history',
      title: 'Chọn một học sinh để xem lịch sử',
      description: 'Nhấn vào nút "Lịch sử" ở bảng bên trái để xem chuỗi báo cáo gần nhất.',
    });
  }

  const items = history
    .map(
      (report) => `
        <div class="border rounded-4 p-3 mb-3 bg-light">
          <div class="d-flex flex-wrap justify-content-between gap-2 mb-2">
            <strong>${escapeHtml(formatDateTime(report.submittedAt))}</strong>
            <div class="d-flex flex-wrap gap-2">
              ${renderStatusBadge(report.status)}
              ${renderStageBadge(report.stage)}
              <span class="badge bg-white text-dark border">${report.progressPercent}%</span>
            </div>
          </div>
          <div class="small text-secondary mb-2">${escapeHtml(report.projectName)}</div>
          <div class="mb-2"><strong>Đã làm được:</strong><br>${nl2br(report.doneToday)}</div>
          <div class="mb-2"><strong>Mục tiêu tiếp theo:</strong><br>${nl2br(report.nextGoal)}</div>
          <div><strong>Khó khăn:</strong><br>${nl2br(report.difficulties || 'Không có')}</div>
        </div>
      `,
    )
    .join('');

  return `
    <div class="card border-0 shadow-sm h-100">
      <div class="card-header bg-white border-0">
        <h2 class="h5 mb-1">Lịch sử báo cáo</h2>
        <p class="text-secondary mb-0">${escapeHtml(studentName)}</p>
      </div>
      <div class="card-body">${items}</div>
    </div>
  `;
}

export const reportsPage = {
  title: 'Quản lý báo cáo',
  async render() {
    const authState = getAuthState();

    return renderAppShell({
      title: 'Quản lý báo cáo',
      subtitle: '',
      currentRoute: '/admin/reports',
      user: authState.user,
      content: `
        <div id="reports-filter-slot"></div>
        <div class="row g-4">
          <div class="col-12 col-xl-8" id="reports-table-slot">${renderLoadingOverlay()}</div>
          <div class="col-12 col-xl-4" id="reports-history-slot">${renderHistoryPanel([])}</div>
        </div>
      `,
    });
  },
  async mount() {
    const filterSlot = document.getElementById('reports-filter-slot');
    const tableSlot = document.getElementById('reports-table-slot');
    const historySlot = document.getElementById('reports-history-slot');
    const filterStore = createFilterStore({
      classId: '',
      studentId: '',
      status: '',
      stage: '',
      dateFrom: '',
      dateTo: '',
    });
    const state = {
      classes: [],
      students: [],
      reports: [],
      history: [],
      historyStudentName: '',
    };

    function renderView() {
      const filters = filterStore.getState();
      const filteredReports = state.reports.filter((report) => {
        const reportDateKey = toDateKey(report.submittedAt);
        const byClass = !filters.classId || report.classId === filters.classId;
        const byStudent = !filters.studentId || report.studentId === filters.studentId;
        const byStatus = !filters.status || report.status === filters.status;
        const byStage = !filters.stage || report.stage === filters.stage;
        const byFrom = !filters.dateFrom || reportDateKey >= filters.dateFrom;
        const byTo = !filters.dateTo || reportDateKey <= filters.dateTo;
        return byClass && byStudent && byStatus && byStage && byFrom && byTo;
      });

      filterSlot.innerHTML = renderFilterBar({
        id: 'reports-filter-form',
        classes: state.classes,
        students: state.students.filter((student) => !filters.classId || student.classId === filters.classId),
        values: filters,
        showStudent: true,
        showDateRange: true,
      });

      tableSlot.innerHTML =
        filteredReports.length > 0
          ? renderReportsTable(filteredReports)
          : renderEmptyState({
              icon: 'file-earmark-text',
              title: 'Không có báo cáo phù hợp',
              description: 'Hãy điều chỉnh bộ lọc hoặc chờ học sinh gửi thêm report mới.',
            });
      historySlot.innerHTML = renderHistoryPanel(state.history, state.historyStudentName);
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

    tableSlot.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action="view-history"]');

      if (!button) {
        return;
      }

      try {
        historySlot.innerHTML = renderLoadingOverlay('Đang tải lịch sử báo cáo...');
        state.history = await getStudentReportHistory(button.dataset.studentId);
        state.historyStudentName = button.dataset.studentName || '';
        renderView();
      } catch (error) {
        showToast({
          title: 'Lỗi tải lịch sử',
          message: mapFirebaseError(error, 'Không tải được lịch sử báo cáo.'),
          variant: 'danger',
        });
      }
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
            message: mapFirebaseError(error, 'Không tải được lớp.'),
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
            message: mapFirebaseError(error, 'Không tải được học sinh.'),
            variant: 'danger',
          });
        },
      ),
      subscribeReports(
        (reports) => {
          state.reports = reports;
          renderView();
        },
        (error) => {
          tableSlot.innerHTML = renderEmptyState({
            icon: 'exclamation-triangle',
            title: 'Không tải được báo cáo',
            description: mapFirebaseError(error, 'Kiểm tra lại quyền truy cập hoặc cấu hình Firestore.'),
          });
        },
      ),
    ];

    renderView();

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  },
};
