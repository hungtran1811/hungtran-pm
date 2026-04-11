import { STAGES } from '../../constants/stages.js';
import { STATUSES } from '../../constants/statuses.js';
import { escapeHtml, optionList } from '../../utils/html.js';

export function renderReportForm(values = {}, { disabled = false, helperText = '' } = {}) {
  const disabledAttr = disabled ? 'disabled' : '';
  const disabledHint = disabled
    ? '<p class="text-secondary small mb-3">Chọn đúng lớp và đúng tên của bạn trước khi gửi báo cáo.</p>'
    : '';
  const helperMarkup = helperText ? `<p class="text-secondary small mb-3">${escapeHtml(helperText)}</p>` : '';

  return `
    <form id="student-report-form" class="card border-0 shadow-sm">
      <div class="card-body">
        <div id="student-report-alert"></div>
        ${helperMarkup}
        ${disabledHint}
        <div class="row g-3">
          <div class="col-12 col-lg-6">
            <label class="form-label">Đã làm được gì</label>
            <textarea class="form-control" name="doneToday" rows="4" placeholder="Ví dụ: Đã làm được giao diện, hoàn thành nhân vật 1, 2, 3 và thêm chức năng abc." required ${disabledAttr}>${escapeHtml(values.doneToday || '')}</textarea>
          </div>
          <div class="col-12 col-lg-6">
            <label class="form-label">Mục tiêu buổi tiếp theo</label>
            <textarea class="form-control" name="nextGoal" rows="4" placeholder="Ví dụ: Cải thiện giao diện trang chủ và thêm chức năng tìm kiếm, đăng nhập hoặc lưu dữ liệu." required ${disabledAttr}>${escapeHtml(values.nextGoal || '')}</textarea>
          </div>
          <div class="col-12">
            <label class="form-label">Khó khăn gặp phải</label>
            <textarea class="form-control" name="difficulties" rows="3" placeholder="Ví dụ: Em đang gặp khó khăn ở phần đăng ký, đăng nhập hoặc chưa rõ cú pháp chỗ nào nên cần ghi cụ thể để giáo viên hướng dẫn dễ hơn." ${disabledAttr}>${escapeHtml(values.difficulties || '')}</textarea>
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label">% tiến độ sản phẩm</label>
            <input class="form-control" type="number" min="0" max="100" step="1" name="progressPercent" value="${escapeHtml(values.progressPercent ?? '')}" required ${disabledAttr} />
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label">Giai đoạn hiện tại</label>
            <select class="form-select" name="stage" required ${disabledAttr}>
              <option value="">Chọn giai đoạn</option>
              ${optionList(STAGES, (item) => item, (item) => item, values.stage || '')}
            </select>
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label">Trạng thái hiện tại</label>
            <select class="form-select" name="status" required ${disabledAttr}>
              <option value="">Chọn trạng thái</option>
              ${optionList(STATUSES, (item) => item, (item) => item, values.status || '')}
            </select>
          </div>
        </div>
      </div>
      <div class="card-footer bg-white border-0 pt-0 pb-4 px-4">
        <button type="submit" class="btn btn-primary px-4" ${disabledAttr}>
          <i class="bi bi-send me-2"></i>Gửi báo cáo
        </button>
      </div>
    </form>
  `;
}
