import { APP_CONFIG } from '../../config/app-config.js';
import { subscribeClasses } from '../../services/classes.service.js';
import { deleteReport, getStudentReportHistory, subscribeReports } from '../../services/reports.service.js';
import { subscribeStudents } from '../../services/students.service.js';
import { getAuthState } from '../../state/auth.store.js';
import { createFilterStore } from '../../state/filter.store.js';
import { copyTextToClipboard } from '../../utils/clipboard.js';
import { formatDateTime } from '../../utils/date.js';
import { mapFirebaseError } from '../../utils/firebase-error.js';
import { escapeHtml, nl2br } from '../../utils/html.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderReportsTable } from '../components/ReportsTable.js';
import { renderStageBadge } from '../components/StageBadge.js';
import { renderStatusBadge } from '../components/StatusBadge.js';
import { confirmDialog } from '../components/ConfirmDialog.js';
import { showToast } from '../components/ToastStack.js';

function isReportableClass(classItem) {
  return classItem?.status === 'active' && !classItem?.hidden;
}

function isArchivedReportClass(classItem) {
  return !isReportableClass(classItem);
}

function getLatestReportsByStudent(reports) {
  const latestByStudent = new Map();

  for (const report of reports) {
    if (!latestByStudent.has(report.studentId)) {
      latestByStudent.set(report.studentId, report);
    }
  }

  return Array.from(latestByStudent.values());
}

function getLatestReportsMap(reports) {
  return new Map(getLatestReportsByStudent(reports).map((report) => [report.studentId, report]));
}

function getCopyValue(value, fallback = 'Chưa có báo cáo') {
  const normalizedValue = String(value ?? '').trim();
  return normalizedValue || fallback;
}

function buildReportCopyData({ report = null, student = null }) {
  return {
    studentName: report?.studentName || student?.fullName || 'Chưa có thông tin',
    projectName: report?.projectName || student?.projectName || 'Chưa gán chủ đề',
    progressText: report ? `${report.progressPercent}%` : 'Chưa có báo cáo',
    doneToday: report ? getCopyValue(report.doneToday) : 'Chưa có báo cáo',
    nextGoal: report ? getCopyValue(report.nextGoal) : 'Chưa có báo cáo',
    difficulties: report ? getCopyValue(report.difficulties, 'Không có') : 'Chưa có báo cáo',
    stage: report ? getCopyValue(report.stage) : 'Chưa có báo cáo',
    status: report ? getCopyValue(report.status) : 'Chưa có báo cáo',
  };
}

function formatStudentReportCopyText(data, index = null) {
  const prefix = index ? `${index}. ` : '';

  return [
    `${prefix}Họ tên: ${data.studentName}`,
    `Chủ đề: ${data.projectName}`,
    `Tiến độ sản phẩm: ${data.progressText}`,
    `Đã làm: ${data.doneToday}`,
    `Mục tiêu: ${data.nextGoal}`,
    `Khó khăn: ${data.difficulties}`,
    `Giai đoạn: ${data.stage}`,
    `Trạng thái: ${data.status}`,
  ].join('\n');
}

function buildClassReportCopyText(classItem, students, reports) {
  const latestReportsMap = getLatestReportsMap(reports.filter((report) => report.classCode === classItem.classCode));
  const classStudents = students
    .filter((student) => student.active && student.classId === classItem.classCode)
    .sort((left, right) => left.fullName.localeCompare(right.fullName, 'vi'));

  const blocks = classStudents.map((student, index) =>
    formatStudentReportCopyText(
      buildReportCopyData({
        report: latestReportsMap.get(student.id) || null,
        student,
      }),
      index + 1,
    ),
  );

  return [
    `Lớp: ${classItem.classCode} - ${classItem.className}`,
    `Số học sinh hoạt động: ${classStudents.length}`,
    '',
    blocks.join('\n\n'),
  ].join('\n');
}

function renderReportDetailContent(history, studentName = '') {
  if (!history || history.length === 0) {
    return renderEmptyState({
      icon: 'file-earmark-text',
      title: 'Chưa có báo cáo',
      description: 'Học sinh này chưa có báo cáo phù hợp với bộ lọc hiện tại.',
    });
  }

  const latestReport = history[0];
  const previousReports = history.slice(1);
  const difficulties = latestReport.difficulties?.trim() ? latestReport.difficulties : 'Không có';

  return `
    <div class="report-detail-card">
      <div class="d-flex flex-wrap justify-content-between gap-3 mb-3">
        <div>
          <div class="fw-semibold">${escapeHtml(latestReport.projectName)}</div>
          <div class="small text-secondary">${escapeHtml(latestReport.classCode)}</div>
        </div>
        <div class="text-md-end">
          <div class="small text-secondary">${escapeHtml(formatDateTime(latestReport.submittedAt))}</div>
          <div class="d-flex flex-wrap gap-2 justify-content-md-end mt-2">
            ${renderStatusBadge(latestReport.status)}
            ${renderStageBadge(latestReport.stage)}
            <span class="badge bg-white text-dark border">${latestReport.progressPercent}%</span>
          </div>
        </div>
      </div>

      <div class="report-detail-section">
        <div class="report-detail-label">Đã làm được</div>
        <div class="report-detail-content">${nl2br(latestReport.doneToday)}</div>
      </div>

      <div class="report-detail-section">
        <div class="report-detail-label">Mục tiêu buổi tiếp theo</div>
        <div class="report-detail-content">${nl2br(latestReport.nextGoal)}</div>
      </div>

      <div class="report-detail-section">
        <div class="report-detail-label">Khó khăn gặp phải</div>
        <div class="report-detail-content">${nl2br(difficulties)}</div>
      </div>

      <hr class="my-4">

      <div class="d-flex justify-content-between align-items-center mb-3">
        <h3 class="h6 mb-0">Lịch sử gần đây</h3>
        <span class="small text-secondary">${history.length} báo cáo</span>
      </div>

      ${
        previousReports.length > 0
          ? `
            <div class="report-history-list">
              ${previousReports
                .map(
                  (report) => `
                    <details class="report-history-item">
                      <summary class="report-history-summary">
                        <div class="report-history-summary__main">
                          <strong>${escapeHtml(formatDateTime(report.submittedAt))}</strong>
                          <div class="small text-secondary">${escapeHtml(report.projectName)}</div>
                        </div>
                        <div class="d-flex flex-wrap gap-2 justify-content-end">
                          ${renderStatusBadge(report.status)}
                          ${renderStageBadge(report.stage)}
                          <span class="badge bg-white text-dark border">${report.progressPercent}%</span>
                        </div>
                      </summary>
                      <div class="report-history-body">
                        <div class="report-detail-section">
                          <div class="report-detail-label">Đã làm được</div>
                          <div class="report-detail-content">${nl2br(report.doneToday)}</div>
                        </div>
                        <div class="report-detail-section">
                          <div class="report-detail-label">Mục tiêu buổi tiếp theo</div>
                          <div class="report-detail-content">${nl2br(report.nextGoal)}</div>
                        </div>
                        <div class="report-detail-section">
                          <div class="report-detail-label">Khó khăn gặp phải</div>
                          <div class="report-detail-content">${nl2br(report.difficulties?.trim() ? report.difficulties : 'Không có')}</div>
                        </div>
                      </div>
                    </details>
                  `,
                )
                .join('')}
            </div>
          `
          : '<p class="text-secondary small mb-0">Chưa có báo cáo cũ hơn cho học sinh này.</p>'
      }
    </div>
  `;
}

function renderReportsClassFilter({ filters, classes, selectedClass, reportCount, isArchiveView }) {
  const classOptions = classes
    .map(
      (item) => `
        <option value="${escapeHtml(item.classCode)}" ${filters.classId === item.classCode ? 'selected' : ''}>
          ${escapeHtml(`${item.classCode} - ${item.className}`)}
        </option>
      `,
    )
    .join('');

  return `
    <div class="admin-list-switch mb-3 reports-toolbar">
      <div class="admin-segmented-tabs" role="group" aria-label="Chế độ báo cáo">
        <button
          type="button"
          class="admin-segmented-tabs__button ${isArchiveView ? '' : 'admin-segmented-tabs__button--active'}"
          data-action="set-report-scope"
          data-scope="active"
        >
          Đang theo dõi
        </button>
        <button
          type="button"
          class="admin-segmented-tabs__button ${isArchiveView ? 'admin-segmented-tabs__button--active' : ''}"
          data-action="set-report-scope"
          data-scope="archive"
        >
          Lưu trữ
        </button>
      </div>
      <div class="ms-auto">
        <button
          type="button"
          class="btn btn-outline-primary"
          data-action="copy-class-report"
          ${selectedClass ? '' : 'disabled'}
        >
          <i class="bi bi-clipboard-check me-2"></i>Copy báo cáo lớp
        </button>
      </div>
    </div>
    <form id="reports-filter-form" class="admin-command-bar mb-4">
      <div class="admin-command-bar__body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-8 col-xl-5">
            <label class="form-label">Lớp</label>
            <select class="form-select" name="classId">
              <option value="">Tất cả lớp</option>
              ${classOptions}
            </select>
          </div>
          <div class="col-12 col-md-auto ms-md-auto">
            <span class="admin-count-pill">${reportCount} báo cáo</span>
          </div>
          <div class="col-12 col-md-auto">
            <button type="button" class="btn btn-outline-secondary w-100" data-action="reset-filters">
              <i class="bi bi-arrow-counterclockwise me-2"></i>Đặt lại
            </button>
          </div>
        </div>
      </div>
    </form>
  `;
}

function renderReportDetailModal() {
  return `
    <div class="modal fade" id="report-detail-modal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content border-0 shadow admin-modal report-detail-modal">
          <div class="modal-header">
            <div>
              <h2 class="modal-title fs-5" id="report-detail-modal-title">Chi tiết báo cáo</h2>
              <p class="text-secondary mb-0 small" id="report-detail-modal-subtitle"></p>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button>
          </div>
          <div class="modal-body" id="report-detail-modal-body"></div>
        </div>
      </div>
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
        <section class="admin-page admin-page--reports">
          <div id="reports-filter-slot"></div>
          <div id="reports-table-slot">${renderLoadingOverlay()}</div>
          <div id="reports-modal-slot"></div>
        </section>
      `,
    });
  },
  async mount() {
    const filterSlot = document.getElementById('reports-filter-slot');
    const tableSlot = document.getElementById('reports-table-slot');
    const modalSlot = document.getElementById('reports-modal-slot');
    const filterStore = createFilterStore({
      viewScope: 'active',
      classId: '',
    });
    const state = {
      classes: [],
      students: [],
      reports: [],
      selectedStudentId: '',
      selectedStudentName: '',
    };

    modalSlot.innerHTML = renderReportDetailModal();
    const reportModalEl = document.getElementById('report-detail-modal');
    const reportModal = new window.bootstrap.Modal(reportModalEl);
    const reportModalTitle = document.getElementById('report-detail-modal-title');
    const reportModalSubtitle = document.getElementById('report-detail-modal-subtitle');
    const reportModalBody = document.getElementById('report-detail-modal-body');

    function getScopedClasses(viewScope) {
      return state.classes.filter(viewScope === 'archive' ? isArchivedReportClass : isReportableClass);
    }

    function getScopedReports(viewScope) {
      const allowedClassCodes = new Set(getScopedClasses(viewScope).map((item) => item.classCode));

      return state.reports.filter((report) => allowedClassCodes.has(report.classCode || report.classId));
    }

    function getReportsContext() {
      const filters = filterStore.getState();
      const availableClasses = getScopedClasses(filters.viewScope);
      const nextFilters = {};

      if (filters.classId && !availableClasses.some((item) => item.classCode === filters.classId)) {
        nextFilters.classId = '';
      }

      if (Object.keys(nextFilters).length > 0) {
        filterStore.set(nextFilters);
        return null;
      }

      const latestReports = getLatestReportsByStudent(getScopedReports(filters.viewScope));
      const filteredReports = latestReports.filter((report) => {
        const byClass = !filters.classId || report.classId === filters.classId;
        return byClass;
      });

      return {
        filters,
        availableClasses,
        filteredReports,
      };
    }

    function renderView() {
      const context = getReportsContext();

      if (!context) {
        return;
      }

      const { filters, availableClasses, filteredReports } = context;
      const selectedClass = availableClasses.find((item) => item.classCode === filters.classId) || null;
      const isArchiveView = filters.viewScope === 'archive';

      if (state.selectedStudentId && !filteredReports.some((report) => report.studentId === state.selectedStudentId)) {
        state.selectedStudentId = '';
        state.selectedStudentName = '';
      }

      filterSlot.innerHTML = renderReportsClassFilter({
        filters,
        classes: availableClasses,
        selectedClass,
        reportCount: filteredReports.length,
        isArchiveView,
      });

      tableSlot.innerHTML =
        filteredReports.length > 0
          ? renderReportsTable(filteredReports, {
              selectedStudentId: state.selectedStudentId,
              showDeleteAction: APP_CONFIG.enableAdminDebugActions,
            })
          : renderEmptyState({
              icon: 'file-earmark-text',
              title: isArchiveView ? 'Kho lưu trữ chưa có báo cáo phù hợp' : 'Không có báo cáo phù hợp',
              description: isArchiveView
                ? 'Hãy điều chỉnh bộ lọc lưu trữ hoặc đánh dấu hoàn thành/lưu trữ lớp khi cần.'
                : 'Hãy điều chỉnh bộ lọc hoặc chờ học sinh gửi thêm báo cáo mới.',
            });
    }

    async function loadStudentDetails(studentId, studentName) {
      state.selectedStudentId = studentId;
      state.selectedStudentName = studentName || '';
      reportModalTitle.textContent = 'Chi tiết báo cáo';
      reportModalSubtitle.textContent = state.selectedStudentName;
      reportModalBody.innerHTML = renderLoadingOverlay('Đang tải báo cáo...');
      reportModal.show();

      const history = await getStudentReportHistory(studentId);
      reportModalBody.innerHTML = renderReportDetailContent(history, state.selectedStudentName);
      renderView();
    }

    filterSlot.addEventListener('change', (event) => {
      if (!event.target.name) {
        return;
      }

      if (event.target.name === 'classId') {
        filterStore.set({
          classId: event.target.value,
        });
        return;
      }

      filterStore.set({ [event.target.name]: event.target.value });
    });

    filterSlot.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');

      if (!button) {
        return;
      }

      if (button.dataset.action === 'set-report-scope') {
        filterStore.set({
          viewScope: button.dataset.scope === 'archive' ? 'archive' : 'active',
          classId: '',
        });
        return;
      }

      if (button.dataset.action === 'reset-filters') {
        const currentScope = filterStore.getState().viewScope;
        filterStore.reset();
        filterStore.set({ viewScope: currentScope });
        return;
      }

      if (button.dataset.action === 'copy-class-report') {
        const filters = filterStore.getState();
        const selectedClass = state.classes.find((item) => item.classCode === filters.classId) || null;

        if (!selectedClass) {
          showToast({
            title: 'Chưa chọn lớp',
            message: 'Hãy chọn đúng một lớp trước khi copy báo cáo tổng hợp.',
            variant: 'warning',
          });
          return;
        }

        const activeClassStudents = state.students.filter(
          (student) => student.active && student.classId === selectedClass.classCode,
        );

        if (activeClassStudents.length === 0) {
          showToast({
            title: 'Chưa có học sinh',
            message: `Lớp ${selectedClass.classCode} hiện chưa có học sinh hoạt động để tổng hợp.`,
            variant: 'warning',
          });
          return;
        }

        try {
          await copyTextToClipboard(buildClassReportCopyText(selectedClass, state.students, state.reports));
          showToast({
            title: 'Đã copy báo cáo lớp',
            message: `Nội dung tổng hợp của lớp ${selectedClass.classCode} đã được sao chép.`,
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể copy báo cáo lớp',
            message: mapFirebaseError(error, 'Trình duyệt hiện không cho phép sao chép tự động.'),
            variant: 'danger',
          });
        }
      }
    });

    tableSlot.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');

      if (!button) {
        return;
      }

      if (button.dataset.action === 'copy-student-report') {
        const report = state.reports.find((item) => item.id === button.dataset.reportId);

        if (!report) {
          return;
        }

        try {
          await copyTextToClipboard(formatStudentReportCopyText(buildReportCopyData({ report })));
          showToast({
            title: 'Đã copy báo cáo',
            message: `Báo cáo của ${report.studentName} đã được sao chép.`,
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể copy báo cáo',
            message: mapFirebaseError(error, 'Trình duyệt hiện không cho phép sao chép tự động.'),
            variant: 'danger',
          });
        }

        return;
      }

      if (button.dataset.action === 'select-student') {
        try {
          await loadStudentDetails(button.dataset.studentId, button.dataset.studentName || '');
        } catch (error) {
          reportModalBody.innerHTML = renderEmptyState({
            icon: 'exclamation-triangle',
            title: 'Không tải được báo cáo',
            description: mapFirebaseError(error, 'Không tải được chi tiết báo cáo của học sinh này.'),
          });
          showToast({
            title: 'Lỗi tải báo cáo',
            message: mapFirebaseError(error, 'Không tải được chi tiết báo cáo của học sinh này.'),
            variant: 'danger',
          });
        }

        return;
      }

      if (button.dataset.action === 'delete-report') {
        if (!APP_CONFIG.enableAdminDebugActions) {
          showToast({
            title: 'Đã tắt thao tác thử nghiệm',
            message: 'Tính năng xóa báo cáo hiện chỉ dùng khi bật chế độ debug.',
            variant: 'warning',
          });
          return;
        }

        const report = state.reports.find((item) => item.id === button.dataset.reportId);

        if (!report) {
          return;
        }

        const confirmed = await confirmDialog({
          title: 'Xóa báo cáo?',
          message: `Xóa báo cáo của ${report.studentName} lúc ${formatDateTime(report.submittedAt)}?`,
          confirmText: 'Xóa báo cáo',
          variant: 'danger',
        });

        if (!confirmed) {
          return;
        }

        try {
          await deleteReport(report.id);

          if (state.selectedStudentId === report.studentId) {
            state.selectedStudentName = report.studentName;
          }

          showToast({
            title: 'Đã xóa báo cáo',
            message: `Báo cáo của ${report.studentName} đã được xóa.`,
            variant: 'success',
          });

          renderView();
        } catch (error) {
          showToast({
            title: 'Không thể xóa báo cáo',
            message: mapFirebaseError(error, 'Không thể xóa báo cáo lúc này.'),
            variant: 'danger',
          });
        }
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
