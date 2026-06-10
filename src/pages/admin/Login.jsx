import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Field, Input } from '../../ui/components/Field.jsx';
import { ThemeToggle } from '../../ui/components/ThemeToggle.jsx';
import {
  isPopupUnavailable,
  loginWithEmail,
  loginWithGoogle,
  resetPassword,
} from '../../services/auth.service.js';
import { useAuth } from '../../state/auth.store.jsx';
import { getErrorMessage } from '../../lib/firestore.js';
import { useToast } from '../../ui/components/Toast.jsx';
import { BrandLogo } from '../../ui/components/BrandLogo.jsx';

export function LoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isAdmin, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await loginWithEmail(email, password);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error('Nhập email trước.');
      return;
    }
    try {
      await resetPassword(email);
      toast.success('Đã gửi email đặt lại mật khẩu.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      if (isPopupUnavailable(error)) {
        toast.error('Google không chạy trong trình duyệt này. Dùng Email/Mật khẩu hoặc mở Chrome/Edge.');
      } else {
        toast.error(getErrorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-brand-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size="lg" showWordmark />
          <h1 className="mt-6 text-2xl font-bold text-slate-800 dark:text-slate-50">Đăng nhập quản trị</h1>
        </div>

        <form onSubmit={handleEmailLogin} className="card space-y-4 p-6">
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@example.com"
              autoComplete="email"
              required
            />
          </Field>
          <Field label="Mật khẩu">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
            >
              Quên mật khẩu?
            </button>
          </div>

          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Đăng nhập
          </Button>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-xs text-slate-400">hoặc</span>
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={submitting}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
              />
            </svg>
            Đăng nhập với Google
          </Button>
        </form>
      </div>
    </div>
  );
}
