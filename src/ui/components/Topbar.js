import { renderBrandLogo } from './BrandLogo.js';
import { escapeHtml } from '../../utils/html.js';

export function renderTopbar({ title, subtitle, user }) {
  const displayName = user?.displayName || user?.email || 'Quản trị viên';
  const subtitleMarkup = subtitle
    ? `<p class="text-secondary mb-0">${escapeHtml(subtitle)}</p>`
    : '';

  return `
    <header class="topbar border-bottom bg-white">
      <div class="container-fluid py-3 d-flex flex-column flex-lg-row gap-3 align-items-lg-center justify-content-between">
        <div class="d-flex align-items-start gap-3">
          ${renderBrandLogo({
            className: 'topbar-brand-lockup',
            tone: 'dark',
            compact: true,
          })}
          <div>
            <h1 class="h3 mb-1">${escapeHtml(title)}</h1>
            ${subtitleMarkup}
          </div>
        </div>
        <div class="d-flex align-items-center gap-3">
          <div class="text-end">
            <div class="fw-semibold">${escapeHtml(displayName)}</div>
            <div class="small text-secondary">${escapeHtml(user?.email || '')}</div>
          </div>
          <button type="button" class="btn btn-outline-secondary" data-action="logout">
            <i class="bi bi-box-arrow-right me-2"></i>Đăng xuất
          </button>
        </div>
      </div>
    </header>
  `;
}
