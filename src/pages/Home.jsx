import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/components/Button.jsx';
import { Field, Input } from '../ui/components/Field.jsx';
import { ThemeToggle } from '../ui/components/ThemeToggle.jsx';
import { BrandLogo } from '../ui/components/BrandLogo.jsx';

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [classCode, setClassCode] = useState('');
  const [portalHint, setPortalHint] = useState(false);

  useEffect(() => {
    if (location.state?.studentPortalHint) {
      setPortalHint(true);
      navigate('/', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const code = classCode.trim();
    if (code) {
      navigate(`/c/${encodeURIComponent(code)}`);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-brand-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size="lg" />
          <h1 className="mt-6 text-2xl font-bold text-slate-800 dark:text-slate-50">
            Cổng học sinh
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          {portalHint && (
            <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100">
              Đây là cổng học sinh. Nhập mã lớp bên dưới để vào bài học.
            </p>
          )}
          <Field label="Mã lớp">
            <Input
              value={classCode}
              onChange={(e) => setClassCode(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text').trim();
                if (pasted) {
                  e.preventDefault();
                  setClassCode(pasted);
                }
              }}
              placeholder="Nhập hoặc dán mã lớp..."
              autoFocus
              className="text-lg"
            />
          </Field>
          <Button type="submit" size="lg" className="w-full min-h-12 text-base shadow-md" disabled={!classCode.trim()}>
            Vào lớp
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/admin/login"
            className="text-sm font-medium text-slate-400 transition hover:text-brand-600 dark:hover:text-brand-300"
          >
            Đăng nhập quản trị
          </Link>
        </div>
      </div>
    </div>
  );
}
