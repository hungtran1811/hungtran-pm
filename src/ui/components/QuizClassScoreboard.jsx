import { Link } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { Badge } from './Badge.jsx';
import { Button } from './Button.jsx';
import { EmptyState } from './EmptyState.jsx';
import { useSettings } from '../../state/settings.store.jsx';

export function QuizClassScoreboard({
  rows,
  classCode,
  sessionLabel,
  compact = false,
  onResetRow,
  resettingId = null,
}) {
  const { scoreTone } = useSettings();

  if (!rows.length) {
    return (
      <EmptyState
        title="Chưa có bài quiz nộp"
        description={
          sessionLabel
            ? `Chưa có học sinh nộp quiz ${sessionLabel}.`
            : 'Học sinh nộp bài sẽ hiện điểm tự động tại đây.'
        }
      />
    );
  }

  if (compact) {
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
            <tr>
              <th className="px-4 py-2.5">Học sinh</th>
              <th className="px-4 py-2.5">Buổi</th>
              <th className="px-4 py-2.5">Điểm</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.slice(0, 8).map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                  {row.studentName}
                </td>
                <td className="px-4 py-2.5 text-slate-500">{row.sessionNumber}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={scoreTone(row.score.percent)}>
                    {row.score.correct}/{row.score.total} ({row.score.percent}%)
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 8 && classCode && (
          <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-800">
            +{rows.length - 8} học sinh ·{' '}
            <Link to={`/admin/scores?tab=quiz&class=${encodeURIComponent(classCode)}`} className="text-brand-600 hover:underline dark:text-brand-300">
              Xem đầy đủ
            </Link>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">
          Bảng điểm quiz {classCode ? `· ${classCode}` : ''}
        </h3>
        {sessionLabel && <p className="mt-0.5 text-xs text-slate-500">{sessionLabel}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
            <tr>
              <th className="px-4 py-2.5">Học sinh</th>
              <th className="px-4 py-2.5">Buổi</th>
              <th className="px-4 py-2.5">Điểm</th>
              {onResetRow && <th className="px-4 py-2.5 text-right">Thao tác</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                  {row.studentName}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.sessionNumber}</td>
                <td className="px-4 py-3">
                  <Badge tone={scoreTone(row.score.percent)}>
                    {row.score.correct}/{row.score.total}
                  </Badge>
                </td>
                {onResetRow && (
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="danger"
                      loading={resettingId === row.id}
                      onClick={() => onResetRow(row)}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
