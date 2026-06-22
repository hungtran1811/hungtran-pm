import { useCallback, useMemo, useState } from 'react';
import { ChevronDown, FileCode2, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from './Badge.jsx';
import { Button } from './Button.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { Spinner } from './Spinner.jsx';
import { useToast } from './Toast.jsx';
import { CODE_SUBMISSION_RETENTION_DAYS } from '../../lib/codeSubmissionLimits.js';
import {
  formatPurgeStatusLabel,
  getClassCodePurgeStatus,
  purgeStatusTone,
} from '../../lib/codeSubmissionPurgeStatus.js';
import { formatDateTime, getErrorMessage } from '../../lib/firestore.js';
import { isArchivedClassStatus } from '../../services/classes.service.js';
import {
  purgeCodeSubmissionsForClass,
  purgeExpiredCodeSubmissions,
  summarizeCodeSubmissionsAllClasses,
} from '../../services/codeSubmissions.service.js';

export function CodeSubmissionsPurgePanel({ classes = [], onPurged }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [countsByClass, setCountsByClass] = useState(() => new Map());
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [purging, setPurging] = useState(false);

  const archivedClasses = useMemo(
    () => classes.filter((c) => isArchivedClassStatus(c.status)),
    [classes],
  );

  const loadCounts = useCallback(async ({ initial = false } = {}) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const counts = await summarizeCodeSubmissionsAllClasses();
      setCountsByClass(counts);
      setLoaded(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next && !loaded) loadCounts({ initial: true });
      return next;
    });
  };

  const rows = useMemo(() => {
    return archivedClasses.map((cls) => {
      const counts = countsByClass.get(cls.classCode) ?? { fileCount: 0, sessionCount: 0 };
      const status = getClassCodePurgeStatus(cls, counts.fileCount);
      return { cls, counts, status };
    });
  }, [archivedClasses, countsByClass]);

  const visibleRows = useMemo(
    () =>
      rows.filter(({ counts, status }) => {
        if (status.state === 'purged') return false;
        if (counts.fileCount > 0) return true;
        return status.state === 'eligible';
      }),
    [rows],
  );

  const eligibleForBulk = rows.filter((row) => row.status.state === 'eligible');
  const rowsWithFiles = visibleRows.filter((row) => row.counts.fileCount > 0);
  const totalFiles = visibleRows.reduce((sum, row) => sum + row.counts.fileCount, 0);

  const handlePurgeClass = async (classCode) => {
    setPurging(true);
    try {
      const result = await purgeCodeSubmissionsForClass(classCode, { force: true });
      toast.success(
        result.deletedFiles > 0
          ? `Đã xóa ${result.deletedFiles} file code của lớp ${classCode}.`
          : `Lớp ${classCode} không còn file code. Đã đánh dấu đã dọn.`,
      );
      await loadCounts();
      onPurged?.();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPurging(false);
      setConfirmTarget(null);
    }
  };

  const handlePurgeEligible = async () => {
    setPurging(true);
    try {
      const results = await purgeExpiredCodeSubmissions();
      const totalDeleted = results.reduce((sum, r) => sum + r.deletedFiles, 0);
      if (!results.length) {
        toast.info('Không có lớp nào đủ điều kiện tự dọn lúc này.');
      } else {
        toast.success(`Đã dọn ${results.length} lớp · xóa ${totalDeleted} file code.`);
      }
      await loadCounts();
      onPurged?.();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPurging(false);
      setBulkConfirm(false);
    }
  };

  if (!archivedClasses.length) return null;

  const summaryHint = loaded
    ? totalFiles > 0
      ? `${totalFiles} file · ${rowsWithFiles.length} lớp`
      : visibleRows.length > 0
        ? `${visibleRows.length} lớp đủ hạn dọn`
        : 'Không còn file cần dọn'
    : `Tự xóa sau ${CODE_SUBMISSION_RETENTION_DAYS} ngày`;

  return (
    <>
      <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={handleToggle}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800">
            <FileCode2 className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">Dọn file code</span>
              {loaded && eligibleForBulk.length > 0 && (
                <Badge tone="amber">{eligibleForBulk.length} lớp đủ hạn</Badge>
              )}
              {loaded && totalFiles > 0 && eligibleForBulk.length === 0 && (
                <Badge tone="blue">{totalFiles} file</Badge>
              )}
            </span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">{summaryHint}</span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-700">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                Lớp hoàn thành/lưu trữ · tự dọn sau {CODE_SUBMISSION_RETENTION_DAYS} ngày
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" loading={refreshing} onClick={() => loadCounts()}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!eligibleForBulk.length || purging}
                  onClick={() => setBulkConfirm(true)}
                >
                  Dọn đủ hạn ({eligibleForBulk.length})
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : visibleRows.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">
                Không có lớp nào còn file code cần dọn.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {visibleRows.map(({ cls, counts, status }) => (
                  <li
                    key={cls.classCode}
                    className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2 dark:border-slate-800"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-800 dark:text-slate-100">{cls.classCode}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        {counts.fileCount} file
                        {status.purgedAt && ` · Dọn ${formatDateTime(status.purgedAt)}`}
                        {status.purgeAt && status.state !== 'purged' && (
                          <> · Hạn {formatDateTime(status.purgeAt)}</>
                        )}
                      </p>
                    </div>
                    <Badge tone={purgeStatusTone(status.state)} className="shrink-0 text-[10px]">
                      {formatPurgeStatusLabel(status)}
                    </Badge>
                    {status.state !== 'purged' && counts.fileCount > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 shrink-0 p-0 text-red-600 dark:text-red-400"
                        disabled={purging}
                        title="Dọn ngay"
                        onClick={() =>
                          setConfirmTarget({
                            classCode: cls.classCode,
                            fileCount: counts.fileCount,
                            force: status.state !== 'eligible',
                            daysLeft: status.daysLeft,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={`Dọn file code · ${confirmTarget?.classCode}`}
        message={
          confirmTarget?.force
            ? `Xóa ${confirmTarget.fileCount} file code ngay (bỏ qua thời gian chờ ${confirmTarget.daysLeft ?? '—'} ngày)? Thao tác không hoàn tác.`
            : `Xóa ${confirmTarget?.fileCount} file code của lớp này? Thao tác không hoàn tác.`
        }
        confirmLabel="Xóa file code"
        loading={purging}
        onConfirm={() => handlePurgeClass(confirmTarget.classCode)}
        onCancel={() => setConfirmTarget(null)}
      />

      <ConfirmDialog
        open={bulkConfirm}
        title="Dọn tất cả lớp đủ hạn"
        message={`Xóa file code của ${eligibleForBulk.length} lớp đã quá ${CODE_SUBMISSION_RETENTION_DAYS} ngày kể từ khi hoàn thành?`}
        confirmLabel="Dọn tất cả"
        loading={purging}
        onConfirm={handlePurgeEligible}
        onCancel={() => setBulkConfirm(false)}
      />
    </>
  );
}
