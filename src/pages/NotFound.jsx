import { Link } from 'react-router-dom';
import { Button } from '../ui/components/Button.jsx';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <h1 className="mt-4 text-xl font-semibold text-slate-800 dark:text-slate-100">
        Không tìm thấy trang
      </h1>
      <Link to="/" className="mt-6">
        <Button>Về trang chủ</Button>
      </Link>
    </div>
  );
}
