import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import {
  filterClassesForAnalytics,
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

const MAX_SELECTION = 8;

export function ClassComparePicker({
  classes,
  value = [],
  onChange,
  showArchived = false,
  includeCompleted = true,
  className = '',
}) {
  const [subjectId, setSubjectId] = useState('all');
  const [classSearch, setClassSearch] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const pool = useMemo(() => {
    const filtered = includeCompleted
      ? filterClassesForAnalytics(classes, showArchived)
      : classes.filter((c) => c.status === 'active');
    return sortClassesByOperationalPriority(filtered);
  }, [classes, showArchived, includeCompleted]);

  const subjectOptions = useMemo(() => subjectsWithClasses(pool), [pool]);

  const subjectFiltered = useMemo(
    () => filterClassesBySubject(pool, subjectId),
    [pool, subjectId],
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

  const selectedSet = useMemo(() => new Set(value), [value]);

  const listGroups = useMemo(() => {
    if (subjectId !== 'all' || subjectOptions.length <= 2) {
      return [{ id: '_all', label: null, items: searchedClasses }];
    }
    const subjectLabels = Object.fromEntries(
      SUBJECT_FILTERS.filter((g) => g.id !== 'all').map((g) => [g.id, g.label]),
    );
    const buckets = new Map();
    searchedClasses.forEach((c) => {
      const sid = resolveClassSubject(c);
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
  }, [searchedClasses, subjectId, subjectOptions.length]);

  const activeCodes = useMemo(
    () => pool.filter((c) => c.status === 'active').map((c) => c.classCode),
    [pool],
  );

  useEffect(() => {
    if (subjectId !== 'all' && !subjectOptions.some((g) => g.id === subjectId)) {
      setSubjectId('all');
    }
  }, [subjectId, subjectOptions]);

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

  const toggle = (code) => {
    if (selectedSet.has(code)) {
      onChange(value.filter((c) => c !== code));
      return;
    }
    if (value.length >= MAX_SELECTION) return;
    onChange([...value, code]);
  };

  const selectActive = () => {
    onChange(activeCodes.slice(0, MAX_SELECTION));
    setOpen(false);
    setClassSearch('');
  };

  const clearAll = () => onChange([]);

  const triggerLabel =
    value.length === 0
      ? 'Chọn lớp để so sánh...'
      : `${value.length} lớp đã chọn`;

  return (
    <div className={`space-y-2 ${className}`}>
      {subjectOptions.length > 2 && (
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
          >
            <span className="min-w-0 truncate text-sm">{triggerLabel}</span>
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
                    placeholder="Tìm mã lớp..."
                    className="pl-9"
                    autoFocus
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectActive}
                    className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
                  >
                    Chọn lớp đang hoạt động
                  </button>
                  {value.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      Bỏ chọn
                    </button>
                  )}
                </div>
                <p className="mt-1.5 px-1 text-xs text-slate-400">
                  Tối đa {MAX_SELECTION} lớp · {value.length}/{MAX_SELECTION} đã chọn
                </p>
              </div>

              <ul className="max-h-60 overflow-y-auto py-1">
                {searchedClasses.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-slate-400">Không tìm thấy lớp</li>
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
                          const checked = selectedSet.has(c.classCode);
                          const disabled = !checked && value.length >= MAX_SELECTION;
                          const statusHint =
                            c.status === 'active'
                              ? 'Đang hoạt động'
                              : c.status === 'completed'
                                ? 'Đã hoàn thành'
                                : null;
                          return (
                            <li key={c.id}>
                              <label
                                className={`flex cursor-pointer items-start gap-2.5 px-3 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                                  disabled ? 'cursor-not-allowed opacity-50' : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={() => toggle(c.classCode)}
                                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm text-slate-700 dark:text-slate-200">
                                    {formatClassOptionLabel(c, { compact: true })}
                                  </span>
                                  {statusHint && (
                                    <span className="mt-0.5 block text-xs text-slate-400">{statusHint}</span>
                                  )}
                                </span>
                              </label>
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

        {value.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {value.map((code) => (
              <span
                key={code}
                className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"
              >
                {code}
                <button
                  type="button"
                  onClick={() => toggle(code)}
                  className="text-brand-500 hover:text-brand-700"
                  aria-label={`Bỏ ${code}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
