import { ensureAdmin, getAuthState, initializeAuthStore } from '../state/auth.store.js';
import { adminDashboardPage } from '../ui/pages/admin-dashboard.page.js';
import { adminLessonPreviewPage } from '../ui/pages/admin-lesson-preview.page.js';
import { adminLoginPage } from '../ui/pages/admin-login.page.js';
import { adminQuizPreviewPage } from '../ui/pages/admin-quiz-preview.page.js';
import { classesPage } from '../ui/pages/classes.page.js';
import { curriculumDemoPage } from '../ui/pages/curriculum-demo.page.js';
import { forbiddenPage } from '../ui/pages/forbidden.page.js';
import { notFoundPage } from '../ui/pages/not-found.page.js';
import { reportsPage } from '../ui/pages/reports.page.js';
import { studentLibraryPage } from '../ui/pages/student-library.page.js';
import { studentQuizPage } from '../ui/pages/student-quiz.page.js';
import { studentReportPage } from '../ui/pages/student-report.page.js';
import { studentsPage } from '../ui/pages/students.page.js';
import { quizzesPage } from '../ui/pages/quizzes.page.js';
import {
  DEFAULT_HASH_ROUTE,
  getHashRouteState,
  getPublicLibraryPathMatch,
  getPublicQuizPathMatch,
  getPublicReportPathMatch,
} from '../utils/route.js';

const ROUTES = {
  '/student/report': { page: studentReportPage },
  '/student/library': { page: studentLibraryPage },
  '/student/quiz': { page: studentQuizPage },
  '/admin/login': { page: adminLoginPage, guestAdminOnly: true },
  '/admin/dashboard': { page: adminDashboardPage, requiresAdmin: true },
  '/admin/classes': { page: classesPage, requiresAdmin: true },
  '/admin/curriculum': { page: curriculumDemoPage, requiresAdmin: true },
  '/admin/lesson-preview': { page: adminLessonPreviewPage, requiresAdmin: true },
  '/admin/quiz-preview': { page: adminQuizPreviewPage, requiresAdmin: true },
  '/admin/quizzes': { page: quizzesPage, requiresAdmin: true },
  '/admin/students': { page: studentsPage, requiresAdmin: true },
  '/admin/reports': { page: reportsPage, requiresAdmin: true },
  '/403': { page: forbiddenPage },
  '/404': { page: notFoundPage },
};

function normalizePath() {
  const hashState = window.location.hash ? getHashRouteState(window.location.hash) : null;
  const hashPath = hashState?.path || '';

  if (hashPath === '/admin/quizzes') {
    window.history.replaceState({}, '', '/#/admin/curriculum?workspace=quiz');
    return '/admin/curriculum';
  }

  if (ROUTES[hashPath] && !['/student/report', '/student/library', '/student/quiz'].includes(hashPath)) {
    return hashPath;
  }

  if (getPublicReportPathMatch(window.location.pathname)) {
    return '/student/report';
  }

  if (getPublicLibraryPathMatch(window.location.pathname)) {
    return '/student/library';
  }

  if (getPublicQuizPathMatch(window.location.pathname)) {
    return '/student/quiz';
  }

  const path = hashPath || DEFAULT_HASH_ROUTE.replace(/^#/, '');
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
