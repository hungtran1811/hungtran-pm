import { STAGES } from '../../constants/stages.js';
import { STATUSES } from '../../constants/statuses.js';
import { escapeHtml, optionList } from '../../utils/html.js';

export function renderReportForm(values = {}, { disabled = false, helperText = '' } = {}) {
  const disabledAttr = disabled ? 'disabled' : '';
  const disabledHint = disabled
    ? '<p class="student-report-form-note">Chọn đúng lớp và đúng tên của bạn trước khi gửi báo cáo.</p>'
    : '';
  const helperMarkup = helperText ? `<p class="student-report-form-note">${escapeHtml(helperText)}</p>` : '';

  return `
    <form id="student-report-form" class="student-report-form-card">
      <div class="student-report-form-head">
        <div>
          <div class="student-report-eyebrow">Báo cáo tiến độ</div>
          <h2>Nội dung hôm nay</h2>
        </div>
      </div>
      <div id="student-report-alert"></div>
      ${helperMarkup}
      ${disabledHint}
      <div class="student-report-form-grid">
        <div class="student-report-form-field">
          <label class="form-label">Đã làm được gì</label>
          <textarea class="form-control" name="doneToday" rows="5" placeholder="Ví dụ: Đã làm được giao diện, hoàn thành nhân vật 1, 2, 3 và thêm chức năng abc." required ${disabledAttr}>${escapeHtml(values.doneToday || '')}</textarea>
        </div>
        <div class="student-report-form-field">
          <label class="form-label">Mục tiêu buổi tiếp theo</label>
          <textarea class="form-control" name="nextGoal" rows="5" placeholder="Ví dụ: Cải thiện giao diện trang chủ và thêm chức năng tìm kiếm, đăng nhập hoặc lưu dữ liệu." required ${disabledAttr}>${escapeHtml(values.nextGoal || '')}</textarea>
        </div>
        <div class="student-report-form-field student-report-form-field--wide">
          <label class="form-label">Khó khăn gặp phải</label>
          <textarea class="form-control" name="difficulties" rows="3" placeholder="Ví dụ: Em đang gặp khó khăn ở phần đăng ký, đăng nhập hoặc chưa rõ cú pháp chỗ nào." ${disabledAttr}>${escapeHtml(values.difficulties || '')}</textarea>
        </div>
        <div class="student-report-form-field">
          <label class="form-label">% tiến độ sản phẩm</label>
          <input class="form-control" type="number" min="0" max="100" step="1" name="progressPercent" value="${escapeHtml(values.progressPercent ?? '')}" required ${disabledAttr} />
        </div>
        <div class="student-report-form-field">
          <label class="form-label">Giai đoạn hiện tại</label>
          <select class="form-select" name="stage" required ${disabledAttr}>
            <option value="">Chọn giai đoạn</option>
            ${optionList(STAGES, (item) => item, (item) => item, values.stage || '')}
          </select>
        </div>
        <div class="student-report-form-field">
          <label class="form-label">Trạng thái hiện tại</label>
          <select class="form-select" name="status" required ${disabledAttr}>
            <option value="">Chọn trạng thái</option>
            ${optionList(STATUSES, (item) => item, (item) => item, values.status || '')}
          </select>
        </div>
      </div>
      <div class="student-report-form-foot">
        <button type="submit" class="btn btn-primary" ${disabledAttr}>
          <i class="bi bi-send me-2"></i>Gửi báo cáo
        </button>
      </div>
    </form>
  `;
}
