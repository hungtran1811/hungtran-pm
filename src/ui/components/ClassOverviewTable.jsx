import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from './Button.jsx';
import { Input } from './Field.jsx';
import { sortClassesByOperationalPriority } from '../../services/classes.service.js';

const PAGE_SIZE = 10;

const STATUS_FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'active', label: 'Đang hoạt động' },
  { id: 'completed', label: 'Đã hoàn thành' },
];

export function ClassOverviewTable({ rows, scopeClasses, showStatus = false }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const classesByCode = useMemo(
    () => Object.fromEntries(scopeClasses.map((c) => [c.classCode, c])),
    [scopeClasses],
  );

  const sortedScope = useMemo(
    () => sortClassesByOperationalPriority(scopeClasses),
    [scopeClasses],
  );

  const rowByCode = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.classCode, r])),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const ordered = sortedScope
      .map((c) => rowByCode[c.classCode])
      .filter(Boolean);

    let list = ordered;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => r.classCode.toLowerCase().includes(q));
    }
    if (showStatus && statusFilter !== 'all') {
      list = list.filter((r) => classesByCode[r.classCode]?.status === statusFilter);
    }
    return list;
  }, [sortedScope, rowByCode, search, showStatus, statusFilter, classesByCode]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, showStatus]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm mã lớp..."
            className="pl-9"
          />
        </div>
        <p className="shrink-0 text-xs text-slate-400">
          {filteredRows.length} lớp
          {search.trim() ? ' khớp' : ''}
        </p>
      </div>

      {showStatus && (
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                statusFilter === f.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {filteredRows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Không tìm thấy lớp phù hợp.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="max-h-[min(420px,50vh)] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                    <th className="bg-white px-3 py-2.5 pr-3 dark:bg-slate-900">Lớp</th>
                    {showStatus && (
                      <th className="bg-white px-3 py-2.5 pr-3 dark:bg-slate-900">Trạng thái</th>
                    )}
                    <th className="bg-white px-3 py-2.5 pr-3 dark:bg-slate-900">HS</th>
                    <th className="bg-white px-3 py-2.5 pr-3 dark:bg-slate-900">Hoàn thành</th>
                    <th className="bg-white px-3 py-2.5 pr-3 dark:bg-slate-900">Tiến độ TB</th>
                    <th className="bg-white px-3 py-2.5 dark:bg-slate-900">Hiểu bài TB</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row) => {
                    const cls = classesByCode[row.classCode];
                    const statusLabel =
                      cls?.status === 'active'
                        ? 'Đang hoạt động'
                        : cls?.status === 'completed'
                          ? 'Đã hoàn thành'
                          : 'Lưu trữ';
                    return (
                      <tr
                        key={row.classCode}
                        className="border-b border-slate-100 dark:border-slate-800"
                      >
                        <td className="px-3 py-2.5 pr-3 font-medium text-slate-800 dark:text-slate-100">
                          {row.classCode}
                        </td>
                        {showStatus && (
                          <td className="px-3 py-2.5 pr-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                cls?.status === 'active'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </td>
                        )}
                        <td className="px-3 py-2.5 pr-3">{row.students}</td>
                        <td className="px-3 py-2.5 pr-3">{row.completionRate}%</td>
                        <td className="px-3 py-2.5 pr-3">{row.avgProgress}%</td>
                        <td className="px-3 py-2.5">{row.avgUnderstanding || '—'}/5</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {filteredRows.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Trang {page}/{totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Trước
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Sau
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
