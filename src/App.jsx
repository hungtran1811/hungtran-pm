import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './ui/components/ProtectedRoute.jsx';
import { FullPageLoader } from './ui/components/Spinner.jsx';
import { LoginPage } from './pages/admin/Login.jsx';
import { ForbiddenPage } from './pages/admin/Forbidden.jsx';
import { HomePage } from './pages/Home.jsx';
import { StudentPortalPage } from './pages/student/StudentPortal.jsx';
import { NotFoundPage } from './pages/NotFound.jsx';
import { ErrorBoundary } from './ui/components/ErrorBoundary.jsx';

const ShowdownPresentationPage = lazy(() =>
  import('./pages/ShowdownPresentationPage.jsx').then((m) => ({ default: m.ShowdownPresentationPage })),
);
const SpyPresentationPage = lazy(() =>
  import('./pages/SpyPresentationPage.jsx').then((m) => ({ default: m.SpyPresentationPage })),
);

const DashboardPage = lazy(() =>
  import('./pages/admin/Dashboard.jsx').then((m) => ({ default: m.DashboardPage })),
);
const ClassesPage = lazy(() =>
  import('./pages/admin/Classes.jsx').then((m) => ({ default: m.ClassesPage })),
);
const StudentsPage = lazy(() =>
  import('./pages/admin/Students.jsx').then((m) => ({ default: m.StudentsPage })),
);
const ReportsHubPage = lazy(() =>
  import('./pages/admin/ReportsHub.jsx').then((m) => ({ default: m.ReportsHubPage })),
);
const LessonsPage = lazy(() =>
  import('./pages/admin/Lessons.jsx').then((m) => ({ default: m.LessonsPage })),
);
const AnalyticsPage = lazy(() =>
  import('./pages/admin/AnalyticsPage.jsx').then((m) => ({ default: m.AnalyticsPage })),
);
const ScoresHubPage = lazy(() =>
  import('./pages/admin/ScoresHub.jsx').then((m) => ({ default: m.ScoresHubPage })),
);
const MiniGamesPage = lazy(() =>
  import('./pages/admin/MiniGames.jsx').then((m) => ({ default: m.MiniGamesPage })),
);

function LegacyFeedbackRedirect() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set('tab', 'feedback');
  return <Navigate to={`/admin/reports?${params.toString()}`} replace />;
}

function LegacyQuizRedirect() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set('tab', 'quiz');
  return <Navigate to={`/admin/scores?${params.toString()}`} replace />;
}

const SCORES_TABS = new Set(['quiz', 'practice', 'scores']);

function AdminSuspense({ children }) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<FullPageLoader label="Đang tải trang..." />}>{children}</Suspense>
    </ProtectedRoute>
  );
}

function AnalyticsEntry() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const legacyTab = params.get('tab');
  if (legacyTab && SCORES_TABS.has(legacyTab)) {
    const scoresTab = legacyTab === 'scores' ? 'quiz' : legacyTab;
    params.set('tab', scoresTab);
    return <Navigate to={`/admin/scores?${params.toString()}`} replace />;
  }
  if (legacyTab && ['overview', 'compare', 'classes'].includes(legacyTab)) {
    params.set('tab', 'active');
    return <Navigate to={`/admin/analytics?${params.toString()}`} replace />;
  }
  return (
    <AdminSuspense>
      <AnalyticsPage />
    </AdminSuspense>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/c/:classCode"
        element={
          <ErrorBoundary title="Cổng học sinh gặp sự cố" homeTo="/" variant="student">
            <StudentPortalPage />
          </ErrorBoundary>
        }
      />

      <Route
        path="/present/:sessionId"
        element={
          <ErrorBoundary title="Màn trình chiếu gặp sự cố" homeTo="/" variant="student">
            <Suspense fallback={<FullPageLoader label="Đang tải màn trình chiếu..." />}>
              <ShowdownPresentationPage />
            </Suspense>
          </ErrorBoundary>
        }
      />

      <Route
        path="/present/spy/:sessionId"
        element={
          <ErrorBoundary title="Màn trình chiếu gặp sự cố" homeTo="/" variant="student">
            <Suspense fallback={<FullPageLoader label="Đang tải màn trình chiếu..." />}>
              <SpyPresentationPage />
            </Suspense>
          </ErrorBoundary>
        }
      />

      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin/forbidden" element={<ForbiddenPage />} />

      <Route
        path="/admin"
        element={
          <AdminSuspense>
            <DashboardPage />
          </AdminSuspense>
        }
      />
      <Route
        path="/admin/classes"
        element={
          <AdminSuspense>
            <ClassesPage />
          </AdminSuspense>
        }
      />
      <Route
        path="/admin/students"
        element={
          <AdminSuspense>
            <StudentsPage />
          </AdminSuspense>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <AdminSuspense>
            <ReportsHubPage />
          </AdminSuspense>
        }
      />
      <Route path="/admin/feedback" element={<LegacyFeedbackRedirect />} />
      <Route
        path="/admin/lessons"
        element={
          <AdminSuspense>
            <LessonsPage />
          </AdminSuspense>
        }
      />
      <Route
        path="/admin/games"
        element={
          <AdminSuspense>
            <MiniGamesPage />
          </AdminSuspense>
        }
      />
      <Route path="/admin/analytics" element={<AnalyticsEntry />} />
      <Route
        path="/admin/scores"
        element={
          <AdminSuspense>
            <ScoresHubPage />
          </AdminSuspense>
        }
      />
      <Route path="/admin/quiz" element={<LegacyQuizRedirect />} />

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
