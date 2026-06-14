import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../../ui/components/BrandLogo.jsx';
import { ThemeToggle } from '../../ui/components/ThemeToggle.jsx';
import {
  StudentBottomNav,
  detectActiveStudentSection,
  scrollToStudentSection,
} from './StudentBottomNav.jsx';

export function StudentShell({ subtitle, right, bottomNavItems, children }) {
  const sectionIds = useMemo(
    () => (bottomNavItems ?? []).map((item) => item.sectionId).filter(Boolean),
    [bottomNavItems],
  );
  const [activeNav, setActiveNav] = useState(bottomNavItems?.[0]?.id ?? '');

  useEffect(() => {
    if (!sectionIds.length) return undefined;

    const onScroll = () => {
      const sectionId = detectActiveStudentSection(sectionIds);
      const item = bottomNavItems?.find((nav) => nav.sectionId === sectionId);
      if (item) setActiveNav(item.id);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sectionIds]);

  const handleNavSelect = (id) => {
    setActiveNav(id);
    const item = bottomNavItems?.find((nav) => nav.id === id);
    if (item?.sectionId) scrollToStudentSection(item.sectionId);
  };

  const hasBottomNav = Boolean(bottomNavItems?.length);

  return (
    <div className="student-portal min-h-screen bg-gradient-to-b from-brand-50/40 via-slate-50 to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <header className="student-header sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:py-3.5">
          <Link
            to="/"
            title="Nhập mã lớp khác"
            className="group flex min-w-0 flex-1 items-center rounded-xl py-0.5 pr-2 transition hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
          >
            <BrandLogo size="md" subtitle={subtitle} />
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {right}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main
        className={`student-main mx-auto max-w-3xl overflow-x-hidden px-4 py-5 sm:py-6 ${
          hasBottomNav ? 'student-main-with-nav' : 'pb-6'
        }`}
      >
        {children}
      </main>
      {hasBottomNav && (
        <StudentBottomNav
          items={bottomNavItems}
          activeId={activeNav}
          onSelect={handleNavSelect}
        />
      )}
    </div>
  );
}
