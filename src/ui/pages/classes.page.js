import { CLASS_STATUS_BADGES, CLASS_STATUS_LABELS, CLASS_STATUSES } from '../../constants/class-statuses.js';
import { createClass, subscribeClasses, updateClass } from '../../services/classes.service.js';
import { getAuthState } from '../../state/auth.store.js';
import { formatDate } from '../../utils/date.js';
import { mapFirebaseError } from '../../utils/firebase-error.js';
import { escapeHtml, optionList } from '../../utils/html.js';
import { validateClassForm } from '../../utils/validators.js';
import { renderAlert } from '../components/Alert.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderClassFormModal } from '../components/ClassFormModal.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { showToast } from '../components/ToastStack.js';

function renderClassFilters(filters) {
  return `
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-4">
            <label class="form-label">Trạng thái</label>
            <select class="form-select" name="statusFilter">
              <option value="">Tất cả trạng thái</option>
              ${optionList(CLASS_STATUSES, (item) => item, (item) => CLASS_STATUS_LABELS[item], filters.statusFilter)}
            </select>
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label">Hiển thị</label>
            <select class="form-select" name="visibilityFilter">
              <option value="">Tất cả</option>
              <option value="visible" ${filters.visibilityFilter === 'visible' ? 'selected' : ''}>Đang hiển thị</option>
              <option value="hidden" ${filters.visibilityFilter === 'hidden' ? 'selected' : ''}>Đang ẩn</option>
            </select>
          </div>
          <div class="col-12 col-md-auto ms-md-auto">
            <button type="button" class="btn btn-outline-secondary w-100" data-action="reset-class-filters">
              Đặt lại bộ lọc
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderClassesTable(classes) {
  if (classes.length === 0) {
    return renderEmptyState({
      icon: 'collection',
      title: 'Chưa có lớp phù hợp',
      description: 'Hãy tạo lớp mới hoặc điều chỉnh bộ lọc để xem dữ liệu.',
    });
  }

  const rows = classes
    .map(
      (classItem) => `
        <tr>
          <td>
            <div class="fw-semibold">${escapeHtml(classItem.classCode)}</div>
            <div class="small text-secondary">${escapeHtml(classItem.className)}</div>
          </td>
          <td>
            <span class="badge text-bg-${CLASS_STATUS_BADGES[classItem.status] || 'secondary'}">
              ${escapeHtml(CLASS_STATUS_LABELS[classItem.status] || classItem.status)}
            </span>
          </td>
          <td>
            ${
              classItem.hidden
                ? '<span class="badge bg-dark-subtle text-dark">Đang ẩn</span>'
                : '<span class="badge text-bg-light text-dark border">Đang hiển thị</span>'
            }
          </td>
          <td>${classItem.studentCount}</td>
          <td>${escapeHtml(formatDate(classItem.startDate))}</td>
          <td>${escapeHtml(formatDate(classItem.endDate))}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-action="edit-class" data-class-id="${escapeHtml(classItem.id)}">Sửa</button>
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
              <th>Lớp</th>
              <th>Trạng thái</th>
              <th>Hiển thị</th>
              <th>Số học sinh</th>
              <th>Bắt đầu</th>
              <th>Kết thúc</th>
              <th class="text-end">Tác vụ</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

export const classesPage = {
  title: 'Quản lý lớp',
  async render() {
    const authState = getAuthState();

    return renderAppShell({
      title: 'Quản lý lớp',
      subtitle: '',
      currentRoute: '/admin/classes',
      user: authState.user,
      content: `
        <div class="d-flex justify-content-between align-items-center mb-4 gap-3">
          <div>
            <h2 class="h5 mb-1">Danh sách lớp</h2>
          </div>
          <button type="button" class="btn btn-primary" id="create-class-button">
            <i class="bi bi-plus-circle me-2"></i>Tạo lớp mới
          </button>
        </div>
        <div id="classes-filter-slot"></div>
        <div id="classes-table-slot">${renderLoadingOverlay()}</div>
        ${renderClassFormModal()}
      `,
    });
  },
  async mount() {
    const filterSlot = document.getElementById('classes-filter-slot');
    const tableSlot = document.getElementById('classes-table-slot');
    const modalEl = document.getElementById('class-form-modal');
    const form = document.getElementById('class-form');
    const modal = new window.bootstrap.Modal(modalEl);
    const createButton = document.getElementById('create-class-button');
    let classes = [];
    let editingClass = null;
    let filters = {
      statusFilter: '',
      visibilityFilter: '',
    };

    function getFilteredClasses() {
      return classes.filter((classItem) => {
        const byStatus = !filters.statusFilter || classItem.status === filters.statusFilter;
        const byVisibility =
          !filters.visibilityFilter ||
          (filters.visibilityFilter === 'hidden' && classItem.hidden) ||
          (filters.visibilityFilter === 'visible' && !classItem.hidden);

        return byStatus && byVisibility;
      });
    }

    function fillForm(values = {}, isEditing = false) {
      form.reset();
      form.elements.classCode.value = values.classCode || '';
      form.elements.classCode.readOnly = isEditing;
      form.elements.className.value = values.className || '';
      form.elements.status.value = values.status || 'active';
      form.elements.startDate.value = values.startDate || '';
      form.elements.endDate.value = values.endDate || '';
      form.elements.hidden.checked = Boolean(values.hidden);
      document.getElementById('class-form-alert').innerHTML = '';
    }

    function renderView() {
      filterSlot.innerHTML = renderClassFilters(filters);
      tableSlot.innerHTML = renderClassesTable(getFilteredClasses());
    }

    createButton.addEventListener('click', () => {
      editingClass = null;
      fillForm({}, false);
      modal.show();
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
      const button = event.target.closest('[data-action="reset-class-filters"]');

      if (!button) {
        return;
      }

      filters = {
        statusFilter: '',
        visibilityFilter: '',
      };
      renderView();
    });

    tableSlot.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action="edit-class"]');

      if (!button) {
        return;
      }

      editingClass = classes.find((item) => item.id === button.dataset.classId) || null;

      if (!editingClass) {
        return;
      }

      fillForm(editingClass, true);
      modal.show();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const values = {
        classCode: form.elements.classCode.value,
        className: form.elements.className.value,
        status: form.elements.status.value,
        startDate: form.elements.startDate.value,
        endDate: form.elements.endDate.value,
        hidden: form.elements.hidden.checked,
      };
      const validation = validateClassForm(values);
      const alertSlot = document.getElementById('class-form-alert');

      if (!validation.isValid) {
        alertSlot.innerHTML = renderAlert(Object.values(validation.errors).join('<br>'));
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;

      try {
        if (editingClass) {
          await updateClass(editingClass.id, values);
          showToast({
            title: 'Lưu thành công',
            message: 'Thông tin lớp đã được cập nhật.',
            variant: 'success',
          });
        } else {
          await createClass(values);
          showToast({
            title: 'Tạo thành công',
            message: 'Lớp mới đã được thêm vào hệ thống.',
            variant: 'success',
          });
        }

        modal.hide();
      } catch (error) {
        alertSlot.innerHTML = renderAlert(error.message || 'Không thể lưu lớp lúc này.');
      } finally {
        submitButton.disabled = false;
      }
    });

    const unsubscribe = subscribeClasses(
      (items) => {
        classes = items;
        renderView();
      },
      (error) => {
        tableSlot.innerHTML = renderAlert(mapFirebaseError(error, 'Không tải được dữ liệu lớp.'), 'danger');
      },
    );

    renderView();

    return () => unsubscribe();
  },
};
