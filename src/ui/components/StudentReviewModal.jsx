import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Copy, ExternalLink, History, Trash2 } from 'lucide-react';
import { Modal } from './Modal.jsx';
import { Badge } from './Badge.jsx';
import { Button } from './Button.jsx';
import { Spinner } from './Spinner.jsx';
import { formatDateTime, getErrorMessage } from '../../lib/firestore.js';
import { driveFileViewUrl } from '../../lib/submissionAdmin.js';
import { completionSignal, signalLabel } from '../../lib/reportSignals.js';
import { formatLessonKey, lessonKeysEqual } from '../../lib/submissionFileName.js';
import { listReportsByStudent } from '../../services/reports.service.js';
import { ProjectSummaryDisclosure } from './ProjectSummaryDisclosure.jsx';
import { StudentReportDetail, productLinksOf } from './StudentReportDetail.jsx';
import { ProjectLinksReadonly } from '../../pages/student/ProjectProductLinks.jsx';
import { copyToClipboard, formatProgressReport } from '../../utils/exportText.js';
import { useToast } from './Toast.jsx';

function sortByTimeDesc(rows = [], getTime) {
  return [...rows].sort((left, right) => (getTime(right) || 0) - (getTime(left) || 0));
}

function submittedTime(row) {
  return row?.submittedAt?.getTime?.() || 0;
}

function groupFilesByLesson(files = []) {
  const groups = [];
  const index = new Map();
  for (const file of files) {
    const key = formatLessonKey(file.lessonKey) || '—';
    if (!index.has(key)) {
      index.set(key, []);
      groups.push([key, index.get(key)]);
    }
    index.get(key).push(file);
  }
  return groups;
}

function FileRow({ file, canDelete, onDelete }) {
  const fileUrl = driveFileViewUrl(file?.driveFileId);
  return (
    <li className="flex items-start justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
          {file.isLatest ? 'Mới nhất · ' : ''}
          {file.attempt ? `Lần ${file.attempt}` : 'File'}
          {file.originalFileName ? ` · ${file.originalFileName}` : ''}
        </p>
        {file.submittedAt ? (
          <p className="text-xs text-slate-400">{formatDateTime(file.submittedAt)}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {fileUrl ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Mở
          </a>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            aria-label={`Xóa file ${file.originalFileName || file.attempt || ''}`}
            onClick={() => onDelete(file)}
            className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </li>
  );
}

function HistoryReport({ report, student }) {
  return (
    <article className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="brand">Báo cáo</Badge>
        {report.isLatest ? <Badge tone="green">Mới nhất</Badge> : null}
      </div>
      <StudentReportDetail report={report} student={student} />
    </article>
  );
}

function HistoryFile({ file, canDelete, onDelete }) {
  return (
    <article className="rounded-xl border border-slate-200 px-3 dark:border-slate-700">
      <div className="pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="slate">File</Badge>
          {file.lessonKey ? <Badge tone="slate">{formatLessonKey(file.lessonKey)}</Badge> : null}
          {file.isLatest ? <Badge tone="green">Mới nhất</Badge> : null}
        </div>
      </div>
      <ul>
        <FileRow file={file} canDelete={canDelete} onDelete={onDelete} />
      </ul>
    </article>
  );
}

function ReviewHistory({ item, showReport, showDrive, lessonKey, canDelete, onDeleteFile }) {
  const [open, setOpen] = useState(false);
  const [reports, setReports] = useState(() =>
    Array.isArray(item.reportHistory) ? item.reportHistory : [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const providedHistory = Array.isArray(item.reportHistory);
  const studentId = item.student?.id;

  useEffect(() => {
    setOpen(false);
    setError('');
    setLoading(false);
    setReports(Array.isArray(item.reportHistory) ? item.reportHistory : []);
  }, [studentId]);

  useEffect(() => {
    if (Array.isArray(item.reportHistory)) setReports(item.reportHistory);
  }, [item.reportHistory]);

  useEffect(() => {
    if (!open || !showReport || providedHistory || !studentId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    listReportsByStudent(studentId)
      .then((rows) => {
        if (!cancelled) setReports(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, showReport, providedHistory, studentId]);

  const historyFiles = useMemo(() => {
    const rows = item.driveHistory?.files || item.drive?.files || [];
    const filtered = lessonKey ? rows.filter((file) => lessonKeysEqual(file.lessonKey, lessonKey)) : rows;
    return sortByTimeDesc(filtered, submittedTime);
  }, [item.driveHistory, item.drive, lessonKey]);

  const historyReports = useMemo(() => {
    const filtered = lessonKey
      ? reports.filter((report) => lessonKeysEqual(report.lessonKey, lessonKey))
      : reports;
    const latestId = item.report?.id;
    return sortByTimeDesc(filtered, submittedTime).map((report) => ({
      ...report,
      isLatest: Boolean(latestId) && report.id === latestId,
    }));
  }, [reports, lessonKey, item.report]);

  const timeline = useMemo(() => {
    const rows = [];
    if (showReport) {
      historyReports.forEach((report) => {
        rows.push({ kind: 'report', at: submittedTime(report), key: `r-${report.id || submittedTime(report)}`, report });
      });
    }
    if (showDrive) {
      historyFiles.forEach((file) => {
        rows.push({
          kind: 'file',
          at: submittedTime(file),
          key: `f-${file.id || `${file.lessonKey}-${file.attempt}-${file.originalFileName}`}`,
          file,
        });
      });
    }
    return rows.sort((left, right) => right.at - left.at);
  }, [showReport, showDrive, historyReports, historyFiles]);

  const reportCount = showReport ? (providedHistory ? historyReports.length : item.reportCount || historyReports.length) : 0;
  const fileCount = showDrive ? historyFiles.length : 0;
  const countLabel = [
    showReport ? `${reportCount} báo cáo` : '',
    showDrive ? `${fileCount} file` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  if (!showReport && !showDrive) return null;

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        <History className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Lịch sử</span>
        {countLabel ? <span className="text-xs text-slate-400">{countLabel}</span> : null}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div className="space-y-2 border-t border-slate-200 px-3 py-3 dark:border-slate-700">
          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : timeline.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có lịch sử</p>
          ) : (
            timeline.map((row) =>
              row.kind === 'report' ? (
                <HistoryReport key={row.key} report={row.report} student={item.student} />
              ) : (
                <HistoryFile
                  key={row.key}
                  file={row.file}
                  canDelete={canDelete}
                  onDelete={(file) => onDeleteFile(item, file)}
                />
              ),
            )
          )}
        </div>
      ) : null}
    </section>
  );
}

export function StudentReviewModal({
  item,
  showDrive = false,
  showReport = true,
  lessonKey = '',
  canDelete = false,
  onClose,
  onDeleteFile,
  onDeleteReport,
  onDeleteLesson,
}) {
  const toast = useToast();
  if (!item) return null;

  const signal = completionSignal(item, { showReport, showDrive });
  const files = item.drive?.files || (item.drive?.latest ? [item.drive.latest] : []);
  const latestFile = item.drive?.latest || files[0] || null;
  const latestFiles = latestFile ? [latestFile] : [];
  const groups = lessonKey ? [[lessonKey, latestFiles]] : groupFilesByLesson(latestFiles);
  const report = item.report;
  const links = productLinksOf(report, item.student);
  const showLessonDelete = canDelete && lessonKey && (item.hasReport || item.hasFile);
  const canCopy = Boolean(item.hasReport && report && !report.snapshotOnly);

  const copyReport = async () => {
    if (!canCopy) return;
    try {
      await copyToClipboard(
        formatProgressReport(report, { displayName: item.student.fullName }),
      );
      toast.success?.('Đã sao chép báo cáo.');
    } catch {
      toast.error?.('Không sao chép được.');
    }
  };

  return (
    <Modal open onClose={onClose} title={item.student.fullName} size="lg">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={signal === 'green' ? 'green' : signal === 'yellow' ? 'amber' : 'red'}>
            {signalLabel(signal, { showReport, showDrive })}
          </Badge>
          {item.showClass ? <Badge tone="slate">{item.student.classCode}</Badge> : null}
          {lessonKey ? <Badge tone="slate">{formatLessonKey(lessonKey)}</Badge> : null}
        </div>

        {showReport ? (
          <section>
            <ProjectSummaryDisclosure student={item.student} className="mb-3" />
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Báo cáo</h4>
              <div className="flex shrink-0 items-center gap-1">
                {canCopy ? (
                  <Button size="sm" variant="secondary" onClick={copyReport}>
                    <Copy className="h-3.5 w-3.5" />
                    Copy báo cáo
                  </Button>
                ) : null}
                {canDelete && item.hasReport && report && !report.snapshotOnly ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                    onClick={() => onDeleteReport(item, report)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Xóa
                  </Button>
                ) : null}
              </div>
            </div>
            {!item.hasReport ? (
              <div className="space-y-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">Chưa báo cáo</p>
                <ProjectLinksReadonly githubUrl={links.githubUrl} canvaUrl={links.canvaUrl} />
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-2">
                  <Badge tone="green">
                    {(item.reportCount || 1) > 1 ? `Mới nhất · ${item.reportCount} bản` : 'Mới nhất'}
                  </Badge>
                </div>
                <StudentReportDetail report={report} student={item.student} />
              </div>
            )}
          </section>
        ) : null}

        {showDrive ? (
          <section>
            <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">File đã nộp</h4>
            {!latestFiles.length ? (
              <p className="text-sm text-amber-800 dark:text-amber-200">Chưa nộp</p>
            ) : (
              groups.map(([key, rows]) => (
                <div key={key}>
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-3 dark:divide-slate-800 dark:border-slate-700">
                    {rows.map((file) => (
                      <FileRow
                        key={file.id || `${file.lessonKey}-${file.attempt}-${file.originalFileName}`}
                        file={file}
                        canDelete={canDelete}
                        onDelete={(row) => onDeleteFile(item, row)}
                      />
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>
        ) : null}

        <ReviewHistory
          item={item}
          showReport={showReport}
          showDrive={showDrive}
          lessonKey={lessonKey}
          canDelete={canDelete}
          onDeleteFile={onDeleteFile}
        />

        {showLessonDelete ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            onClick={() => onDeleteLesson(item)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Xóa buổi
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}
