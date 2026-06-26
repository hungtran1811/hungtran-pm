import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  School,
  Users,
  TrendingUp,
  BookOpen,
  BarChart3,
  ClipboardList,
  Gamepad2,
  Menu,
  Settings,
  X,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../state/auth.store.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { Button } from './Button.jsx';
import { BrandLogo } from './BrandLogo.jsx';

const NAV_ITEMS = [
  { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/admin/classes', label: 'Lớp học', icon: School },
  { to: '/admin/students', label: 'Học sinh', icon: Users },
  { to: '/admin/reports', label: 'Báo cáo học sinh', icon: TrendingUp },
  { to: '/admin/scores', label: 'Điểm số', icon: ClipboardList },
  { to: '/admin/analytics', label: 'Thống kê', icon: BarChart3 },
  { to: '/admin/lessons', label: 'Bài giảng', icon: BookOpen },
  { to: '/admin/games', label: 'Mini game', icon: Gamepad2 },
  { to: '/admin/settings', label: 'Cài đặt', icon: Settings },
];

function navLinkClass(isActive) {
  return [
    'group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] font-medium transition-all',
    isActive
      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25 ring-1 ring-brand-500/40'
      : 'text-slate-700 hover:bg-white hover:text-brand-700 hover:shadow-sm dark:text-slate-200 dark:hover:bg-slate-800/90 dark:hover:text-white',
  ].join(' ');
}

function NavItems({ onNavigate }) {
  return (
    <nav className="space-y-1">
      <p className="mb-2 px-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
        Quản lý
      </p>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) => navLinkClass(isActive)}
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`h-5 w-5 shrink-0 ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-500 group-hover:text-brand-600 dark:text-slate-400 dark:group-hover:text-brand-300'
                  }`}
                />
                {item.label}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

export function AppShell({ title, actions, children }) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="admin-app min-h-screen lg:flex">
      <aside className="admin-sidebar hidden w-[17rem] shrink-0 flex-col border-r border-slate-200/90 bg-gradient-to-b from-white via-brand-50/40 to-slate-100/80 px-3 py-6 shadow-[inset_-1px_0_0_rgba(27,80,242,0.06)] lg:flex dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:shadow-none">
        <div className="rounded-2xl border border-white/80 bg-white/70 px-3 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <BrandLogo size="sm" showWordmark subtitle="Quản trị lớp học" />
        </div>
        <div className="mt-6 flex-1">
          <NavItems />
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <p className="truncate text-xs font-normal text-slate-600 dark:text-slate-300">
            {admin?.email}
          </p>
          <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200/90 bg-white/90 px-4 py-3.5 backdrop-blur-md lg:px-8 dark:border-slate-800 dark:bg-slate-950/90">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => setMobileOpen(true)}
              aria-label="Mở menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 lg:text-2xl dark:text-slate-50">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <ThemeToggle />
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 lg:px-8">{children}</main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="admin-sidebar relative flex h-full w-72 max-w-[85%] flex-col bg-gradient-to-b from-white to-slate-50 px-3 py-6 dark:from-slate-900 dark:to-slate-950">
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
              <BrandLogo size="sm" showWordmark />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Đóng menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 flex-1">
              <NavItems onNavigate={() => setMobileOpen(false)} />
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={handleLogout}>
              Đăng xuất
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}
