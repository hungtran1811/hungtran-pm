import { escapeHtml, optionList } from '../../utils/html.js';

export function renderStudentFormModal(classes = [], values = {}) {
  return `
    <div class="modal fade" id="student-form-modal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content border-0 shadow">
          <form id="student-form">
            <div class="modal-header">
              <h2 class="modal-title fs-5">Thông tin học sinh</h2>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div id="student-form-alert"></div>
              <div class="row g-3">
                <div class="col-12 col-md-6">
                  <label class="form-label">Họ và tên</label>
                  <input class="form-control" name="fullName" value="${escapeHtml(values.fullName || '')}" required />
                </div>
                <div class="col-12 col-md-6">
                  <label class="form-label">Lớp</label>
                  <select class="form-select" name="classId" required>
                    <option value="">Chọn lớp</option>
                    ${optionList(classes, (item) => item.classCode, (item) => `${item.classCode} - ${item.className}`, values.classId || '')}
                  </select>
                </div>
                <div class="col-12">
                  <label class="form-label">Tên dự án</label>
                  <input class="form-control" name="projectName" value="${escapeHtml(values.projectName || '')}" required />
                </div>
                <div class="col-12">
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="student-active-switch" name="active" ${values.active !== false ? 'checked' : ''} />
                    <label class="form-check-label" for="student-active-switch">Học sinh đang hoạt động</label>
                  </div>
                </div>
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
