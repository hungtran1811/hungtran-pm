import { subscribeClasses } from '../../services/classes.service.js';
import { createStudent, subscribeStudents, updateStudent } from '../../services/students.service.js';
import { getAuthState } from '../../state/auth.store.js';
import { mapFirebaseError } from '../../utils/firebase-error.js';
import { escapeHtml, optionList } from '../../utils/html.js';
import { validateStudentForm } from '../../utils/validators.js';
import { renderAlert } from '../components/Alert.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderStudentFormModal } from '../components/StudentFormModal.js';
import { showToast } from '../components/ToastStack.js';

function isOperationalClass(classItem) {
  return classItem?.status === 'active' && !classItem?.hidden;
}

function isArchivedStudentClass(classItem) {
  return !isOperationalClass(classItem);
}

function renderStudentLifecycleBadge(student, classItem) {
  if (classItem?.status === 'completed' || classItem?.status === 'archived') {
    return '<span class="admin-soft-badge admin-soft-badge--primary"><i class="bi bi-mortarboard"></i>Đã hoàn thành khóa</span>';
  }

  if (!student.active) {
    return '<span class="admin-soft-badge admin-soft-badge--muted"><i class="bi bi-pause-circle"></i>Bảo lưu khóa</span>';
  }

  if (classItem?.hidden) {
    return '<span class="admin-soft-badge admin-soft-badge--muted"><i class="bi bi-eye-slash"></i>Đang ẩn</span>';
  }

  return '<span class="admin-soft-badge admin-soft-badge--success"><i class="bi bi-check-circle"></i>Đang hoạt động</span>';
}

function renderStudentFilters({ filters, classes, isArchiveView }) {
  return `
    <div class="admin-list-switch mb-3">
      <div class="admin-segmented-tabs" role="group" aria-label="Chế độ học sinh">
        <button
          type="button"
          class="admin-segmented-tabs__button ${isArchiveView ? '' : 'admin-segmented-tabs__button--active'}"
          data-action="set-student-scope"
          data-scope="active"
        >
          Đang theo dõi
        </button>
        <button
          type="button"
          class="admin-segmented-tabs__button ${isArchiveView ? 'admin-segmented-tabs__button--active' : ''}"
          data-action="set-student-scope"
          data-scope="archive"
        >
          Lưu trữ
        </button>
      </div>
    </div>
    <div class="admin-command-bar mb-4">
      <div class="admin-command-bar__body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-8 col-xl-5">
            <label class="form-label">Lớp</label>
            <select class="form-select" name="classFilter">
              <option value="">Tất cả lớp</option>
              ${optionList(classes, (item) => item.classCode, (item) => `${item.classCode} - ${item.className}`, filters.classFilter)}
            </select>
          </div>
          <div class="col-12 col-md-auto ms-md-auto">
            <button type="button" class="btn btn-outline-secondary w-100" data-action="reset-student-filters">
              <i class="bi bi-arrow-counterclockwise me-2"></i>Đặt lại
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderStudentsList(students, classMap) {
  if (students.length === 0) {
    return renderEmptyState({
      icon: 'people',
      title: 'Chưa có học sinh phù hợp',
      description: 'Thêm học sinh mới hoặc đổi bộ lọc để xem dữ liệu.',
    });
  }

  const items = students
    .map((student) => {
      const classItem = classMap.get(student.classId) || null;
      const progressPercent = Number(student.currentProgressPercent || 0);

      return `
        <article class="admin-student-card">
          <div class="admin-card-main">
            <div>
              <div class="admin-card-title">${escapeHtml(student.fullName)}</div>
              <div class="admin-card-subtitle">${escapeHtml(student.classCode || student.classId)} · ${escapeHtml(
                student.projectName || 'Chưa có dự án',
              )}</div>
            </div>
          </div>

          <div class="admin-card-progress">
            <strong>${progressPercent}%</strong>
            <div class="progress admin-progress">
              <div class="progress-bar" style="width: ${progressPercent}%;"></div>
            </div>
          </div>

          <div class="admin-card-meta">
            ${renderStudentLifecycleBadge(student, classItem)}
          </div>

          <div class="admin-card-actions">
            <button class="btn btn-sm btn-outline-primary" data-action="edit-student" data-student-id="${escapeHtml(student.id)}">
              <i class="bi bi-pencil-square me-1"></i>Sửa
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  return `
    <div class="admin-data-card">
      <div class="admin-student-list">
        ${items}
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
        <section class="admin-page admin-page--students">
          <div class="admin-page__actions">
            <button type="button" class="btn btn-primary" id="create-student-button">
              <i class="bi bi-person-plus me-2"></i>Thêm học sinh
            </button>
          </div>
          <div id="students-filter-slot"></div>
          <div id="students-table-slot">${renderLoadingOverlay()}</div>
          <div id="students-modal-slot"></div>
        </section>
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
      viewScope: 'active',
      classFilter: '',
    };

    function getScopedClasses(viewScope) {
      return classes.filter(viewScope === 'archive' ? isArchivedStudentClass : isOperationalClass);
    }

    function getScopedStudents(viewScope) {
      const allowedClassCodes = new Set(getScopedClasses(viewScope).map((item) => item.classCode));

      return students.filter((student) => allowedClassCodes.has(student.classId));
    }

    function getFilteredStudents(viewScope) {
      return getScopedStudents(viewScope).filter((student) => {
        const byClass = !filters.classFilter || student.classId === filters.classFilter;
        return byClass;
      });
    }

    function getModalClasses(student = null) {
      const operationalClasses = getScopedClasses('active');

      if (!student?.classId) {
        return operationalClasses;
      }

      const currentClass = classes.find((item) => item.classCode === student.classId);

      if (!currentClass || operationalClasses.some((item) => item.classCode === currentClass.classCode)) {
        return operationalClasses;
      }

      return [...operationalClasses, currentClass].sort((left, right) => left.className.localeCompare(right.className, 'vi'));
    }

    function openModal(student = null) {
      currentStudent = student;
      modalSlot.innerHTML = renderStudentFormModal(getModalClasses(student), student || {}, { isEditing: Boolean(student) });
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
          active: currentStudent ? !Boolean(form.elements.coursePaused?.checked) : true,
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
      const availableClasses = getScopedClasses(filters.viewScope);
      const isArchiveView = filters.viewScope === 'archive';
      const classMap = new Map(classes.map((item) => [item.classCode, item]));

      if (filters.classFilter && !availableClasses.some((item) => item.classCode === filters.classFilter)) {
        filters = {
          ...filters,
          classFilter: '',
        };
      }

      filterSlot.innerHTML = renderStudentFilters({ filters, classes: availableClasses, isArchiveView });
      tableSlot.innerHTML = renderStudentsList(getFilteredStudents(filters.viewScope), classMap);
    }

    createButton.addEventListener('click', () => {
      if (getScopedClasses('active').length === 0) {
        showToast({
          title: 'Cần tạo lớp trước',
          message: 'Hãy tạo ít nhất một lớp đang vận hành trước khi thêm học sinh.',
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
      const button = event.target.closest('[data-action]');

      if (!button) {
        return;
      }

      if (button.dataset.action === 'set-student-scope') {
        filters = {
          ...filters,
          viewScope: button.dataset.scope === 'archive' ? 'archive' : 'active',
          classFilter: '',
        };
        renderView();
        return;
      }

      if (button.dataset.action !== 'reset-student-filters') {
        return;
      }

      filters = {
        viewScope: filters.viewScope,
        classFilter: '',
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
