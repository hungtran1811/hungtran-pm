import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { Badge } from '../../ui/components/Badge.jsx';
import { Spinner } from '../../ui/components/Spinner.jsx';
import { STATUS_TONES } from '../../constants/index.js';
import { formatDateTime } from '../../lib/firestore.js';
import { subscribeReportsByStudent } from '../../services/reports.service.js';

function ReportHistoryCard({ report }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold tabular-nums text-brand-600 dark:text-brand-400">
              {report.progressPercent}%
            </span>
            <Badge tone={STATUS_TONES[report.status] || 'slate'}>{report.status}</Badge>
            {report.stage && <Badge tone="slate">{report.stage}</Badge>}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {report.submittedAt ? formatDateTime(report.submittedAt) : '—'}
          </p>
        </div>
        <span className="text-xs text-slate-400">{open ? 'Thu gọn' : 'Chi tiết'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3 text-sm dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Đã làm được</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200">{report.doneToday}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mục tiêu tiếp</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200">{report.nextGoal}</p>
          </div>
          {report.difficulties?.trim() && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Khó khăn</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                {report.difficulties}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProgressReportHistory({ studentId }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setReports([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsubscribe = subscribeReportsByStudent(
      studentId,
      (rows) => {
        setReports(rows.filter((r) => r.source !== 'student-snapshot'));
        setLoading(false);
      },
      () => setLoading(false),
      10,
    );
    return unsubscribe;
  }, [studentId]);

  if (loading) {
    return (
      <div className="card flex justify-center p-6">
        <Spinner />
      </div>
    );
  }

  if (reports.length <= 1) return null;

  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-slate-500" />
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">
          Lịch sử báo cáo ({reports.length})
        </h3>
      </div>
      <div className="space-y-2">
        {reports.slice(0, 5).map((report) => (
          <ReportHistoryCard key={report.id} report={report} />
        ))}
      </div>
    </div>
  );
}
