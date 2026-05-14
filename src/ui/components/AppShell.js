import { renderSidebar } from './Sidebar.js';
import { renderToastStack } from './ToastStack.js';
import { renderTopbar } from './Topbar.js';

export function renderAppShell({ title, subtitle = '', content = '', currentRoute = '', user = null }) {
  return `
    <div class="admin-shell">
      ${renderSidebar(currentRoute)}
      <div class="admin-main">
        ${renderTopbar({ title, subtitle, user })}
        <main class="admin-content container-fluid">
          ${content}
        </main>
      </div>
      ${renderToastStack()}
    </div>
  `;
}
