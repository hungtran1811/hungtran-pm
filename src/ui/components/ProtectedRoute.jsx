import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../state/auth.store.jsx';
import { FullPageLoader } from './Spinner.jsx';

export function ProtectedRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullPageLoader label="Đang kiểm tra quyền truy cập..." />;
  }

  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  if (!isAdmin) {
    return <Navigate to="/admin/forbidden" replace />;
  }

  return children;
}
