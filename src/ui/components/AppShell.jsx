import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  School,
  Settings,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react';
import { useAuth } from '../../state/auth.store.jsx';
import { BrandLogo } from './BrandLogo.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { Button } from './Button.jsx';
import {
  FEATURE_DRIVE_SUBMISSION_ENABLED,
  FEATURE_PROGRESS_REPORTS_ENABLED,
} from '../../config/features.js';

const NAV_ITEMS = [
  { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/admin/classes', label: 'Lớp & bài giảng', icon: School, match: ['/admin/lessons'] },
  { to: '/admin/students', label: 'Học sinh', icon: Users },
  FEATURE_PROGRESS_REPORTS_ENABLED
    ? { to: '/admin/reports', label: 'Báo cáo', icon: TrendingUp }
    : FEATURE_DRIVE_SUBMISSION_ENABLED
      ? { to: '/admin/submissions', label: 'Bài nộp Drive', icon: Upload }
      : null,
  { to: '/admin/games', label: 'Mini game', icon: Gamepad2 },
].filter(Boolean);

function pathMatches(pathname, path, end = false) {
  if (end) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

function itemIsActive(item, pathname) {
  if (pathMatches(pathname, item.to, item.end)) return true;
  return (item.match || []).some((path) => pathMatches(pathname, path));
}

function accountInitials(email = '') {
  const local = String(email).split('@')[0] || '';
  const parts = local.split(/[.\-_]/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (local.slice(0, 2) || 'HT').toUpperCase();
}

function ShellNav({ onNavigate, variant = 'bar' }) {
  const { pathname } = useLocation();
  return (
    <nav
      className={
        variant === 'bottom'
          ? 'fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md min-[701px]:hidden dark:border-slate-800 dark:bg-slate-950/95'
          : 'hidden min-w-0 items-center gap-1 min-[701px]:flex'
      }
      aria-label={variant === 'bottom' ? 'Điều hướng trên điện thoại' : 'Điều hướng chính'}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = itemIsActive(item, pathname);
        const className =
          variant === 'bottom'
            ? `flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium leading-tight ${
                active ? 'text-brand-600' : 'text-muted'
              }`
            : `inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium ${
                active ? 'bg-brand-50 text-brand-600' : 'text-muted hover:bg-brand-50/70 hover:text-ink'
              }`;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={className}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className={variant === 'bottom' ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden="true" />
            <span className="max-w-full truncate">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function AppShell({ title, actions, children }) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  const showClassLinks = pathname.startsWith('/admin/classes') || pathname.startsWith('/admin/lessons');

  useEffect(() => {
    if (!accountOpen) return undefined;
    const onPointerDown = (event) => {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [accountOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="admin-app min-h-screen bg-canvas text-ink dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex min-h-[4.5rem] max-w-[1480px] items-center gap-3 px-4 min-[701px]:gap-5 min-[701px]:px-7">
          <NavLink to="/admin" end className="flex min-w-0 shrink-0 items-center gap-2.5" aria-label="hungtranPM">
            <BrandLogo size="sm" />
            <span className="block text-[15px] font-semibold leading-none tracking-tight">
              hungtran<span className="text-brand-600">PM</span>
            </span>
          </NavLink>
          <ShellNav />
          <div className="relative ml-auto flex items-center gap-2" ref={accountRef}>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full bg-navy text-xs font-semibold text-white"
              aria-label="Không gian riêng của giáo viên"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((open) => !open)}
            >
              {accountInitials(admin?.email)}
            </button>
            {accountOpen ? (
              <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-[17px] border border-line bg-white p-2 shadow-[0_12px_32px_rgba(28,32,78,0.08)] dark:border-slate-700 dark:bg-slate-900">
                <p className="truncate px-2 py-1.5 text-xs text-muted">{admin?.email}</p>
                <NavLink
                  to="/admin/analytics"
                  className="flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm hover:bg-brand-50 dark:hover:bg-slate-800"
                  onClick={() => setAccountOpen(false)}
                >
                  <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  Thống kê
                </NavLink>
                <NavLink
                  to="/admin/settings"
                  className="flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm hover:bg-brand-50 dark:hover:bg-slate-800"
                  onClick={() => setAccountOpen(false)}
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  Cài đặt
                </NavLink>
                <div className="px-2 py-1">
                  <ThemeToggle />
                </div>
                <Button variant="ghost" size="sm" className="w-full" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto min-w-0 max-w-[1480px] overflow-x-hidden px-4 py-6 pb-24 min-[701px]:px-7 min-[701px]:pb-8">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-[1.45rem] font-semibold tracking-tight text-ink min-[701px]:text-[1.9rem] dark:text-slate-50">
            {title}
          </h1>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {showClassLinks ? (
          <div className="mb-4 flex gap-2" aria-label="Lớp và bài giảng">
            <NavLink
              to="/admin/classes"
              className={({ isActive }) =>
                `inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium ${
                  isActive ? 'bg-brand-50 text-brand-600' : 'text-muted hover:bg-white'
                }`
              }
            >
              Lớp
            </NavLink>
            <NavLink
              to="/admin/lessons"
              className={({ isActive }) =>
                `inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium ${
                  isActive ? 'bg-brand-50 text-brand-600' : 'text-muted hover:bg-white'
                }`
              }
            >
              Bài giảng
            </NavLink>
          </div>
        ) : null}
        {children}
      </main>

      <ShellNav variant="bottom" />
    </div>
  );
}
