import { escapeHtml } from '../../utils/html.js';

const UNDERSTANDING_LEVELS = [
  { value: 1, label: '1 - Chưa hiểu, cần học lại từ đầu' },
  { value: 2, label: '2 - Hiểu một phần nhỏ' },
  { value: 3, label: '3 - Hiểu ý chính, cần luyện thêm' },
  { value: 4, label: '4 - Hiểu tốt, làm được bài cơ bản' },
  { value: 5, label: '5 - Tự tin áp dụng được' },
];

export function renderKnowledgeReportForm(values = {}, { disabled = false, lessonTitle = '' } = {}) {
  const disabledAttr = disabled ? 'disabled' : '';
  const lessonName = lessonTitle || 'Buổi học hiện tại';

  return `
    <form id="student-knowledge-report-form" class="student-report-form-card student-knowledge-form-card">
      <div class="student-report-form-head">
        <div>
          <div class="student-report-eyebrow">Phản hồi buổi học</div>
          <h2>Nội dung buổi học ngày hôm đó</h2>
          <p class="student-knowledge-lesson-name">${escapeHtml(lessonName)}</p>
        </div>
      </div>
      <div id="student-report-alert"></div>
      <div class="student-report-form-grid">
        <div class="student-report-form-field">
          <label class="form-label">Kiến thức đã hiểu <span class="student-required-mark">*</span></label>
          <textarea
            class="form-control"
            name="understoodTopics"
            rows="4"
            maxlength="600"
            required
            ${disabledAttr}
          >${escapeHtml(values.understoodTopics || '')}</textarea>
        </div>
        <div class="student-report-form-field">
          <label class="form-label">Kiến thức chưa rõ <span class="student-required-mark">*</span></label>
          <textarea
            class="form-control"
            name="unclearTopics"
            rows="4"
            maxlength="600"
            required
            ${disabledAttr}
          >${escapeHtml(values.unclearTopics || '')}</textarea>
        </div>
        <div class="student-report-form-field">
          <label class="form-label">Mức độ hiểu bài</label>
          <select class="form-select" name="understandingLevel" required ${disabledAttr}>
            <option value="">Chọn mức độ hiểu bài</option>
            ${UNDERSTANDING_LEVELS.map((item) => `
              <option value="${item.value}" ${Number(values.understandingLevel || 0) === item.value ? 'selected' : ''}>
                ${escapeHtml(item.label)}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="student-report-form-field">
          <label class="form-label">Cần hỗ trợ gì?</label>
          <textarea
            class="form-control"
            name="supportRequest"
            rows="3"
            maxlength="600"
            ${disabledAttr}
          >${escapeHtml(values.supportRequest || '')}</textarea>
        </div>
      </div>
      <div class="student-report-form-foot">
        <button type="submit" class="btn btn-primary" ${disabledAttr}>
          <i class="bi bi-send me-2"></i>Gửi phản hồi
        </button>
      </div>
    </form>
  `;
}
