import { formatDateTime } from '../../utils/date.js';
import { escapeHtml } from '../../utils/html.js';
import { renderStageBadge } from './StageBadge.js';
import { renderStatusBadge } from './StatusBadge.js';

export function renderParentPreviewTable(students) {
  const rows = students
    .map(
      (student) => `
        <tr>
          <td>
            <div class="fw-semibold">${escapeHtml(student.fullName)}</div>
            <div class="small text-secondary">${escapeHtml(student.projectName)}</div>
          </td>
          <td>${student.currentProgressPercent}%</td>
          <td>${renderStatusBadge(student.currentStatus)}</td>
          <td>${renderStageBadge(student.currentStage)}</td>
          <td>${escapeHtml(formatDateTime(student.lastReportedAt))}</td>
          <td class="preview-difficulties">${escapeHtml(student.currentDifficulties || 'Không có')}</td>
        </tr>
      `,
    )
    .join('');

  return `
    <div class="card border-0 shadow-sm">
      <div class="table-responsive">
        <table class="table align-middle mb-0 parent-preview-table">
          <thead class="table-light">
            <tr>
              <th>Học sinh / Dự án</th>
              <th>%</th>
              <th>Trạng thái</th>
              <th>Giai đoạn</th>
              <th>Cập nhật gần nhất</th>
              <th>Khó khăn chính</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}
