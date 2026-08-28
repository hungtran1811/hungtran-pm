import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import {
  firstProgramForSubject,
  groupProgramsBySubjectAndLevel,
  resolveProgramSubjectMeta,
  subjectsWithPrograms,
} from '../../lib/subjectGroups.js';
import { Input } from './Field.jsx';

export function GroupedProgramSelect({
  programs = [],
  value,
  onChange,
  includeEmpty = false,
  emptyLabel = '— Chưa gán —',
  className = '',
  id,
}) {
  const [subjectId, setSubjectId] = useState('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const subjectOptions = useMemo(() => subjectsWithPrograms(programs), [programs]);

  const subjectFiltered = useMemo(() => {
    if (!subjectId || subjectId === 'all') return programs;
    return programs.filter(
      (program) => resolveProgramSubjectMeta(program.id, program).id === subjectId,
    );
  }, [programs, subjectId]);

  const searchedPrograms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subjectFiltered;
    return subjectFiltered.filter(
      (program) =>
        String(program.name || '').toLowerCase().includes(q) ||
        String(program.id || '').toLowerCase().includes(q),
    );
  }, [subjectFiltered, search]);

  const listGroups = useMemo(
    () => groupProgramsBySubjectAndLevel(searchedPrograms),
    [searchedPrograms],
  );

  const resultCount = listGroups.reduce(
    (sum, group) => sum + group.levels.reduce((inner, level) => inner + level.programs.length, 0),
    0,
  );

  const selected = useMemo(
    () => programs.find((program) => program.id === value) || null,
    [programs, value],
  );

  const selectedLabel = useMemo(() => {
    if (includeEmpty && !value) return emptyLabel;
    if (!selected) return 'Chọn chương trình...';
    return `${selected.name}${selected.active === false ? ' · ẩn' : ''}`;
  }, [includeEmpty, value, emptyLabel, selected]);

  useEffect(() => {
    if (subjectId !== 'all' && !subjectOptions.some((group) => group.id === subjectId)) {
      setSubjectId('all');
    }
  }, [subjectId, subjectOptions]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (event) => {
      const inTrigger = rootRef.current?.contains(event.target);
      const inMenu = menuRef.current?.contains(event.target);
      if (!inTrigger && !inMenu) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handlePointer);
    return () => document.removeEventListener('mousedown', handlePointer);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return undefined;
    }
    const updatePos = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.max(rect.width, 280);
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const maxHeight = Math.min(320, Math.max(160, spaceBelow));
      setMenuPos({
        top: rect.bottom + 6,
        left: Math.max(8, left),
        width,
        maxHeight,
      });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open]);

  const pick = (nextValue) => {
    onChange(nextValue);
    setOpen(false);
    setSearch('');
  };

  const pickSubject = (nextSubjectId) => {
    setSubjectId(nextSubjectId);
    setSearch('');
    if (nextSubjectId === 'all') return;
    const first = firstProgramForSubject(programs, nextSubjectId);
    if (first && first.id !== value) onChange(first.id);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {subjectOptions.length > 2 && (
        <div className="flex flex-wrap gap-1.5">
          {subjectOptions.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => pickSubject(group.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                subjectId === group.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {group.label}
            </button>
          ))}
        </div>
      )}

      <div ref={rootRef} className="relative min-w-0">
        <button
          ref={triggerRef}
          type="button"
          id={id}
          onClick={() => setOpen((prev) => !prev)}
          className="input-base flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span className="min-w-0 truncate text-sm">{selectedLabel}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open &&
          menuPos &&
          createPortal(
            <div
              ref={menuRef}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
              style={{
                position: 'fixed',
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
                zIndex: 80,
              }}
            >
              <div className="border-b border-slate-100 p-2 dark:border-slate-800">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm tên hoặc mã chương trình..."
                    className="pl-9"
                    autoFocus
                  />
                </div>
                <p className="mt-1.5 px-1 text-xs text-slate-400">
                  {resultCount} chương trình
                  {search.trim() ? ' khớp' : ''}
                </p>
              </div>

              <ul
                className="overflow-y-auto py-1"
                style={{ maxHeight: menuPos.maxHeight }}
                role="listbox"
              >
                {includeEmpty && (
                  <li>
                    <button
                      type="button"
                      role="option"
                      aria-selected={!value}
                      onClick={() => pick('')}
                      className={`w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                        !value
                          ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-200'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {emptyLabel}
                    </button>
                  </li>
                )}

                {resultCount === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-slate-400">
                    Không tìm thấy chương trình
                  </li>
                ) : (
                  listGroups.map((group) => (
                    <li key={group.id}>
                      <p className="sticky top-0 z-10 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:bg-slate-800/95">
                        {group.label}
                      </p>
                      {group.levels.map((level) => (
                        <div key={level.id}>
                          <p className="px-3 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {level.label}
                          </p>
                          <ul>
                            {level.programs.map((program) => {
                              const active = value === program.id;
                              return (
                                <li key={program.id}>
                                  <button
                                    type="button"
                                    role="option"
                                    aria-selected={active}
                                    title={program.id}
                                    onClick={() => pick(program.id)}
                                    className={`w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                                      active
                                        ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-200'
                                        : 'text-slate-700 dark:text-slate-200'
                                    }`}
                                  >
                                    <span className="block truncate">
                                      {program.name}
                                      {program.active === false ? ' · ẩn' : ''}
                                    </span>
                                    <span className="mt-0.5 block truncate text-xs text-slate-400">
                                      {program.id}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </li>
                  ))
                )}
              </ul>
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}
