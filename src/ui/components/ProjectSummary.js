import { formatDateTime, isToday } from '../../utils/date.js';
import { escapeHtml } from '../../utils/html.js';

export function renderProjectSummary(student) {
  if (!student) {
    return `
      <div class="student-report-summary-main">
        <div class="student-report-eyebrow">Dự án hiện tại</div>
        <h2>Chọn tên của bạn</h2>
        <p>Chọn đúng họ tên để hệ thống mở dự án và form báo cáo tương ứng.</p>
      </div>
    `;
  }

  const reportedToday = student.lastReportedAt && isToday(student.lastReportedAt);

  return `
    <div class="student-report-summary-main">
      <div class="student-report-eyebrow">Dự án hiện tại</div>
      <div class="student-report-summary-head">
        <div>
          <h2>${escapeHtml(student.projectName || 'Chưa gán dự án')}</h2>
          <p>Cập nhật gần nhất: ${escapeHtml(formatDateTime(student.lastReportedAt))}</p>
        </div>
        ${
          reportedToday
            ? '<span class="badge text-bg-warning">Đã báo cáo hôm nay</span>'
            : '<span class="badge text-bg-light text-dark border">Chưa báo cáo hôm nay</span>'
        }
      </div>
    </div>
  `;
}
