import { useEffect, useState } from 'react';
import { ChevronDown, History } from 'lucide-react';
import { Badge } from '../../ui/components/Badge.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { Spinner } from '../../ui/components/Spinner.jsx';
import { STAGE_TONES, STATUS_TONES } from '../../constants/index.js';
import { formatDateTime, getErrorMessage } from '../../lib/firestore.js';
import { formatLessonKey } from '../../lib/submissionFileName.js';
import {
  getReport,
  listReportsByStudent,
  subscribeReportsByStudent,
} from '../../services/reports.service.js';
import { StudentTextBlock } from '../../ui/components/StudentTextBlock.jsx';
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
            {report.lessonKey && <Badge tone="slate">{formatLessonKey(report.lessonKey)}</Badge>}
            {report.stage && <Badge tone={STAGE_TONES[report.stage] || 'slate'}>{report.stage}</Badge>}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {report.submittedAt ? formatDateTime(report.submittedAt) : '—'}
          </p>
        </div>
        <span className="text-xs text-slate-400">{open ? 'Thu gọn' : 'Chi tiết'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <StudentTextBlock label="Đã làm được">{report.doneToday}</StudentTextBlock>
          <StudentTextBlock label="Mục tiêu tiếp">{report.nextGoal}</StudentTextBlock>
          {report.difficulties?.trim() ? (
            <StudentTextBlock label="Khó khăn">{report.difficulties}</StudentTextBlock>
          ) : null}
          <ProjectLinksReadonly
            githubUrl={report.projectGithubUrl}
            canvaUrl={report.projectCanvaUrl}
            slidesUrl={report.projectSlidesUrl}
            otherUrl={report.projectOtherUrl}
          />
        </div>
      )}
    </div>
  );
}

function ReportList({ reports }) {
  return (
    <div className="space-y-2">
      {reports.map((report) => (
        <ReportHistoryCard key={report.id} report={report} />
      ))}
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

  if (embedded) {
    const summaryLabel = loading
      ? 'Đang tải lịch sử…'
      : reports.length
        ? `Đã gửi ${reports.length} báo cáo`
        : 'Chưa có báo cáo đã gửi';

    return (
      <details className="group rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/40">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 marker:content-none dark:text-slate-200 [&::-webkit-details-marker]:hidden">
          <History className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="min-w-0 flex-1">{summaryLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 motion-safe:transition group-open:rotate-180" />
        </summary>
        <div className="space-y-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          {loading ? (
            <div className="flex justify-center py-3">
              <Spinner />
            </div>
          ) : error && !reports.length ? (
            <p className="text-sm text-amber-800 dark:text-amber-200">{error}</p>
          ) : reports.length ? (
            <ReportList reports={reports} />
          ) : (
            <p className="text-sm text-slate-500">Gửi báo cáo ở bước 1 để xem lại tại đây.</p>
          )}
        </div>
      </details>
    );
  }

  if (loading) {
    return (
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

  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-slate-500" />
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">
          Lịch sử báo cáo ({reports.length})
        </h3>
      </div>
      <ReportList reports={reports} />
    </div>
  );
}
