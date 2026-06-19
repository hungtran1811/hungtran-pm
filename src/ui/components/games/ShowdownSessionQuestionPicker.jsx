import { useMemo, useState } from 'react';
import { Dices, Search } from 'lucide-react';
import { Button } from '../Button.jsx';
import { Input } from '../Field.jsx';
import {
  STARTUP_POOL_CAP,
  getRoundBankPool,
  pickRandomSessionSelection,
  validateSessionQuestionSelection,
} from '../../../lib/showdownQuestionEngine.js';

const ROUND_TABS = [
  { id: 'startup', label: 'Vòng 1 · Khởi động' },
  { id: 'obstacle', label: 'Vòng 2 · Chướng ngại' },
  { id: 'finish', label: 'Vòng 3 · Về đích' },
];

function toggleId(list, id, { max } = {}) {
  const set = new Set(list);
  if (set.has(id)) {
    set.delete(id);
    return [...set];
  }
  if (max != null && set.size >= max) return list;
  set.add(id);
  return [...set];
}

function RoundPanel({
  roundId,
  pool,
  selectedIds,
  onChange,
  matrix,
  studentCount,
  onRandomRound,
}) {
  const [query, setQuery] = useState('');
  const startupCount = matrix.rounds?.startup?.count ?? 5;
  const obstacleCount = matrix.rounds?.obstacle?.count ?? 5;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter(
      (item) =>
        item.id.toLowerCase().includes(q)
        || item.prompt.toLowerCase().includes(q)
        || (item.topic || '').toLowerCase().includes(q),
    );
  }, [pool, query]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  let hint = '';
  if (roundId === 'startup') {
    hint = `Pool vòng 1: chọn các câu vấn đáp sẽ được rút cho HS (tối đa ${STARTUP_POOL_CAP}). Mỗi HS trả lời ${startupCount} câu.`;
    if (studentCount > 0) {
      hint += ` Nên ≥ ${startupCount * studentCount} câu cho ${studentCount} HS.`;
    }
  } else if (roundId === 'obstacle') {
    hint = `Chọn đúng ${obstacleCount} câu — cả lớp làm chung theo thứ tự.`;
  } else {
    hint = 'Chọn các câu code có thể xuất hiện khi GV phát gói 10/20/30đ.';
  }

  const maxSelect = roundId === 'obstacle' ? obstacleCount : undefined;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{hint}</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            className="pl-8"
            placeholder="Tìm theo ID, nội dung, chủ đề..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onRandomRound}>
          <Dices className="h-4 w-4" />
          Rút ngẫu nhiên
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(pool.map((q) => q.id))}
        >
          Chọn tất cả
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
          Bỏ chọn
        </Button>
      </div>
      <p className="text-xs font-medium text-cyan-700 dark:text-cyan-300">
        Đã chọn {selectedIds.length}
        {maxSelect != null ? ` / ${maxSelect}` : ''} · Kho {pool.length} câu
      </p>
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
        {filtered.map((q) => {
          const checked = selectedSet.has(q.id);
          const disabled = !checked && maxSelect != null && selectedIds.length >= maxSelect;
          return (
            <label
              key={q.id}
              className={`flex cursor-pointer gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                disabled ? 'cursor-not-allowed opacity-50' : ''
              } ${checked ? 'bg-cyan-50/80 dark:bg-cyan-500/10' : ''}`}
            >
              <input
                type="checkbox"
                className="mt-1 shrink-0"
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(toggleId(selectedIds, q.id, { max: maxSelect }))}
              />
              <span className="min-w-0 flex-1">
                <span className="font-mono text-xs text-slate-400">{q.id}</span>
                <span className="ml-2 text-xs text-slate-400">{q.topic}</span>
                {q.difficulty ? (
                  <span className="ml-1 text-xs text-slate-400">· {q.difficulty}</span>
                ) : null}
                <p className="line-clamp-2 text-slate-700 dark:text-slate-200">{q.prompt}</p>
              </span>
            </label>
          );
        })}
        {!filtered.length && (
          <p className="py-4 text-center text-sm text-slate-400">Không có câu phù hợp.</p>
        )}
      </div>
    </div>
  );
}

export function ShowdownSessionQuestionPicker({
  matrix,
  bank,
  selection,
  onChange,
  studentCount = 0,
}) {
  const [activeRound, setActiveRound] = useState('startup');

  const pools = useMemo(
    () => ({
      startup: getRoundBankPool(bank, 'startup', matrix),
      obstacle: getRoundBankPool(bank, 'obstacle', matrix),
      finish: getRoundBankPool(bank, 'finish', matrix),
    }),
    [bank, matrix],
  );

  const validation = useMemo(
    () => validateSessionQuestionSelection({ matrix, selection, studentCount }),
    [matrix, selection, studentCount],
  );

  const randomizeRound = (roundId) => {
    const full = pickRandomSessionSelection({ matrix, bank });
    onChange({ ...selection, [roundId]: full[roundId] });
  };

  const randomizeAll = () => {
    onChange(pickRandomSessionSelection({ matrix, bank }));
  };

  const totalSelected =
    (selection?.startup?.length || 0)
    + (selection?.obstacle?.length || 0)
    + (selection?.finish?.length || 0);

  return (
    <div className="card space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            Chọn câu hỏi trong phiên
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            GV chọn trước câu sẽ dùng khi tạo phòng — không rút ngẫu nhiên trừ khi bấm Rút ngẫu nhiên.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={randomizeAll}>
          <Dices className="h-4 w-4" />
          Rút ngẫu nhiên cả 3 vòng
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {ROUND_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveRound(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeRound === tab.id
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {tab.label}
            <span className="ml-1 opacity-80">({selection?.[tab.id]?.length || 0})</span>
          </button>
        ))}
      </div>

      <RoundPanel
        roundId={activeRound}
        pool={pools[activeRound]}
        selectedIds={selection?.[activeRound] || []}
        onChange={(ids) => onChange({ ...selection, [activeRound]: ids })}
        matrix={matrix}
        studentCount={studentCount}
        onRandomRound={() => randomizeRound(activeRound)}
      />

      <div className="space-y-1 border-t border-slate-200 pt-3 text-xs dark:border-slate-700">
        <p className="text-slate-500">
          Tổng {totalSelected} câu đã chọn (V1 pool {selection?.startup?.length || 0} · V2{' '}
          {selection?.obstacle?.length || 0} · V3 kho {selection?.finish?.length || 0})
        </p>
        {validation.warnings.map((w) => (
          <p key={w} className="text-amber-600 dark:text-amber-400">
            ⚠ {w}
          </p>
        ))}
        {validation.errors.map((e) => (
          <p key={e} className="text-red-600 dark:text-red-400">
            ✕ {e}
          </p>
        ))}
        {validation.valid && !validation.warnings.length && (
          <p className="text-green-600 dark:text-green-400">✓ Sẵn sàng tạo phòng với bộ câu này.</p>
        )}
      </div>
    </div>
  );
}

export { validateSessionQuestionSelection };
