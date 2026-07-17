import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../state/auth.store.jsx';
import { useAdminCodeSubmissionPurge } from '../../hooks/useAdminCodeSubmissionPurge.js';
import { useToast } from './Toast.jsx';
import { FullPageLoader } from './Spinner.jsx';
import { FEATURE_CODE_UPLOAD_ENABLED } from '../../config/features.js';

export function ProtectedRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();
  const toast = useToast();
  useAdminCodeSubmissionPurge(FEATURE_CODE_UPLOAD_ENABLED && isAdmin, toast);

  if (loading) {
    return <FullPageLoader label="Đang kiểm tra quyền truy cập..." />;
  }

  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace state={{ studentPortalHint: true }} />;
  }

  return children;
}
