import { CLASS_STATUS_BADGES, CLASS_STATUS_LABELS, CLASS_STATUSES } from '../../constants/class-statuses.js';
import { createClass, subscribeClasses, updateClass } from '../../services/classes.service.js';
import { subscribeStudents } from '../../services/students.service.js';
import { getAuthState } from '../../state/auth.store.js';
import { getClassCompletionStats } from '../../utils/class-completion.js';
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

function renderClassActions(classItem, completion) {
  const actions = [];

  if (classItem.status === 'active') {
    actions.push(
      `<button
        class="btn btn-sm ${completion.completionReady ? 'btn-success' : 'btn-outline-warning'}"
        data-action="mark-completed"
        data-class-id="${escapeHtml(classItem.id)}"
        title="${
          completion.completionReady
            ? 'Đánh dấu hoàn thành'
            : 'Lớp này chưa đủ điều kiện, nhưng admin vẫn có thể chốt thủ công'
        }"
      >Hoàn thành lớp</button>`,
    );
  }

  actions.push(
    `<button class="btn btn-sm btn-outline-secondary" data-action="toggle-hidden" data-class-id="${escapeHtml(classItem.id)}">${
      classItem.hidden ? 'Bỏ ẩn' : 'Ẩn'
    }</button>`,
  );
  actions.push(
    `<button class="btn btn-sm btn-outline-primary" data-action="edit-class" data-class-id="${escapeHtml(classItem.id)}">Sửa</button>`,
  );

  return `<div class="d-flex flex-wrap gap-2 justify-content-end">${actions.join('')}</div>`;
}

function renderClassesTable(classes, completionMap) {
  if (classes.length === 0) {
    return renderEmptyState({
      icon: 'collection',
      title: 'Chưa có lớp phù hợp',
      description: 'Hãy tạo lớp mới hoặc điều chỉnh bộ lọc để xem dữ liệu.',
    });
  }

  const rows = classes
    .map((classItem) => {
      const completion = completionMap[classItem.classCode] ?? {
        activeStudentCount: 0,
        completedStudentCount: 0,
        completionReady: false,
      };

      return `
        <tr>
          <td>
            <div class="fw-semibold">${escapeHtml(classItem.classCode)}</div>
            <div class="small text-secondary">${escapeHtml(classItem.className)}</div>
            <div class="small text-secondary mt-1">
              Hoàn thành: ${completion.completedStudentCount}/${completion.activeStudentCount} học sinh
            </div>
          </td>
          <td>
            <span class="badge text-bg-${CLASS_STATUS_BADGES[classItem.status] || 'secondary'}">
              ${escapeHtml(CLASS_STATUS_LABELS[classItem.status] || classItem.status)}
            </span>
            ${
              classItem.status === 'active' && completion.completionReady
                ? '<div class="mt-2"><span class="badge text-bg-success">Đủ điều kiện hoàn thành</span></div>'
                : ''
            }
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
          <td class="text-end">${renderClassActions(classItem, completion)}</td>
        </tr>
      `;
    })
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
    let students = [];
    let editingClass = null;
    let filters = {
      statusFilter: '',
      visibilityFilter: '',
    };

    function getCompletionMap() {
      return classes.reduce((accumulator, classItem) => {
        accumulator[classItem.classCode] = getClassCompletionStats(classItem.classCode, students);
        return accumulator;
      }, {});
    }

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
      tableSlot.innerHTML = renderClassesTable(getFilteredClasses(), getCompletionMap());
    }

    async function saveClassQuick(classItem, overrides, successTitle, successMessage, errorMessage) {
      try {
        await updateClass(classItem.id, {
          className: classItem.className,
          status: classItem.status,
          hidden: classItem.hidden,
          startDate: classItem.startDate,
          endDate: classItem.endDate,
          ...overrides,
        });

        showToast({
          title: successTitle,
          message: successMessage,
          variant: 'success',
        });
      } catch (error) {
        showToast({
          title: 'Không thể cập nhật',
          message: mapFirebaseError(error, errorMessage),
          variant: 'danger',
        });
      }
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
      const button = event.target.closest('[data-action]');

      if (!button) {
        return;
      }

      const classItem = classes.find((item) => item.id === button.dataset.classId) || null;

      if (!classItem) {
        return;
      }

      if (button.dataset.action === 'edit-class') {
        editingClass = classItem;
        fillForm(editingClass, true);
        modal.show();
        return;
      }

      if (button.dataset.action === 'mark-completed') {
        const completion = getClassCompletionStats(classItem.classCode, students);

        if (!completion.completionReady) {
          const confirmed = window.confirm(
            `Lớp ${classItem.classCode} chưa đủ điều kiện hoàn thành (${completion.completedStudentCount}/${completion.activeStudentCount} học sinh đã hoàn thành). Bạn vẫn muốn đánh dấu hoàn thành?`,
          );

          if (!confirmed) {
            return;
          }
        }

        saveClassQuick(
          classItem,
          { status: 'completed' },
          'Đã cập nhật lớp',
          `Lớp ${classItem.classCode} đã được đánh dấu hoàn thành.`,
          'Không thể đánh dấu hoàn thành cho lớp này.',
        );
        return;
      }

      if (button.dataset.action === 'toggle-hidden') {
        saveClassQuick(
          classItem,
          { hidden: !classItem.hidden },
          'Đã cập nhật hiển thị',
          classItem.hidden
            ? `Lớp ${classItem.classCode} đã được hiển thị lại.`
            : `Lớp ${classItem.classCode} đã được ẩn khỏi danh sách chính.`,
          'Không thể đổi trạng thái hiển thị của lớp này.',
        );
      }
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

    const unsubscribers = [
      subscribeClasses(
        (items) => {
          classes = items;
          renderView();
        },
        (error) => {
          tableSlot.innerHTML = renderAlert(mapFirebaseError(error, 'Không tải được dữ liệu lớp.'), 'danger');
        },
      ),
      subscribeStudents(
        (items) => {
          students = items;
          renderView();
        },
        (error) => {
          showToast({
            title: 'Lỗi dữ liệu',
            message: mapFirebaseError(error, 'Không tải được dữ liệu học sinh để tính tiến độ lớp.'),
            variant: 'danger',
          });
        },
      ),
    ];

    renderView();

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  },
};
