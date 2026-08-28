import { useMemo } from 'react';
import { rankCrewMvp } from '../../../services/spy.service.js';

export function SpyCrewMvpBoard({
  session,
  participants = [],
  taskProgress = [],
  nameById = null,
  presenting = false,
  compact = false,
  limit = 5,
}) {
  const rows = useMemo(() => {
    if (participants.length) return rankCrewMvp(participants, taskProgress).slice(0, limit);
    const names = nameById instanceof Map ? nameById : new Map();
    return taskProgress
      .map((row) => ({
        studentId: row.id,
        studentName: names.get(row.id) || row.id,
        completedCount: Number(row.completedCount || 0),
      }))
      .filter((row) => row.completedCount > 0)
      .sort((a, b) => b.completedCount - a.completedCount
        || a.studentName.localeCompare(b.studentName, 'vi'))
      .slice(0, limit);
  }, [participants, taskProgress, nameById, limit]);
  const crewTarget = Number(session?.crewTaskTarget || 0);
  const crewCompleted = Number(session?.crewTeamCompleted || 0);
  const crewPercent = crewTarget > 0 ? Math.min(100, Math.round((crewCompleted / crewTarget) * 100)) : 0;

  if (!session || session.mode !== 'crew') return null;

  return (
    <div className={`rounded-2xl border p-4 text-left ${
      presenting
        ? 'border-emerald-400/40 bg-emerald-950/40 text-emerald-50'
        : 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-50'
    }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`font-bold ${presenting ? 'text-lg' : 'text-sm'} text-emerald-800 dark:text-emerald-200`}>
          {compact ? 'Top đóng góp' : 'Bảng MVP — Phi hành đoàn'}
        </p>
        <p className={`tabular-nums ${presenting ? 'text-base' : 'text-xs'} text-emerald-700 dark:text-emerald-300`}>
          Đội: {crewCompleted}/{crewTarget} ({crewPercent}%)
        </p>
      </div>
      {!compact && crewTarget > 0 && (
        <div className={`mt-2 h-2 overflow-hidden rounded-full ${presenting ? 'bg-emerald-900' : 'bg-emerald-200 dark:bg-emerald-900/50'}`}>
          <div className="h-full bg-emerald-500" style={{ width: `${crewPercent}%` }} />
        </div>
      )}
      <ol className={`mt-3 space-y-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
        {rows.length === 0 ? (
          <li className="text-emerald-700/80 dark:text-emerald-300/80">Chưa có ai hoàn thành nhiệm vụ.</li>
        ) : rows.map((row, index) => (
          <li key={row.studentId} className="flex items-center justify-between gap-2">
            <span className="truncate">
              <span className="mr-2 font-bold text-emerald-600 dark:text-emerald-300">#{index + 1}</span>
              {row.studentName}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{row.completedCount}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
