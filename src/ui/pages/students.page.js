import { STATUSES } from '../../constants/statuses.js';
import { subscribeClasses } from '../../services/classes.service.js';
import { createStudent, subscribeStudents, updateStudent } from '../../services/students.service.js';
import { getAuthState } from '../../state/auth.store.js';
import { formatDateTime } from '../../utils/date.js';
import { mapFirebaseError } from '../../utils/firebase-error.js';
import { escapeHtml, optionList } from '../../utils/html.js';
import { validateStudentForm } from '../../utils/validators.js';
import { renderAlert } from '../components/Alert.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderStageBadge } from '../components/StageBadge.js';
import { renderStatusBadge } from '../components/StatusBadge.js';
import { renderStudentFormModal } from '../components/StudentFormModal.js';
import { showToast } from '../components/ToastStack.js';

function renderStudentFilters({ filters, classes }) {
  return `
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-4">
            <label class="form-label">Lớp</label>
            <select class="form-select" name="classFilter">
              <option value="">Tất cả lớp</option>
              ${optionList(classes, (item) => item.classCode, (item) => `${item.classCode} - ${item.className}`, filters.classFilter)}
            </select>
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label">Hoạt động</label>
            <select class="form-select" name="activityFilter">
              <option value="">Tất cả</option>
              <option value="active" ${filters.activityFilter === 'active' ? 'selected' : ''}>Đang hoạt động</option>
              <option value="inactive" ${filters.activityFilter === 'inactive' ? 'selected' : ''}>Đang tắt</option>
            </select>
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label">Trạng thái hiện tại</label>
            <select class="form-select" name="statusFilter">
              <option value="">Tất cả trạng thái</option>
              ${optionList(STATUSES, (item) => item, (item) => item, filters.statusFilter)}
            </select>
          </div>
          <div class="col-12 col-md-auto ms-md-auto">
            <button type="button" class="btn btn-outline-secondary w-100" data-action="reset-student-filters">
              Đặt lại bộ lọc
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderStudentsTable(students) {
  if (students.length === 0) {
    return renderEmptyState({
      icon: 'people',
      title: 'Chưa có học sinh phù hợp',
      description: 'Hãy thêm học sinh mới hoặc điều chỉnh bộ lọc để xem dữ liệu.',
    });
  }

  const rows = students
    .map(
      (student) => `
        <tr>
          <td>
            <div class="fw-semibold">${escapeHtml(student.fullName)}</div>
            <div class="small text-secondary">${escapeHtml(student.classCode)}</div>
          </td>
          <td>${escapeHtml(student.projectName)}</td>
          <td>${student.currentProgressPercent}%</td>
          <td>${renderStatusBadge(student.currentStatus)}</td>
          <td>${renderStageBadge(student.currentStage)}</td>
          <td>${escapeHtml(formatDateTime(student.lastReportedAt))}</td>
          <td>${student.active ? '<span class="badge text-bg-success">Đang hoạt động</span>' : '<span class="badge text-bg-secondary">Đang tắt</span>'}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-action="edit-student" data-student-id="${escapeHtml(student.id)}">Sửa</button>
          </td>
        </tr>
      `,
    )
    .join('');

  return `
    <div class="card border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>Học sinh</th>
              <th>Dự án</th>
              <th>%</th>
              <th>Trạng thái</th>
              <th>Giai đoạn</th>
              <th>Cập nhật gần nhất</th>
              <th>Hoạt động</th>
              <th class="text-end">Tác vụ</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

export const studentsPage = {
  title: 'Quản lý học sinh',
  async render() {
    const authState = getAuthState();

    return renderAppShell({
      title: 'Quản lý học sinh',
      subtitle: '',
      currentRoute: '/admin/students',
      user: authState.user,
      content: `
        <div class="d-flex justify-content-between align-items-center mb-4 gap-3">
          <div>
            <h2 class="h5 mb-1">Danh sách học sinh</h2>
          </div>
          <button type="button" class="btn btn-primary" id="create-student-button">
            <i class="bi bi-person-plus me-2"></i>Thêm học sinh
          </button>
        </div>
        <div id="students-filter-slot"></div>
        <div id="students-table-slot">${renderLoadingOverlay()}</div>
        <div id="students-modal-slot"></div>
      `,
    });
  },
  async mount() {
    const filterSlot = document.getElementById('students-filter-slot');
    const tableSlot = document.getElementById('students-table-slot');
    const modalSlot = document.getElementById('students-modal-slot');
    const createButton = document.getElementById('create-student-button');
    let classes = [];
    let students = [];
    let currentStudent = null;
    let filters = {
      classFilter: '',
      activityFilter: '',
      statusFilter: '',
    };

    function getFilteredStudents() {
      return students.filter((student) => {
        const byClass = !filters.classFilter || student.classId === filters.classFilter;
        const byActivity =
          !filters.activityFilter ||
          (filters.activityFilter === 'active' && student.active) ||
          (filters.activityFilter === 'inactive' && !student.active);
        const byStatus = !filters.statusFilter || student.currentStatus === filters.statusFilter;

        return byClass && byActivity && byStatus;
      });
    }

    function openModal(student = null) {
      currentStudent = student;
      modalSlot.innerHTML = renderStudentFormModal(classes, student || {});
      const modalEl = document.getElementById('student-form-modal');
      const modal = new window.bootstrap.Modal(modalEl);
      const form = document.getElementById('student-form');
      const alertSlot = document.getElementById('student-form-alert');

      form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const values = {
          fullName: form.elements.fullName.value,
          classId: form.elements.classId.value,
          projectName: form.elements.projectName.value,
          active: form.elements.active.checked,
        };
        const validation = validateStudentForm(values);

        if (!validation.isValid) {
          alertSlot.innerHTML = renderAlert(Object.values(validation.errors).join('<br>'));
          return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;

        try {
          if (currentStudent) {
            await updateStudent(currentStudent.id, values, currentStudent.classId);
            showToast({
              title: 'Cập nhật thành công',
              message: 'Thông tin học sinh đã được lưu.',
              variant: 'success',
            });
          } else {
            await createStudent(values);
            showToast({
              title: 'Thêm thành công',
              message: 'Học sinh mới đã được thêm vào lớp.',
              variant: 'success',
            });
          }

          modal.hide();
        } catch (error) {
          alertSlot.innerHTML = renderAlert(error.message || 'Không thể lưu học sinh lúc này.');
        } finally {
          submitButton.disabled = false;
        }
      });

      modal.show();
    }

    function renderView() {
      filterSlot.innerHTML = renderStudentFilters({ filters, classes });
      tableSlot.innerHTML = renderStudentsTable(getFilteredStudents());
    }

    createButton.addEventListener('click', () => {
      if (classes.length === 0) {
        showToast({
          title: 'Cần tạo lớp trước',
          message: 'Hãy tạo ít nhất một lớp trước khi thêm học sinh.',
          variant: 'warning',
        });
        return;
      }

      openModal(null);
    });

    filterSlot.addEventListener('change', (event) => {
      if (!event.target.name) {
        return;
      }

      filters = {
        ...filters,
        [event.target.name]: event.target.value,
      };
      renderView();
    });

    filterSlot.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action="reset-student-filters"]');

      if (!button) {
        return;
      }

      filters = {
        classFilter: '',
        activityFilter: '',
        statusFilter: '',
      };
      renderView();
    });

    tableSlot.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action="edit-student"]');

      if (!button) {
        return;
      }

      const student = students.find((item) => item.id === button.dataset.studentId) || null;

      if (student) {
        openModal(student);
      }
    });

    const unsubscribers = [
      subscribeClasses(
        (items) => {
          classes = items;
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
        (items) => {
          students = items;
          renderView();
        },
        (error) => {
          tableSlot.innerHTML = renderAlert(mapFirebaseError(error, 'Không tải được danh sách học sinh.'), 'danger');
        },
      ),
    ];

    renderView();

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  },
};
