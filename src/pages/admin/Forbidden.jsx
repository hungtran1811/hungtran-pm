import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { useAuth } from '../../state/auth.store.jsx';

export function ForbiddenPage() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <ShieldAlert className="h-16 w-16 text-amber-500" />
      <h1 className="mt-4 text-xl font-semibold text-slate-800 dark:text-slate-100">
        Không có quyền truy cập
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Tài khoản {user?.email ? <strong>{user.email}</strong> : 'này'} chưa được cấp quyền quản trị.
      </p>
      <Button variant="secondary" className="mt-6" onClick={handleLogout}>
        Đăng nhập tài khoản khác
      </Button>
    </div>
  );
}
