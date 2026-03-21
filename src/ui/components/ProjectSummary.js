import { formatDateTime, isToday } from '../../utils/date.js';
import { escapeHtml } from '../../utils/html.js';

export function renderProjectSummary(student) {
  if (!student) {
    return `
      <div class="card border-0 shadow-sm h-100">
        <div class="card-body">
          <p class="text-secondary mb-0">Chọn đúng tên của bạn để xem dự án của mình.</p>
        </div>
      </div>
    `;
  }

  const reportedToday = student.lastReportedAt && isToday(student.lastReportedAt);

  return `
    <div class="card border-0 shadow-sm h-100">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start gap-3">
          <div>
            <p class="text-uppercase small fw-semibold text-secondary mb-2">Dự án hiện tại</p>
            <h2 class="h5 mb-1">${escapeHtml(student.projectName || 'Chưa gán dự án')}</h2>
            <p class="text-secondary mb-0">Cập nhật gần nhất: ${escapeHtml(formatDateTime(student.lastReportedAt))}</p>
          </div>
          ${
            reportedToday
              ? '<span class="badge text-bg-warning">Hôm nay đã có báo cáo</span>'
              : '<span class="badge text-bg-light text-dark border">Chưa báo cáo hôm nay</span>'
          }
        </div>
      </div>
    </div>
  `;
}
