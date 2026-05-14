import { escapeHtml, optionList } from '../../utils/html.js';

export function renderStudentFormModal(classes = [], values = {}, { isEditing = false } = {}) {
  const reserveMarkup = isEditing
    ? `
      <div class="admin-form-field admin-form-field--wide">
        <div class="form-check form-switch admin-switch-row">
          <input class="form-check-input" type="checkbox" id="student-course-paused-switch" name="coursePaused" ${values.active === false ? 'checked' : ''} />
          <label class="form-check-label" for="student-course-paused-switch">Học sinh bảo lưu khóa</label>
        </div>
      </div>
    `
    : '';

  return `
    <div class="modal fade" id="student-form-modal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered admin-student-modal-dialog">
        <div class="modal-content border-0 shadow admin-modal">
          <form id="student-form">
            <div class="modal-header">
              <h2 class="modal-title fs-5">Thông tin học sinh</h2>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button>
            </div>
            <div class="modal-body">
              <div id="student-form-alert"></div>
              <div class="admin-student-form-grid">
                <div class="admin-form-field">
                  <label class="form-label">Họ và tên</label>
                  <input class="form-control" name="fullName" value="${escapeHtml(values.fullName || '')}" required />
                </div>
                <div class="admin-form-field">
                  <label class="form-label">Lớp</label>
                  <select class="form-select" name="classId" required>
                    <option value="">Chọn lớp</option>
                    ${optionList(classes, (item) => item.classCode, (item) => `${item.classCode} - ${item.className}`, values.classId || '')}
                  </select>
                </div>
                <div class="admin-form-field admin-form-field--wide">
                  <label class="form-label">Tên dự án</label>
                  <input class="form-control" name="projectName" value="${escapeHtml(values.projectName || '')}" required />
                </div>
                ${reserveMarkup}
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Đóng</button>
              <button type="submit" class="btn btn-primary">Lưu học sinh</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}
