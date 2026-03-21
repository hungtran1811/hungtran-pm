import { subscribeClasses } from '../../services/classes.service.js';
import { subscribeStudents } from '../../services/students.service.js';
import { getAuthState } from '../../state/auth.store.js';
import { mapFirebaseError } from '../../utils/firebase-error.js';
import { escapeHtml, optionList } from '../../utils/html.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderParentPreviewTable } from '../components/ParentPreviewTable.js';
import { renderStatCard } from '../components/StatCard.js';
import { showToast } from '../components/ToastStack.js';

export const parentPreviewPage = {
  title: 'Dashboard phụ huynh',
  async render() {
    const authState = getAuthState();

    return renderAppShell({
      title: 'Dashboard phụ huynh',
      subtitle: '',
      currentRoute: '/admin/parent-preview',
      user: authState.user,
      content: `
        <div id="parent-preview-filter-slot"></div>
        <div id="parent-preview-content-slot">${renderLoadingOverlay()}</div>
      `,
    });
  },
  async mount() {
    const filterSlot = document.getElementById('parent-preview-filter-slot');
    const contentSlot = document.getElementById('parent-preview-content-slot');
    const state = {
      classes: [],
      students: [],
      selectedClassId: '',
    };

    function renderView() {
      const selectableClasses = state.classes.filter((item) => item.status !== 'archived');

      if (!state.selectedClassId && selectableClasses.length > 0) {
        state.selectedClassId = selectableClasses[0].classCode;
      }

      const classStudents = state.students
        .filter((student) => student.active && student.classId === state.selectedClassId)
        .sort((left, right) => left.fullName.localeCompare(right.fullName, 'vi'));

      filterSlot.innerHTML = `
        <div class="card border-0 shadow-sm mb-4">
          <div class="card-body">
            <div class="row g-3 align-items-end">
              <div class="col-12 col-lg-4">
                <label class="form-label">Chọn lớp để chụp màn hình</label>
                <select id="parent-preview-class-select" class="form-select">
                  ${optionList(selectableClasses, (item) => item.classCode, (item) => `${item.classCode} - ${item.className}`, state.selectedClassId)}
                </select>
              </div>
              <div class="col-12 col-lg-8">
                <div class="h-100 d-flex align-items-end text-secondary small">
                  Dữ liệu hiển thị gọn để chụp màn hình.
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      if (!state.selectedClassId) {
        contentSlot.innerHTML = renderEmptyState({
          icon: 'phone',
          title: 'Chưa có lớp để preview',
          description: 'Hãy tạo lớp và thêm học sinh trước khi dùng chế độ chụp màn hình phụ huynh.',
        });
        return;
      }

      contentSlot.innerHTML = `
        <div class="row g-3 mb-4">
          ${renderStatCard({ label: 'Học sinh hiển thị', value: String(classStudents.length), icon: 'people', tone: 'primary' })}
          ${renderStatCard({ label: 'Cần hỗ trợ', value: String(classStudents.filter((student) => student.currentStatus === 'Cần hỗ trợ').length), icon: 'life-preserver', tone: 'danger' })}
          ${renderStatCard({ label: 'Hoàn thành', value: String(classStudents.filter((student) => student.currentStatus === 'Hoàn thành').length), icon: 'check-circle', tone: 'success' })}
        </div>
        ${
          classStudents.length > 0
            ? renderParentPreviewTable(classStudents)
            : renderEmptyState({
                icon: 'people',
                title: 'Lớp này chưa có học sinh hoạt động',
                description: `Lớp ${escapeHtml(state.selectedClassId)} hiện chưa có dữ liệu hiển thị cho phụ huynh.`,
              })
        }
      `;
    }

    filterSlot.addEventListener('change', (event) => {
      if (event.target.id !== 'parent-preview-class-select') {
        return;
      }

      state.selectedClassId = event.target.value;
      renderView();
    });

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
          contentSlot.innerHTML = renderEmptyState({
            icon: 'exclamation-triangle',
            title: 'Không tải được dữ liệu học sinh',
            description: mapFirebaseError(error, 'Kiểm tra lại quyền truy cập Firestore.'),
          });
        },
      ),
    ];

    renderView();

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  },
};
