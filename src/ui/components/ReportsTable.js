import { formatDateTime } from '../../utils/date.js';
import { escapeHtml } from '../../utils/html.js';
import { renderStageBadge } from './StageBadge.js';
import { renderStatusBadge } from './StatusBadge.js';

export function renderReportsTable(reports, { selectedStudentId = '', showDeleteAction = false } = {}) {
  const items = reports
    .map((report) => {
      const progressPercent = Number(report.progressPercent || 0);

      return `
        <article
          class="admin-report-card ${selectedStudentId === report.studentId ? 'admin-report-card--active' : ''}"
          data-action="select-student"
          data-report-id="${escapeHtml(report.id)}"
          data-student-id="${escapeHtml(report.studentId)}"
          data-student-name="${escapeHtml(report.studentName)}"
          title="Bấm vào card để xem báo cáo"
        >
          <div class="admin-card-main">
            <div>
              <div class="admin-card-title">${escapeHtml(report.studentName)}</div>
              <div class="admin-card-subtitle">${escapeHtml(report.projectName || 'Chưa có tên dự án')}</div>
              <div class="admin-card-subtitle">${escapeHtml(report.classCode)}</div>
            </div>
          </div>

          <div class="admin-card-progress">
            <strong>${progressPercent}%</strong>
            <div class="progress admin-progress">
              <div class="progress-bar" style="width: ${progressPercent}%;"></div>
            </div>
          </div>

          <div class="admin-card-meta">
            ${renderStatusBadge(report.status)}
            ${renderStageBadge(report.stage)}
            <span class="admin-soft-badge admin-soft-badge--muted">
              <i class="bi bi-clock"></i>${escapeHtml(formatDateTime(report.submittedAt))}
            </span>
          </div>

          <div class="admin-card-actions">
            <button
              class="btn btn-sm btn-primary"
              data-action="copy-student-report"
              data-report-id="${escapeHtml(report.id)}"
              data-student-id="${escapeHtml(report.studentId)}"
              data-student-name="${escapeHtml(report.studentName)}"
            >
              <i class="bi bi-clipboard me-1"></i>Copy báo cáo
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
                    <i class="bi bi-trash me-1"></i>Xóa
                  </button>
                `
                : ''
            }
          </div>
        </article>
      `;
    })
    .join('');

  return `
    <div class="admin-data-card">
      <div class="admin-report-list">
        ${items}
      </div>
    </div>
  `;
}
