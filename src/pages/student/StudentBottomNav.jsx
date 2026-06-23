import { BookOpen, ClipboardList, LayoutDashboard, MessageSquare } from 'lucide-react';

const ICONS = {
  overview: LayoutDashboard,
  lessons: BookOpen,
  feedback: MessageSquare,
  report: ClipboardList,
};

export function StudentBottomNav({ items, activeId, onSelect }) {
  if (!items.length) return null;

  return (
    <nav
      className="student-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-950/95 sm:hidden"
      aria-label="Điều hướng nhanh"
    >
      <div className="mx-auto flex max-w-3xl">
        {items.map((item) => {
          const Icon = ICONS[item.id] || BookOpen;
          const active = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onSelect(item.id)}
              className={`flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium transition ${
                active
                  ? 'text-brand-600 dark:text-brand-300'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-brand-600 dark:text-brand-300' : ''}`} />
              <span className="max-w-full truncate">{item.label}</span>
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
