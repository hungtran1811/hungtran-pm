import { renderBrandLogo } from './BrandLogo.js';

const NAV_ITEMS = [
  { href: '#/admin/dashboard', label: 'Tổng quan', icon: 'grid-1x2' },
  { href: '#/admin/analytics', label: 'Phân tích số liệu', icon: 'bar-chart-line' },
  {
    href: '#/admin/classes',
    label: 'Quản lý lớp',
    icon: 'collection',
    children: [
      { href: '#/admin/classes', label: 'Lớp học', icon: 'collection' },
      { href: '#/admin/students', label: 'Học sinh', icon: 'people' },
      { href: '#/admin/reports', label: 'Báo cáo', icon: 'file-earmark-text' },
    ],
  },
  { href: '#/admin/curriculum', label: 'Học liệu', icon: 'journal-richtext' },
];

export function renderSidebar(currentRoute) {
  const items = NAV_ITEMS.map((item) => {
    const childItems = item.children || [];
    const active = currentRoute === item.href.replace('#', '') ||
      childItems.some((child) => currentRoute === child.href.replace('#', ''))
      ? 'active'
      : '';
    const expanded = childItems.length > 0 && active;
    const childrenMarkup = childItems.length > 0
      ? `
        <div class="sidebar-subnav" id="sidebar-group-${item.icon}" ${expanded ? '' : 'hidden'}>
          ${childItems.map((child) => {
            const childActive = currentRoute === child.href.replace('#', '') ? 'active' : '';

            return `
              <a class="sidebar-subnav__link ${childActive}" href="${child.href}">
                <i class="bi bi-${child.icon}"></i>
                <span>${child.label}</span>
              </a>
            `;
          }).join('')}
        </div>
      `
      : '';
    const toggleMarkup = childItems.length > 0
      ? `
        <button
          type="button"
          class="sidebar-group-toggle"
          aria-label="${expanded ? 'Thu gọn' : 'Mở rộng'} ${item.label}"
          aria-expanded="${expanded ? 'true' : 'false'}"
          aria-controls="sidebar-group-${item.icon}"
          data-sidebar-toggle="sidebar-group-${item.icon}"
        >
          <i class="bi bi-chevron-${expanded ? 'up' : 'down'}"></i>
        </button>
      `
      : '';

    return `
      <div class="sidebar-nav-group ${childItems.length > 0 ? 'sidebar-nav-group--nested' : ''}">
        <div class="sidebar-nav-parent">
          <a class="nav-link ${active}" href="${item.href}">
            <i class="bi bi-${item.icon}"></i>
            <span>${item.label}</span>
          </a>
          ${toggleMarkup}
        </div>
        ${childrenMarkup}
      </div>
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

export function attachSidebarInteractions(root = document) {
  const sidebar = root.querySelector?.('.sidebar');

  if (!sidebar || sidebar.dataset.sidebarReady === 'true') {
    return;
  }

  sidebar.dataset.sidebarReady = 'true';
  sidebar.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-sidebar-toggle]');

    if (!toggle) {
      return;
    }

    const target = document.getElementById(toggle.dataset.sidebarToggle);

    if (!target) {
      return;
    }

    const nextExpanded = target.hasAttribute('hidden');
    target.toggleAttribute('hidden', !nextExpanded);
    toggle.setAttribute('aria-expanded', String(nextExpanded));
    toggle.innerHTML = `<i class="bi bi-chevron-${nextExpanded ? 'up' : 'down'}"></i>`;
  });
}
