import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { Badge } from '../../ui/components/Badge.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { Spinner } from '../../ui/components/Spinner.jsx';
import { STATUS_TONES } from '../../constants/index.js';
import { formatDateTime, getErrorMessage } from '../../lib/firestore.js';
import {
  getReport,
  listReportsByStudent,
  subscribeReportsByStudent,
} from '../../services/reports.service.js';
import { ProjectLinksReadonly } from './ProjectProductLinks.jsx';

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
          <ProjectLinksReadonly
            githubUrl={report.projectGithubUrl}
            canvaUrl={report.projectCanvaUrl}
          />
        </div>
      )}
    </div>
  );
}

function normalizeReports(rows = []) {
  return rows.filter((r) => r && r.source !== 'student-snapshot');
}

async function loadReportsFallback(studentId, latestReportId) {
  try {
    const rows = await listReportsByStudent(studentId, 20);
    if (rows.length) return normalizeReports(rows);
  } catch (error) {
    console.warn('[ProgressReportHistory] listReportsByStudent failed', error);
  }

  if (!latestReportId) return [];
  const latest = await getReport(latestReportId);
  return latest ? normalizeReports([latest]) : [];
}

export function ProgressReportHistory({ studentId, latestReportId = null, embedded = false }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!studentId) {
      setReports([]);
      setError('');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    const unsubscribe = subscribeReportsByStudent(
      studentId,
      (rows) => {
        if (cancelled) return;
        setReports(normalizeReports(rows));
        setError('');
        setLoading(false);
      },
      (err) => {
        if (cancelled) return;
        console.warn('[ProgressReportHistory] subscribe failed, trying one-shot load', err);
        loadReportsFallback(studentId, latestReportId)
          .then((rows) => {
            if (cancelled) return;
            setReports(rows);
            setError(rows.length ? '' : getErrorMessage(err));
          })
          .catch((fallbackErr) => {
            if (cancelled) return;
            setReports([]);
            setError(getErrorMessage(fallbackErr || err));
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      },
      20,
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [studentId, latestReportId]);

  if (loading) {
    return embedded ? (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    ) : (
      <div className="card flex justify-center p-6">
        <Spinner />
      </div>
    );
  }

  if (error && reports.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-7 w-7" />}
        title="Không tải được lịch sử"
        description={error || 'Thử tải lại trang. Nếu vẫn lỗi, báo giáo viên kiểm tra kết nối.'}
      />
    );
  }

  if (reports.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-7 w-7" />}
        title="Chưa có báo cáo"
        description="Các báo cáo tiến độ bạn gửi sẽ hiển thị tại đây."
      />
    );
  }

  const list = (
    <>
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-slate-500" />
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">
          Lịch sử báo cáo ({reports.length})
        </h3>
      </div>
      <div className="space-y-2">
        {reports.map((report) => (
          <ReportHistoryCard key={report.id} report={report} />
        ))}
      </div>
    </>
  );

  if (embedded) {
    return <div className="space-y-3">{list}</div>;
  }

  return <div className="card space-y-3 p-5">{list}</div>;
}
