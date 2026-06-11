import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './ui/components/ProtectedRoute.jsx';
import { LoginPage } from './pages/admin/Login.jsx';
import { ForbiddenPage } from './pages/admin/Forbidden.jsx';
import { DashboardPage } from './pages/admin/Dashboard.jsx';
import { ClassesPage } from './pages/admin/Classes.jsx';
import { StudentsPage } from './pages/admin/Students.jsx';
import { ReportsHubPage } from './pages/admin/ReportsHub.jsx';
import { LessonsPage } from './pages/admin/Lessons.jsx';
import { AnalyticsPage } from './pages/admin/AnalyticsPage.jsx';
import { ScoresHubPage } from './pages/admin/ScoresHub.jsx';
import { MiniGamesPage } from './pages/admin/MiniGames.jsx';
import { HomePage } from './pages/Home.jsx';
import { StudentPortalPage } from './pages/student/StudentPortal.jsx';
import { NotFoundPage } from './pages/NotFound.jsx';

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
    <ProtectedRoute>
      <AnalyticsPage />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/c/:classCode" element={<StudentPortalPage />} />

      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin/forbidden" element={<ForbiddenPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/classes"
        element={
          <ProtectedRoute>
            <ClassesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students"
        element={
          <ProtectedRoute>
            <StudentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute>
            <ReportsHubPage />
          </ProtectedRoute>
        }
      />
      <Route path="/admin/feedback" element={<LegacyFeedbackRedirect />} />
      <Route
        path="/admin/lessons"
        element={
          <ProtectedRoute>
            <LessonsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/games"
        element={
          <ProtectedRoute>
            <MiniGamesPage />
          </ProtectedRoute>
        }
      />
      <Route path="/admin/analytics" element={<AnalyticsEntry />} />
      <Route
        path="/admin/scores"
        element={
          <ProtectedRoute>
            <ScoresHubPage />
          </ProtectedRoute>
        }
      />
      <Route path="/admin/quiz" element={<LegacyQuizRedirect />} />

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
