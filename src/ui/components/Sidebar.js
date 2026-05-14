import { renderBrandLogo } from './BrandLogo.js';

const NAV_ITEMS = [
  { href: '#/admin/dashboard', label: 'Tổng quan', icon: 'grid-1x2' },
  { href: '#/admin/classes', label: 'Quản lý lớp', icon: 'collection' },
  { href: '#/admin/curriculum', label: 'Học liệu', icon: 'journal-richtext' },
  { href: '#/admin/students', label: 'Quản lý học sinh', icon: 'people' },
  { href: '#/admin/reports', label: 'Báo cáo', icon: 'file-earmark-text' },
];

export function renderSidebar(currentRoute) {
  const items = NAV_ITEMS.map((item) => {
    const active = currentRoute === item.href.replace('#', '') ? 'active' : '';

    return `
      <a class="nav-link ${active}" href="${item.href}">
        <i class="bi bi-${item.icon}"></i>
        <span>${item.label}</span>
      </a>
    `;
  }).join('');

  return `
    <aside class="sidebar">
      <div class="sidebar-brand">
        ${renderBrandLogo({
          className: 'sidebar-brand-lockup',
          tone: 'light',
          compact: true,
        })}
      </div>
      <nav class="nav sidebar-nav">
        ${items}
      </nav>
    </aside>
  `;
}
