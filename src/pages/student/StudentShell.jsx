import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { studentNavIsActive } from '../../lib/studentWorkspace.js';
import { BrandLogo } from '../../ui/components/BrandLogo.jsx';
import { ThemeToggle } from '../../ui/components/ThemeToggle.jsx';
import {
  StudentBottomNav,
  detectActiveStudentSection,
  scrollToStudentSection,
} from './StudentBottomNav.jsx';

const SHELL_WIDTH = 'max-w-[90rem]';

export function StudentShell({
  subtitle,
  right,
  notice,
  bottomNavItems,
  activeLessonSession = null,
  compactMain = false,
  hideSubtitleOnMobile = false,
  children,
}) {
  const location = useLocation();
  const isReadingLesson = activeLessonSession != null;
  const usesPathNav = Boolean(bottomNavItems?.some((item) => item.to));
  const sectionIds = useMemo(
    () =>
      isReadingLesson || usesPathNav
        ? []
        : (bottomNavItems ?? []).map((item) => item.sectionId).filter(Boolean),
    [bottomNavItems, isReadingLesson, usesPathNav],
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
  }, [bottomNavItems, sectionIds]);

  const handleNavSelect = (id) => {
    setActiveNav(id);
    const item = bottomNavItems?.find((nav) => nav.id === id);
    if (item?.sectionId) scrollToStudentSection(item.sectionId);
  };

  const hasBottomNav = Boolean(bottomNavItems?.length) && (!isReadingLesson || usesPathNav);

  return (
    <div className="student-portal min-h-screen bg-canvas text-ink dark:bg-slate-950 dark:text-slate-100">
      <header className="student-header sticky top-0 z-30 border-b border-line bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95">
        <div
          className={`mx-auto flex min-h-[4.5rem] items-center gap-3 px-4 py-2 min-[701px]:px-7 ${SHELL_WIDTH}`}
        >
          <Link
            to="/"
            title="Nhập mã lớp khác"
            className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-xl"
          >
            <BrandLogo size="sm" />
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold leading-none tracking-tight text-ink dark:text-slate-100">
                hungtran<span className="text-brand-600">PM</span>
              </span>
              <span
                className={`mt-1 block truncate text-[11px] text-muted ${
                  hideSubtitleOnMobile ? 'hidden min-[701px]:block' : ''
                }`}
              >
                {subtitle || 'Learning Campus'}
              </span>
            </span>
          </Link>
          {bottomNavItems?.some((item) => item.to) ? (
            <nav className="hidden min-w-0 items-center gap-1 min-[701px]:flex" aria-label="Điều hướng chính">
              {bottomNavItems.filter((item) => item.to).map((item) => (
                <Link
                  key={item.id}
                  to={item.to}
                  aria-current={studentNavIsActive(item.to, location) ? 'page' : undefined}
                  className={`inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                    studentNavIsActive(item.to, location)
                      ? 'bg-brand-50 text-brand-600'
                      : 'text-muted'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
          <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
            {right}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main
        className={`student-main mx-auto overflow-x-clip px-4 ${SHELL_WIDTH} ${
          compactMain
            ? 'pt-2 sm:pt-3'
            : 'pt-5 sm:pt-6'
        } ${
          hasBottomNav
            ? 'student-main-with-nav'
            : compactMain
              ? 'pb-4'
              : 'pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6'
        }`}
      >
        {children}
      </main>
      {notice && (
        <div
          className={`student-game-join-notice pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 ${
            hasBottomNav
              ? 'bottom-[calc(var(--student-bottom-nav-height)+env(safe-area-inset-bottom,0px)+0.75rem)]'
              : 'bottom-[max(1rem,env(safe-area-inset-bottom))]'
          }`}
        >
          <div className="pointer-events-auto w-full max-w-xl">{notice}</div>
        </div>
      )}
      {hasBottomNav && (
        <StudentBottomNav items={bottomNavItems} activeId={activeNav} onSelect={handleNavSelect} />
      )}
    </div>
  );
}
