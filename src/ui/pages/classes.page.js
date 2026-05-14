import { CLASS_STATUS_BADGES, CLASS_STATUS_LABELS } from '../../constants/class-statuses.js';
import { completeClass, createClass, subscribeClasses, updateClass } from '../../services/classes.service.js';
import { subscribeStudents } from '../../services/students.service.js';
import { getAuthState } from '../../state/auth.store.js';
import { getClassCompletionStats } from '../../utils/class-completion.js';
import { formatDate } from '../../utils/date.js';
import { mapFirebaseError } from '../../utils/firebase-error.js';
import { escapeHtml } from '../../utils/html.js';
import { validateClassForm } from '../../utils/validators.js';
import { renderAlert } from '../components/Alert.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderClassFormModal } from '../components/ClassFormModal.js';
import { confirmDialog } from '../components/ConfirmDialog.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { showToast } from '../components/ToastStack.js';

function renderClassFilters(filters) {
  return `
    <div class="admin-command-bar mb-4">
      <div class="admin-command-bar__body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-5 col-xl-3">
            <label class="form-label">Trạng thái lớp</label>
            <select class="form-select" name="statusFilter">
              <option value="">Tất cả</option>
              <option value="active" ${filters.statusFilter === 'active' ? 'selected' : ''}>Đang vận hành</option>
              <option value="completed" ${filters.statusFilter === 'completed' ? 'selected' : ''}>Đã hoàn thành</option>
              <option value="archived" ${filters.statusFilter === 'archived' ? 'selected' : ''}>Lưu trữ</option>
            </select>
          </div>
          <div class="col-12 col-md-auto ms-md-auto">
            <button type="button" class="btn btn-outline-secondary w-100" data-action="reset-class-filters">
              <i class="bi bi-arrow-counterclockwise me-2"></i>Đặt lại
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
      ><i class="bi bi-check2-circle me-1"></i>Hoàn thành</button>`,
    );
  }

  if (classItem.status === 'completed') {
    actions.push(
      `<button class="btn btn-sm btn-outline-dark" data-action="archive-class" data-class-id="${escapeHtml(classItem.id)}"><i class="bi bi-archive me-1"></i>Lưu trữ</button>`,
    );
  }

  if (classItem.status === 'archived') {
    actions.push(
      `<button class="btn btn-sm btn-outline-success" data-action="restore-class" data-class-id="${escapeHtml(classItem.id)}"><i class="bi bi-arrow-counterclockwise me-1"></i>Khôi phục</button>`,
    );
  }

  actions.push(
    `<button class="btn btn-sm btn-outline-secondary" data-action="toggle-hidden" data-class-id="${escapeHtml(classItem.id)}">${
      classItem.hidden ? '<i class="bi bi-eye me-1"></i>Bỏ ẩn' : '<i class="bi bi-eye-slash me-1"></i>Ẩn'
    }</button>`,
  );
  actions.push(
    `<button class="btn btn-sm btn-outline-primary" data-action="edit-class" data-class-id="${escapeHtml(classItem.id)}"><i class="bi bi-pencil-square me-1"></i>Sửa</button>`,
  );

  return `<div class="admin-class-card__actions">${actions.join('')}</div>`;
}

function renderClassCard(classItem, completionMap, { compact = false } = {}) {
  const completion = completionMap[classItem.classCode] ?? {
    activeStudentCount: 0,
    completedStudentCount: 0,
    completionReady: false,
  };
  const completionPercent = completion.activeStudentCount
    ? Math.round((completion.completedStudentCount / completion.activeStudentCount) * 100)
    : 0;
  const visibilityMarkup = classItem.hidden
    ? '<span class="admin-soft-badge admin-soft-badge--muted"><i class="bi bi-eye-slash"></i>Đang ẩn</span>'
    : '<span class="admin-soft-badge admin-soft-badge--success"><i class="bi bi-eye"></i>Đang hiển thị</span>';

  if (compact) {
    return `
      <article class="admin-class-card admin-class-card--compact">
        <div class="admin-class-card__top">
          <div>
            <div class="admin-class-card__code">${escapeHtml(classItem.classCode)}</div>
            <div class="admin-class-card__name">${escapeHtml(classItem.className)}</div>
          </div>
          <span class="badge text-bg-${CLASS_STATUS_BADGES[classItem.status] || 'secondary'}">
            ${escapeHtml(CLASS_STATUS_LABELS[classItem.status] || classItem.status)}
          </span>
        </div>
        <div class="admin-class-card__meta">
          <span><i class="bi bi-people"></i>${classItem.studentCount} học sinh</span>
          ${visibilityMarkup}
        </div>
        ${renderClassActions(classItem, completion)}
      </article>
    `;
  }

  return `
    <article class="admin-class-card">
      <div class="admin-class-card__top">
        <div>
          <div class="admin-class-card__code">${escapeHtml(classItem.classCode)}</div>
          <div class="admin-class-card__name">${escapeHtml(classItem.className)}</div>
        </div>
        <span class="badge text-bg-${CLASS_STATUS_BADGES[classItem.status] || 'secondary'}">
          ${escapeHtml(CLASS_STATUS_LABELS[classItem.status] || classItem.status)}
        </span>
      </div>

      <div class="admin-class-card__meta">
        <span><i class="bi bi-people"></i>${classItem.studentCount} học sinh</span>
        ${visibilityMarkup}
      </div>

      <div class="admin-progress-block">
        <div class="d-flex justify-content-between align-items-center gap-2">
          <span>Hoàn thành</span>
          <strong>${completion.completedStudentCount}/${completion.activeStudentCount}</strong>
        </div>
        <div class="progress admin-progress">
          <div class="progress-bar" style="width: ${completionPercent}%;"></div>
        </div>
        ${
          classItem.status === 'active' && completion.completionReady
            ? '<span class="admin-soft-badge admin-soft-badge--success mt-2">Đủ điều kiện hoàn thành</span>'
            : ''
        }
      </div>

      <div class="admin-class-card__dates">
        <span><i class="bi bi-calendar-event"></i>${escapeHtml(formatDate(classItem.startDate))}</span>
        <span><i class="bi bi-calendar-check"></i>${escapeHtml(formatDate(classItem.endDate))}</span>
      </div>

      ${renderClassActions(classItem, completion)}
    </article>
  `;
}

function renderClassGrid(classes, completionMap, { compact = false } = {}) {
  if (classes.length === 0) {
    return renderEmptyState({
      icon: 'collection',
      title: 'Chưa có lớp',
      description: 'Tạo lớp mới hoặc đổi bộ lọc để xem dữ liệu.',
    });
  }

  return `<div class="admin-class-grid ${compact ? 'admin-class-grid--compact' : ''}">${classes
    .map((classItem) => renderClassCard(classItem, completionMap, { compact }))
    .join('')}</div>`;
}

function renderClassSection({ title, classes, completionMap, compact = false, collapsed = false }) {
  const headerMarkup = `
    <div class="admin-section__header">
      <div>
        <h3>${escapeHtml(title)}</h3>
      </div>
      <span class="admin-count-pill">${classes.length} lớp</span>
    </div>
  `;
  const bodyMarkup = renderClassGrid(classes, completionMap, { compact });

  if (collapsed) {
    return `
      <details class="admin-section admin-section--collapsible">
        <summary class="admin-section__summary">
          ${headerMarkup}
        </summary>
        ${bodyMarkup}
      </details>
    `;
  }

  return `
    <section class="admin-section">
      ${headerMarkup}
      ${bodyMarkup}
    </section>
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
        <section class="admin-page admin-page--classes">
          <div class="admin-page__actions">
            <button type="button" class="btn btn-primary" id="create-class-button">
              <i class="bi bi-plus-circle me-2"></i>Tạo lớp mới
            </button>
          </div>
          <div id="classes-filter-slot"></div>
          <div id="classes-table-slot">${renderLoadingOverlay()}</div>
          ${renderClassFormModal()}
        </section>
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
    };

    function getCompletionMap() {
      return classes.reduce((accumulator, classItem) => {
        accumulator[classItem.classCode] = getClassCompletionStats(classItem.classCode, students);
        return accumulator;
      }, {});
    }

    function matchesStatusFilter(classItem) {
      return !filters.statusFilter || classItem.status === filters.statusFilter;
    }

    function getOperationalClasses() {
      return classes.filter((classItem) => classItem.status === 'active' && matchesStatusFilter(classItem));
    }

    function getCompletedClasses() {
      return classes.filter((classItem) => classItem.status === 'completed' && matchesStatusFilter(classItem));
    }

    function getArchivedClasses() {
      return classes.filter((classItem) => classItem.status === 'archived' && matchesStatusFilter(classItem));
    }

    function fillForm(values = {}, isEditing = false) {
      form.reset();
      form.elements.classCode.value = values.classCode || '';
      form.elements.classCode.readOnly = isEditing;
      form.elements.className.value = values.className || '';
      form.elements.status.value = values.status || 'active';
      form.elements.hidden.checked = Boolean(values.hidden);
      document.getElementById('class-form-alert').innerHTML = '';
    }

    function renderView() {
      const completionMap = getCompletionMap();
      const operationalClasses = getOperationalClasses();
      const completedClasses = getCompletedClasses();
      const archivedClasses = getArchivedClasses();
      const sections = [
        { title: 'Đang vận hành', classes: operationalClasses },
        { title: 'Đã hoàn thành', classes: completedClasses, compact: true, collapsed: true },
        { title: 'Lưu trữ', classes: archivedClasses },
      ].filter((section) => section.classes.length > 0);

      filterSlot.innerHTML = renderClassFilters(filters);
      tableSlot.innerHTML =
        sections.length > 0
          ? sections
              .map((section) =>
                renderClassSection({
                  title: section.title,
                  classes: section.classes,
                  completionMap,
                  compact: Boolean(section.compact),
                  collapsed: Boolean(section.collapsed),
                }),
              )
              .join('')
          : renderEmptyState({
              icon: 'collection',
              title: 'Chưa có lớp',
              description: 'Tạo lớp mới hoặc đổi bộ lọc để xem dữ liệu.',
            });
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
      };
      renderView();
    });

    tableSlot.addEventListener('click', async (event) => {
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
          const confirmed = await confirmDialog({
            title: 'Đánh dấu hoàn thành lớp?',
            message: `Lớp ${classItem.classCode} chưa đủ điều kiện hoàn thành (${completion.completedStudentCount}/${completion.activeStudentCount} học sinh đã hoàn thành). Bạn vẫn muốn đánh dấu hoàn thành?`,
            confirmText: 'Đánh dấu hoàn thành',
            variant: 'warning',
          });

          if (!confirmed) {
            return;
          }
        }

        completeClass(classItem.id)
          .then(({ updatedStudentCount }) => {
            showToast({
              title: 'Đã hoàn thành lớp',
              message:
                updatedStudentCount > 0
                  ? `Lớp ${classItem.classCode} đã được chốt 100% hoàn thành cho ${updatedStudentCount} học sinh và ẩn khỏi luồng học sinh.`
                  : `Lớp ${classItem.classCode} đã được đánh dấu hoàn thành và ẩn khỏi luồng học sinh.`,
              variant: 'success',
            });
          })
          .catch((error) => {
            showToast({
              title: 'Không thể cập nhật',
              message: mapFirebaseError(error, 'Không thể đánh dấu hoàn thành cho lớp này.'),
              variant: 'danger',
            });
          });
        return;
      }

      if (button.dataset.action === 'archive-class') {
        saveClassQuick(
          classItem,
          { status: 'archived' },
          'Đã chuyển vào lưu trữ',
          `Lớp ${classItem.classCode} đã được chuyển vào kho lưu trữ.`,
          'Không thể lưu trữ lớp này lúc này.',
        );
        return;
      }

      if (button.dataset.action === 'restore-class') {
        saveClassQuick(
          classItem,
          { status: 'active' },
          'Đã khôi phục lớp',
          `Lớp ${classItem.classCode} đã quay lại danh sách vận hành.`,
          'Không thể khôi phục lớp này lúc này.',
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
            : `Lớp ${classItem.classCode} đã được ẩn khỏi luồng báo cáo chính.`,
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
        startDate: editingClass?.startDate || '',
        endDate: editingClass?.endDate || '',
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
