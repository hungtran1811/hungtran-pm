import { CLASS_STATUS_LABELS, CLASS_STATUSES } from '../../constants/class-statuses.js';
import { escapeHtml, optionList } from '../../utils/html.js';

export function renderClassFormModal(values = {}) {
  return `
    <div class="modal fade" id="class-form-modal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content border-0 shadow">
          <form id="class-form">
            <div class="modal-header">
              <h2 class="modal-title fs-5">Thông tin lớp</h2>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div id="class-form-alert"></div>
              <div class="row g-3">
                <div class="col-12 col-md-4">
                  <label class="form-label">Mã lớp</label>
                  <input class="form-control text-uppercase" name="classCode" value="${escapeHtml(values.classCode || '')}" required />
                </div>
                <div class="col-12 col-md-8">
                  <label class="form-label">Tên lớp</label>
                  <input class="form-control" name="className" value="${escapeHtml(values.className || '')}" required />
                </div>
                <div class="col-12 col-md-4">
                  <label class="form-label">Trạng thái</label>
                  <select class="form-select" name="status">
                    ${optionList(CLASS_STATUSES, (item) => item, (item) => CLASS_STATUS_LABELS[item], values.status || 'active')}
                  </select>
                </div>
                <div class="col-12 col-md-4">
                  <label class="form-label">Ngày bắt đầu</label>
                  <input class="form-control" type="date" name="startDate" value="${escapeHtml(values.startDate || '')}" />
                </div>
                <div class="col-12 col-md-4">
                  <label class="form-label">Ngày kết thúc</label>
                  <input class="form-control" type="date" name="endDate" value="${escapeHtml(values.endDate || '')}" />
                </div>
                <div class="col-12">
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="class-hidden-switch" name="hidden" ${values.hidden ? 'checked' : ''} />
                    <label class="form-check-label" for="class-hidden-switch">Ẩn lớp khỏi luồng học sinh</label>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Đóng</button>
              <button type="submit" class="btn btn-primary">Lưu lớp</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}
