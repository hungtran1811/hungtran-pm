import { Link } from 'react-router-dom';
import { BrandLogo } from '../../ui/components/BrandLogo.jsx';
import { ThemeToggle } from '../../ui/components/ThemeToggle.jsx';

export function StudentShell({ subtitle, right, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 via-slate-50 to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3.5">
          <Link
            to="/"
            title="Nhập mã lớp khác"
            className="group flex min-w-0 items-center rounded-xl py-0.5 pr-2 transition hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
          >
            <BrandLogo size="md" subtitle={subtitle} />
          </Link>
          <div className="flex items-center gap-2">
            {right}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl overflow-x-hidden px-4 py-6 pb-24 sm:pb-6">{children}</main>
    </div>
  );
}
