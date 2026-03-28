import { STAGES } from '../../constants/stages.js';
import { STATUSES } from '../../constants/statuses.js';
import { escapeHtml, optionList } from '../../utils/html.js';

export function renderReportForm(values = {}, { disabled = false } = {}) {
  const disabledAttr = disabled ? 'disabled' : '';
  const disabledHint = disabled
    ? '<p class="text-secondary small mb-3">Chọn đúng lớp và đúng tên của bạn trước khi gửi báo cáo.</p>'
    : '';

  return `
    <form id="student-report-form" class="card border-0 shadow-sm">
      <div class="card-body">
        <div id="student-report-alert"></div>
        ${disabledHint}
        <div class="row g-3">
          <div class="col-12 col-lg-6">
            <label class="form-label">Đã làm được gì</label>
            <textarea class="form-control" name="doneToday" rows="4" placeholder="Ví dụ: Em đã hoàn thành phần mở đầu, làm xong poster và viết được nội dung cho 2 ý chính." required ${disabledAttr}>${escapeHtml(values.doneToday || '')}</textarea>
          </div>
          <div class="col-12 col-lg-6">
            <label class="form-label">Mục tiêu buổi tiếp theo</label>
            <textarea class="form-control" name="nextGoal" rows="4" placeholder="Ví dụ: Buổi sau em sẽ hoàn thiện phần trình bày, sửa lại hình ảnh và luyện nói rõ hơn." required ${disabledAttr}>${escapeHtml(values.nextGoal || '')}</textarea>
          </div>
          <div class="col-12">
            <label class="form-label">Khó khăn gặp phải</label>
            <textarea class="form-control" name="difficulties" rows="3" placeholder="Ví dụ: Em chưa biết chọn ý nào quan trọng nhất nên phần trình bày còn dài và hơi khó hiểu." ${disabledAttr}>${escapeHtml(values.difficulties || '')}</textarea>
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
