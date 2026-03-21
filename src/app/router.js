import { ensureAdmin, getAuthState, initializeAuthStore } from '../state/auth.store.js';
import { adminDashboardPage } from '../ui/pages/admin-dashboard.page.js';
import { adminLoginPage } from '../ui/pages/admin-login.page.js';
import { classesPage } from '../ui/pages/classes.page.js';
import { forbiddenPage } from '../ui/pages/forbidden.page.js';
import { notFoundPage } from '../ui/pages/not-found.page.js';
import { parentPreviewPage } from '../ui/pages/parent-preview.page.js';
import { reportsPage } from '../ui/pages/reports.page.js';
import { studentReportPage } from '../ui/pages/student-report.page.js';
import { studentsPage } from '../ui/pages/students.page.js';
import { DEFAULT_HASH_ROUTE } from '../utils/route.js';

const ROUTES = {
  '/student/report': { page: studentReportPage },
  '/admin/login': { page: adminLoginPage, guestAdminOnly: true },
  '/admin/dashboard': { page: adminDashboardPage, requiresAdmin: true },
  '/admin/classes': { page: classesPage, requiresAdmin: true },
  '/admin/students': { page: studentsPage, requiresAdmin: true },
  '/admin/reports': { page: reportsPage, requiresAdmin: true },
  '/admin/parent-preview': { page: parentPreviewPage, requiresAdmin: true },
  '/403': { page: forbiddenPage },
  '/404': { page: notFoundPage },
};

function normalizePath() {
  const hash = window.location.hash || DEFAULT_HASH_ROUTE;
  const path = hash.replace(/^#/, '');
  return ROUTES[path] ? path : '/404';
}

export function createRouter(rootElement) {
  let cleanupCurrentPage = null;

  async function navigate(path) {
    const nextHash = `#${path}`;

    if (window.location.hash === nextHash) {
      await renderCurrentRoute();
      return;
    }

    window.location.hash = nextHash;
  }

  async function renderCurrentRoute() {
    if (cleanupCurrentPage) {
      cleanupCurrentPage();
      cleanupCurrentPage = null;
    }

    const path = normalizePath();
    const route = ROUTES[path];

    await initializeAuthStore();
    const authState = getAuthState();

    if (route.requiresAdmin) {
      const isAdmin = await ensureAdmin();

      if (!authState.user) {
        await navigate('/admin/login');
        return;
      }

      if (!isAdmin) {
        await navigate('/403');
        return;
      }
    }

    if (route.guestAdminOnly && authState.isAdmin) {
      await navigate('/admin/dashboard');
      return;
    }

    document.title = 'hungtranPM';
    rootElement.innerHTML = await route.page.render({
      navigate,
      path,
      authState,
    });

    cleanupCurrentPage =
      (await route.page.mount?.({
        navigate,
        path,
        authState,
      })) || null;
  }

  return {
    start() {
      window.addEventListener('hashchange', renderCurrentRoute);
      return renderCurrentRoute();
    },
    refresh() {
      return renderCurrentRoute();
    },
  };
}
