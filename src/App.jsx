import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './ui/components/ProtectedRoute.jsx';
import { FullPageLoader } from './ui/components/Spinner.jsx';
import { LoginPage } from './pages/admin/Login.jsx';
import { ForbiddenPage } from './pages/admin/Forbidden.jsx';
import { HomePage } from './pages/Home.jsx';
import {
  StudentPortalPage,
  StudentPhaseHome,
  StudentLearnRoute,
  StudentProjectRoute,
  StudentLessonsReviewRoute,
  StudentSubmitRoute,
} from './pages/student/StudentPortal.jsx';
import { StudentSubmitHubPage } from './pages/student/StudentSubmitHubPage.jsx';
import { NotFoundPage } from './pages/NotFound.jsx';
import { PrivacyPage } from './pages/Privacy.jsx';
import { ErrorBoundary } from './ui/components/ErrorBoundary.jsx';
import {
  FEATURE_DRIVE_SUBMISSION_ENABLED,
  FEATURE_PROGRESS_REPORTS_ENABLED,
} from './config/features.js';

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
const SettingsPage = lazy(() =>
  import('./pages/admin/Settings.jsx').then((m) => ({ default: m.SettingsPage })),
);
const MiniGamesPage = lazy(() =>
  import('./pages/admin/MiniGames.jsx').then((m) => ({ default: m.MiniGamesPage })),
);
const SubmissionsPage = lazy(() =>
  import('./pages/admin/Submissions.jsx').then((m) => ({ default: m.SubmissionsPage })),
);

function LegacyFeedbackRedirect() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set('tab', 'progress');
  return <Navigate to={`/admin/reports?${params.toString()}`} replace />;
}

function LegacyReportsRedirect() {
  return <Navigate to="/admin/analytics" replace />;
}

function SubmissionsToReportsRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/admin/reports${search}`} replace />;
}

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
  if (legacyTab && ['quiz', 'practice', 'scores'].includes(legacyTab)) {
    params.delete('tab');
    const query = params.toString();
    return <Navigate to={query ? `/admin/analytics?${query}` : '/admin/analytics'} replace />;
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
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/submit" element={<StudentSubmitHubPage />} />
      <Route
        path="/c/:classCode"
        element={
          <ErrorBoundary title="Cổng học sinh gặp sự cố" homeTo="/" variant="student">
            <StudentPortalPage />
          </ErrorBoundary>
        }
      >
        <Route index element={<StudentPhaseHome />} />
        <Route path="learn" element={<StudentLearnRoute />} />
        <Route path="project" element={<StudentProjectRoute />} />
        <Route path="lessons" element={<StudentLessonsReviewRoute />} />
        <Route path="submit" element={<StudentSubmitRoute />} />
      </Route>

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
          FEATURE_PROGRESS_REPORTS_ENABLED ? (
            <AdminSuspense>
              <ReportsHubPage />
            </AdminSuspense>
          ) : (
            <LegacyReportsRedirect />
          )
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
      {FEATURE_DRIVE_SUBMISSION_ENABLED ? (
        <Route
          path="/admin/submissions"
          element={
            FEATURE_PROGRESS_REPORTS_ENABLED ? (
              <SubmissionsToReportsRedirect />
            ) : (
              <AdminSuspense>
                <SubmissionsPage />
              </AdminSuspense>
            )
          }
        />
      ) : null}
      <Route path="/admin/analytics" element={<AnalyticsEntry />} />
      <Route
        path="/admin/settings"
        element={
          <AdminSuspense>
            <SettingsPage />
          </AdminSuspense>
        }
      />
      <Route path="/admin/quiz" element={<Navigate to="/admin/analytics" replace />} />
      <Route path="/admin/scores" element={<Navigate to="/admin/analytics" replace />} />

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
