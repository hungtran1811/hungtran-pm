import { escapeHtml } from '../../utils/html.js';

export function renderStatCard({ label, value, icon, tone = 'primary', hint = '' }) {
  const hintMarkup = hint ? `<p class="admin-metric-card__hint mb-0">${escapeHtml(hint)}</p>` : '';

  return `
    <div class="admin-stat-card-slot">
      <div class="admin-metric-card admin-metric-card--${tone}">
        <div>
          <p class="admin-metric-card__label mb-2">${escapeHtml(label)}</p>
          <div class="admin-metric-card__value">${escapeHtml(value)}</div>
          ${hintMarkup}
        </div>
        <div class="admin-metric-card__icon">
          <i class="bi bi-${icon}"></i>
        </div>
      </div>
    </div>
  `;
}
