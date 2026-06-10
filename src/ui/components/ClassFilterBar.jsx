import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import {
  filterClassesForAnalytics,
  isArchivedClassStatus,
  sortClassesByOperationalPriority,
} from '../../services/classes.service.js';
import {
  filterClassesBySubject,
  formatClassOptionLabel,
  resolveClassSubject,
  subjectsWithClasses,
  SUBJECT_FILTERS,
} from '../../lib/subjectGroups.js';
import { Input } from './Field.jsx';

export function ClassFilterBar({
  classes,
  value,
  onChange,
  programs = [],
  showArchived = false,
  onShowArchivedChange,
  allowAll = false,
  allLabel = 'Tất cả lớp',
  compact = false,
  showStudentCount = false,
  showSubjectFilter = true,
  includeCompleted = false,
  className = '',
}) {
  const [subjectId, setSubjectId] = useState('all');
  const [classSearch, setClassSearch] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const programsById = useMemo(
    () => Object.fromEntries(programs.map((p) => [p.id, p])),
    [programs],
  );

  const archivedFiltered = useMemo(() => {
    let list;
    if (includeCompleted) list = filterClassesForAnalytics(classes, showArchived);
    else {
      list = classes.filter((c) =>
        showArchived ? isArchivedClassStatus(c.status) : !isArchivedClassStatus(c.status),
      );
    }
    return sortClassesByOperationalPriority(list);
  }, [classes, showArchived, includeCompleted]);

  const subjectOptions = useMemo(
    () => subjectsWithClasses(archivedFiltered, programsById),
    [archivedFiltered, programsById],
  );

  const subjectFiltered = useMemo(
    () => filterClassesBySubject(archivedFiltered, subjectId, programsById),
    [archivedFiltered, subjectId, programsById],
  );

  const searchedClasses = useMemo(() => {
    const q = classSearch.trim().toLowerCase();
    if (!q) return subjectFiltered;
    return subjectFiltered.filter(
      (c) =>
        c.classCode.toLowerCase().includes(q) ||
        String(c.className || '').toLowerCase().includes(q),
    );
  }, [subjectFiltered, classSearch]);

  const useCompact = compact || showArchived || archivedFiltered.length > 12;

  const selectedClass = useMemo(
    () => archivedFiltered.find((c) => c.classCode === value) || null,
    [archivedFiltered, value],
  );

  const selectedLabel = useMemo(() => {
    if (allowAll && value === 'all') return allLabel;
    if (!selectedClass) return 'Chọn lớp...';
    return formatClassOptionLabel(selectedClass, {
      compact: useCompact,
      showCount: showStudentCount,
    });
  }, [allowAll, value, allLabel, selectedClass, useCompact, showStudentCount]);

  const listGroups = useMemo(() => {
    if (subjectId !== 'all' || !showSubjectFilter || subjectOptions.length <= 2) {
      return [{ id: '_all', label: null, items: searchedClasses }];
    }
    const subjectLabels = Object.fromEntries(
      SUBJECT_FILTERS.filter((g) => g.id !== 'all').map((g) => [g.id, g.label]),
    );
    const buckets = new Map();
    searchedClasses.forEach((c) => {
      const sid = resolveClassSubject(c, programsById);
      if (!buckets.has(sid)) buckets.set(sid, []);
      buckets.get(sid).push(c);
    });
    return [...buckets.entries()]
      .sort(([a], [b]) =>
        (subjectLabels[a] || a).localeCompare(subjectLabels[b] || b, 'vi'),
      )
      .map(([sid, items]) => ({
        id: sid,
        label: subjectLabels[sid] || sid,
        items,
      }));
  }, [searchedClasses, subjectId, showSubjectFilter, subjectOptions.length, programsById]);

  const resultCount = listGroups.reduce((sum, g) => sum + g.items.length, 0);

  useEffect(() => {
    if (subjectId !== 'all' && !subjectOptions.some((g) => g.id === subjectId)) {
      setSubjectId('all');
    }
  }, [subjectId, subjectOptions]);

  useEffect(() => {
    if (!subjectFiltered.length) {
      if (allowAll && value !== 'all') onChange('all');
      else if (!allowAll && value) onChange('');
      return;
    }
    const valid = value === 'all' && allowAll;
    if (!valid && !subjectFiltered.some((c) => c.classCode === value)) {
      onChange(allowAll ? 'all' : subjectFiltered[0].classCode);
    }
  }, [subjectFiltered, value, onChange, allowAll]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setClassSearch('');
      }
    };
    document.addEventListener('mousedown', handlePointer);
    return () => document.removeEventListener('mousedown', handlePointer);
  }, [open]);

  const pick = (code) => {
    onChange(code);
    setOpen(false);
    setClassSearch('');
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {showSubjectFilter && subjectOptions.length > 2 && (
        <div className="flex flex-wrap gap-1.5">
          {subjectOptions.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSubjectId(g.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                subjectId === g.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div ref={rootRef} className="relative min-w-0 flex-1 sm:max-w-md">
          <button
            type="button"
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

          {open && (
            <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <div className="border-b border-slate-100 p-2 dark:border-slate-800">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={classSearch}
                    onChange={(e) => setClassSearch(e.target.value)}
                    placeholder="Tìm mã lớp hoặc tên khóa..."
                    className="pl-9"
                    autoFocus
                  />
                </div>
                <p className="mt-1.5 px-1 text-xs text-slate-400">
                  {resultCount} lớp
                  {classSearch.trim() ? ' khớp' : ''}
                </p>
              </div>

              <ul
                className="max-h-60 overflow-y-auto py-1"
                role="listbox"
              >
                {allowAll && (
                  <li>
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === 'all'}
                      onClick={() => pick('all')}
                      className={`w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                        value === 'all'
                          ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-200'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {allLabel}
                    </button>
                  </li>
                )}

                {resultCount === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-slate-400">
                    {showArchived ? 'Không có lớp lưu trữ' : 'Không tìm thấy lớp'}
                  </li>
                ) : (
                  listGroups.map((group) => (
                    <li key={group.id}>
                      {group.label && (
                        <p className="sticky top-0 z-10 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:bg-slate-800/95">
                          {group.label}
                        </p>
                      )}
                      <ul>
                        {group.items.map((c) => {
                          const label = formatClassOptionLabel(c, {
                            compact: useCompact,
                            showCount: showStudentCount,
                          });
                          const active = value === c.classCode;
                          return (
                            <li key={c.id}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={active}
                                title={c.className ? `${c.classCode} · ${c.className}` : c.classCode}
                                onClick={() => pick(c.classCode)}
                                className={`w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                                  active
                                    ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-200'
                                    : 'text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                <span className="block truncate">{label}</span>
                                {includeCompleted && c.status !== 'active' && (
                                  <span className="mt-0.5 block text-xs text-slate-400">
                                    {c.status === 'completed' ? 'Đã hoàn thành' : 'Lưu trữ'}
                                  </span>
                                )}
                                {useCompact && c.className && (
                                  <span className="mt-0.5 block truncate text-xs text-slate-400">
                                    {c.className}
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>

        {onShowArchivedChange && (
          <label className="flex shrink-0 items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => onShowArchivedChange(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Lớp lưu trữ
          </label>
        )}
      </div>
    </div>
  );
}
