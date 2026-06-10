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
  Menu,
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
];

function NavItems({ onNavigate }) {
  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {item.label}
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
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 lg:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="px-1.5 pt-0.5">
          <BrandLogo size="sm" showWordmark subtitle="Quản trị lớp học" />
        </div>
        <div className="mt-8 flex-1">
          <NavItems />
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
            {admin?.email}
          </p>
          <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:px-8 dark:border-slate-800 dark:bg-slate-950/80">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
              onClick={() => setMobileOpen(true)}
              aria-label="Mở menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-bold text-slate-800 lg:text-xl dark:text-slate-100">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[80%] flex-col bg-white px-4 py-6 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 px-2">
              <BrandLogo size="sm" showWordmark />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
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
