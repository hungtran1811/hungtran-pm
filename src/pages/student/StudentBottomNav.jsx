import { Link, useLocation } from 'react-router-dom';
import { studentNavIsActive } from '../../lib/studentWorkspace.js';
import { BookOpen, FolderKanban, Gamepad2, House, MessageSquare } from 'lucide-react';

const ICONS = {
  home: House,
  overview: House,
  lessons: BookOpen,
  learn: BookOpen,
  feedback: MessageSquare,
  report: FolderKanban,
  project: FolderKanban,
  submit: FolderKanban,
  games: Gamepad2,
};

export function StudentBottomNav({ items, activeId, onSelect }) {
  const location = useLocation();
  if (!items.length) return null;

  return (
    <nav
      className="student-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-950/95"
      aria-label="Điều hướng nhanh"
    >
      <div className="mx-auto flex max-w-[90rem]">
        {items.map((item) => {
          const Icon = ICONS[item.id] || BookOpen;
          const className = (active) =>
            `flex min-h-[3.25rem] flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
              active
                ? 'text-brand-600 dark:text-brand-300'
                : 'text-slate-500 dark:text-slate-400'
            }`;
          const body = (active) => (
            <>
              <Icon className={`h-5 w-5 ${active ? 'text-brand-600 dark:text-brand-300' : ''}`} />
              <span className="max-w-full truncate">{item.label}</span>
            </>
          );
          if (item.to) {
            return (
              <Link
                key={item.id}
                to={item.to}
                aria-current={studentNavIsActive(item.to, location) ? 'page' : undefined}
                className={className(studentNavIsActive(item.to, location))}
              >
                {body(studentNavIsActive(item.to, location))}
              </Link>
            );
          }
          const active = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onSelect(item.id)}
              className={className(active)}
            >
              {body(active)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function scrollToStudentSection(sectionId) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function detectActiveStudentSection(sectionIds) {
  const offset = 120;
  let active = sectionIds[0];
  for (const id of sectionIds) {
    const el = document.getElementById(id);
    if (!el) continue;
    const top = el.getBoundingClientRect().top;
    if (top <= offset) active = id;
  }
  return active;
}
