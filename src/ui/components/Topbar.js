import { escapeHtml } from '../../utils/html.js';

export function renderTopbar({ title, subtitle, user }) {
  const displayName = user?.displayName || user?.email || 'Admin';
  const subtitleMarkup = subtitle
    ? `<p class="admin-topbar__subtitle mb-0">${escapeHtml(subtitle)}</p>`
    : '';

  return `
    <header class="topbar admin-topbar">
      <div class="container-fluid d-flex flex-column flex-lg-row gap-3 align-items-lg-center justify-content-between">
        <div class="admin-topbar__title-group">
          <div>
            <h1 class="admin-topbar__title mb-1">${escapeHtml(title)}</h1>
            ${subtitleMarkup}
          </div>
        </div>
        <div class="admin-topbar__account">
          <div class="admin-user-pill">
            <span class="admin-user-pill__avatar">${escapeHtml(displayName.slice(0, 1).toUpperCase())}</span>
            <span class="admin-user-pill__text">
              <span class="admin-user-pill__name">${escapeHtml(displayName)}</span>
            </span>
          </div>
          <button type="button" class="btn btn-outline-secondary admin-logout-button" data-action="logout" aria-label="Đăng xuất" title="Đăng xuất">
            <i class="bi bi-box-arrow-right"></i>
          </button>
        </div>
      </div>
    </header>
  `;
}
