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
    <aside class="sidebar bg-dark text-white">
      <div class="sidebar-brand px-4 py-4">
        ${renderBrandLogo({
          className: 'sidebar-brand-lockup',
          tone: 'light',
          compact: true,
        })}
      </div>
      <nav class="nav flex-column px-3 gap-2">
        ${items}
      </nav>
      <div class="px-4 py-4 mt-auto text-white-50 small">
        Tối ưu cho giáo viên và quản trị lớp học.
      </div>
    </aside>
  `;
}
