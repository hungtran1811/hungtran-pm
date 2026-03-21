import { escapeHtml } from '../../utils/html.js';

export function renderStatCard({ label, value, icon, tone = 'primary', hint = '' }) {
  const hintMarkup = hint ? `<p class="text-secondary mb-0 small">${escapeHtml(hint)}</p>` : '';

  return `
    <div class="col-12 col-md-6 col-xl-4">
      <div class="card stat-card border-0 shadow-sm h-100">
        <div class="card-body">
          <div class="d-flex align-items-start justify-content-between">
            <div>
              <p class="text-secondary text-uppercase small fw-semibold mb-2">${escapeHtml(label)}</p>
              <div class="display-6 fw-semibold">${escapeHtml(value)}</div>
              ${hintMarkup}
            </div>
            <div class="stat-icon text-bg-${tone}">
              <i class="bi bi-${icon}"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
