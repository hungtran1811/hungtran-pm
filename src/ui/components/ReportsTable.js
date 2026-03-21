import { formatDateTime } from '../../utils/date.js';
import { escapeHtml } from '../../utils/html.js';
import { renderStageBadge } from './StageBadge.js';
import { renderStatusBadge } from './StatusBadge.js';

export function renderReportsTable(reports, { showDeleteAction = false } = {}) {
  const rows = reports
    .map(
      (report) => `
        <tr>
          <td>
            <div class="fw-semibold">${escapeHtml(report.studentName)}</div>
            <div class="small text-secondary">${escapeHtml(report.projectName)}</div>
          </td>
          <td>${escapeHtml(report.classCode)}</td>
          <td>${report.progressPercent}%</td>
          <td>${renderStatusBadge(report.status)}</td>
          <td>${renderStageBadge(report.stage)}</td>
          <td>${escapeHtml(formatDateTime(report.submittedAt))}</td>
          <td class="text-end">
            <div class="d-flex flex-wrap gap-2 justify-content-end">
              <button
                class="btn btn-sm btn-outline-secondary"
                data-action="view-history"
                data-student-id="${escapeHtml(report.studentId)}"
                data-student-name="${escapeHtml(report.studentName)}"
              >
                Lịch sử
              </button>
              ${
                showDeleteAction
                  ? `
                    <button
                      class="btn btn-sm btn-outline-danger"
                      data-action="delete-report"
                      data-report-id="${escapeHtml(report.id)}"
                      data-student-id="${escapeHtml(report.studentId)}"
                      data-student-name="${escapeHtml(report.studentName)}"
                    >
                      Xóa
                    </button>
                  `
                  : ''
              }
            </div>
          </td>
        </tr>
      `,
    )
    .join('');

  return `
    <div class="card border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>Học sinh / Dự án</th>
              <th>Lớp</th>
              <th>%</th>
              <th>Trạng thái</th>
              <th>Giai đoạn</th>
              <th>Cập nhật</th>
              <th class="text-end">Tác vụ</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}
