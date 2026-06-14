import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TrendingUp, Copy } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { SelectClassPrompt, LoadingCatState } from '../../ui/components/WaitingCatIllustration.jsx';
import { ClassFilterBar } from '../../ui/components/ClassFilterBar.jsx';
import { Input } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { StudentHistoryModal } from '../../ui/components/StudentHistoryModal.jsx';
import {
  PanelSummaryGrid,
  PanelSummaryStat,
  ProgressMiniBar,
} from '../../ui/components/SubmissionDisplay.jsx';
import { STATUS_TONES } from '../../constants/index.js';
import { ALL_CLASSES_VALUE, resolveScopedClasses } from '../../lib/classFilterScope.js';
import { invalidateAdminSnapshots, loadAdminClasses, loadReportsPanelSnapshot } from '../../lib/adminPanelData.js';
import { AdminSnapshotControls } from '../../ui/components/AdminSnapshotControls.jsx';
import { formatDateTime, getErrorMessage } from '../../lib/firestore.js';
import { reportFromStudentSnapshot } from '../../services/reports.service.js';
import {
  buildClassExport,
  copyToClipboard,
  formatProgressReport,
} from '../../utils/exportText.js';

export function ReportsPanel({
  selectedClass: selectedClassProp,
  onSelectedClassChange,
  showArchived: showArchivedProp,
  onShowArchivedChange,
}) {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [classes, setClasses] = useState([]);
  const [internalClass, setInternalClass] = useState('');
  const [internalArchived, setInternalArchived] = useState(false);
  const [latestByStudent, setLatestByStudent] = useState(() => new Map());
  const [students, setStudents] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [search, setSearch] = useState('');
  const [historyTarget, setHistoryTarget] = useState(null);

  const isControlled = selectedClassProp !== undefined;
  const selectedClass = isControlled ? selectedClassProp : internalClass;
  const setSelectedClass = onSelectedClassChange ?? setInternalClass;
  const showArchived = showArchivedProp ?? internalArchived;
  const setShowArchived = onShowArchivedChange ?? setInternalArchived;

  const scopedClasses = useMemo(
    () => resolveScopedClasses(classes, selectedClass, showArchived),
    [classes, selectedClass, showArchived],
  );
  const classCodes = useMemo(() => scopedClasses.map((c) => c.classCode), [scopedClasses]);
  const isAllClasses = selectedClass === ALL_CLASSES_VALUE;

  const toggleArchived = (checked) => {
    setShowArchived(checked);
    if (!isControlled) setSelectedClass('');
  };

  useEffect(() => {
    loadAdminClasses()
      .then((list) => {
        setClasses(list);
        setLoadingClasses(false);
        if (isControlled) return;
        setSelectedClass((prev) => {
          const fromUrl = searchParams.get('class');
          if (fromUrl && (fromUrl === ALL_CLASSES_VALUE || list.some((c) => c.classCode === fromUrl))) {
            return fromUrl;
          }
          if (prev === ALL_CLASSES_VALUE) return prev;
          if (prev && list.some((c) => c.classCode === prev)) return prev;
          return '';
        });
      })
      .catch((error) => {
        toast.error(getErrorMessage(error));
        setLoadingClasses(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled]);

  const loadSnapshot = useCallback(
    async ({ force = false, initial = false } = {}) => {
      if (!classCodes.length) {
        setLatestByStudent(new Map());
        setStudents([]);
        return;
      }
      if (initial) setLoading(true);
      else setRefreshing(true);
      try {
        const data = await loadReportsPanelSnapshot(classCodes, { force });
        setStudents(data.students);
        setLatestByStudent(data.latestByStudent);
        setLastLoadedAt(Date.now());
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [classCodes, toast],
  );

  useEffect(() => {
    loadSnapshot({ initial: true });
  }, [loadSnapshot]);

  const handleRefresh = () => {
    invalidateAdminSnapshots();
    loadSnapshot({ force: true });
  };

  const resolveReport = useCallback(
    (student) => latestByStudent.get(student.id) ?? reportFromStudentSnapshot(student),
    [latestByStudent],
  );

  const visible = useMemo(() => {
    let list = students.map((student) => ({
      student,
      report: resolveReport(student),
    }));
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((item) => item.student.fullName.toLowerCase().includes(q));

    const reportTime = (item) => item.report?.submittedAt?.getTime?.() ?? 0;

    return list.sort((a, b) => {
      const aHas = Boolean(a.report);
      const bHas = Boolean(b.report);
      if (aHas !== bHas) return aHas ? -1 : 1;

      const timeDiff = reportTime(b) - reportTime(a);
      if (timeDiff !== 0) return timeDiff;

      if (isAllClasses && a.student.classCode !== b.student.classCode) {
        return a.student.classCode.localeCompare(b.student.classCode, 'vi');
      }
      return a.student.fullName.localeCompare(b.student.fullName, 'vi');
    });
  }, [students, resolveReport, search, isAllClasses]);

  const newestStudentId = useMemo(() => {
    const first = visible.find((item) => item.report && !item.report.snapshotOnly);
    return first?.student.id ?? null;
  }, [visible]);

  const reportsForCopy = useMemo(
    () => visible.map((item) => item.report).filter((r) => r && !r.snapshotOnly),
    [visible],
  );

  const avgProgress = useMemo(() => {
    const withProgress = visible.map((item) => item.report).filter(Boolean);
    if (!withProgress.length) return null;
    const sum = withProgress.reduce((acc, r) => acc + Number(r.progressPercent || 0), 0);
    return Math.round(sum / withProgress.length);
  }, [visible]);

  const missingCount = useMemo(
    () => visible.filter((item) => !item.student.lastReportedAt).length,
    [visible],
  );

  const openHistory = (student, report) => {
    setHistoryTarget({
      id: student.id,
      fullName: student.fullName,
      currentProgressPercent: report?.progressPercent ?? student.currentProgressPercent,
    });
  };

  const copyAll = async () => {
    if (!reportsForCopy.length) return;
    const header = isAllClasses
      ? 'BÁO CÁO TIẾN ĐỘ - TẤT CẢ LỚP'
      : (() => {
          const cls = classes.find((c) => c.classCode === selectedClass);
          return `BÁO CÁO TIẾN ĐỘ - ${selectedClass}${cls?.className ? ` (${cls.className})` : ''}`;
        })();
    const text = buildClassExport(header, reportsForCopy, formatProgressReport);
    try {
      await copyToClipboard(text);
      toast.success(`Đã sao chép ${reportsForCopy.length} báo cáo.`);
    } catch {
      toast.error('Không sao chép được.');
    }
  };

  return (
    <>
      {loadingClasses ? (
        <LoadingCatState message="Đang tải danh sách lớp..." />
      ) : classes.length === 0 ? (
        <EmptyState icon={<TrendingUp className="h-7 w-7" />} title="Chưa có lớp" />
      ) : (
        <>
          <div className="mb-5 space-y-3">
            <ClassFilterBar
              classes={classes}
              value={selectedClass}
              onChange={setSelectedClass}
              showArchived={showArchived}
              onShowArchivedChange={toggleArchived}
              allowAll
              autoSelectFirst={false}
              allLabel={`Tất cả lớp${showArchived ? ' lưu trữ' : ' đang hoạt động'}`}
              showStudentCount
            />
            <Input
              placeholder={selectedClass ? 'Tìm học sinh...' : 'Chọn lớp để tìm học sinh...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={!selectedClass}
            />
          </div>

          {!selectedClass ? (
            <SelectClassPrompt
              title="Chọn lớp để xem báo cáo"
              description="Chọn lớp ở bộ lọc phía trên để xem báo cáo tiến độ học sinh."
            />
          ) : (
            <>
              <AdminSnapshotControls
                lastLoadedAt={lastLoadedAt}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                className="mb-3"
              />

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <PanelSummaryGrid className="mb-0 flex-1 sm:grid-cols-2 lg:grid-cols-3">
                  <PanelSummaryStat label="Học sinh" value={visible.length} />
                  <PanelSummaryStat
                    label="Đã báo cáo"
                    value={visible.length - missingCount}
                    tone="brand"
                    hint={missingCount > 0 ? `${missingCount} chưa gửi` : undefined}
                  />
                  {avgProgress != null && (
                    <PanelSummaryStat label="Tiến độ trung bình" value={`${avgProgress}%`} tone="green" />
                  )}
                </PanelSummaryGrid>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={copyAll}
                  disabled={!reportsForCopy.length}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                  Copy tất cả
                </Button>
              </div>

              {missingCount > 0 && !isAllClasses && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <strong>{missingCount} học sinh</strong> chưa gửi báo cáo tiến độ
                  {selectedClass ? ` cho lớp ${selectedClass}` : ''}. Học sinh cần nộp trên cổng
                  học sinh trước khi bạn cập nhật tiến độ thủ công.
                </div>
              )}

              {loading ? (
                <LoadingCatState message="Đang tải báo cáo học sinh..." />
              ) : visible.length === 0 ? (
                <EmptyState title="Chưa có học sinh" />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {visible.map(({ student, report }) =>
                    report ? (
                      <ReportGridCard
                        key={student.id}
                        report={report}
                        showClass={isAllClasses}
                        isNewest={student.id === newestStudentId}
                        onViewHistory={() => openHistory(student, report)}
                      />
                    ) : (
                      <MissingReportCard
                        key={student.id}
                        student={student}
                        showClass={isAllClasses}
                        onViewHistory={() => openHistory(student, null)}
                      />
                    ),
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {historyTarget && (
        <StudentHistoryModal student={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}
    </>
  );
}

function MissingReportCard({ student, showClass, onViewHistory }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onViewHistory}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onViewHistory();
      }}
      className="card flex h-full cursor-pointer flex-col border-dashed p-5 opacity-90 transition hover:border-slate-400 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-800 dark:text-slate-100">
            {student.fullName}
          </h3>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {showClass ? `${student.classCode} · ` : ''}Chưa gửi báo cáo tiến độ
          </p>
        </div>
        <Badge tone="slate">Chưa báo cáo</Badge>
      </div>
      <p className="mt-4 flex-1 text-sm text-slate-500 dark:text-slate-400">
        Học sinh chưa nộp báo cáo trên cổng học sinh. Nhấn để xem lịch sử.
      </p>
    </div>
  );
}

function ReportGridCard({ report, showClass, isNewest = false, onViewHistory }) {
  const toast = useToast();
  const hasFull = !report.snapshotOnly;
  const percent = Number(report.progressPercent || 0);

  const copyContent = async (e) => {
    e.stopPropagation();
    if (!hasFull) {
      toast.error('Chỉ có snapshot tiến độ — mở lịch sử để xem nội dung đầy đủ.');
      return;
    }
    try {
      await copyToClipboard(formatProgressReport(report));
      toast.success('Đã sao chép nội dung báo cáo.');
    } catch {
      toast.error('Không sao chép được.');
    }
  };

  const highlightClass = isNewest
    ? 'border-brand-300 bg-brand-50/40 dark:border-brand-500/40 dark:bg-brand-500/10'
    : hasFull
      ? 'border-slate-200 dark:border-slate-700'
      : '';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onViewHistory}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onViewHistory();
      }}
      className={`card flex h-full cursor-pointer flex-col p-5 transition hover:border-brand-400 hover:shadow-md ${highlightClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-800 dark:text-slate-100">
            {report.studentName}
          </h3>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {showClass ? `${report.classCode} · ` : ''}
            {report.projectName}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isNewest && <Badge tone="brand">Mới nhất</Badge>}
          <Badge tone={STATUS_TONES[report.status] || 'slate'}>{report.status}</Badge>
        </div>
      </div>

      <dl className="mt-4 flex-1 space-y-1.5 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">Tiến độ</dt>
          <dd className="font-semibold tabular-nums text-brand-600 dark:text-brand-300">{percent}%</dd>
        </div>
        <ProgressMiniBar percent={percent} className="pb-1" />
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">Giai đoạn</dt>
          <dd className="font-medium text-slate-700 dark:text-slate-200">{report.stage}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">Nộp lúc</dt>
          <dd className="text-right font-medium text-slate-700 dark:text-slate-200">
            {hasFull ? formatDateTime(report.submittedAt) : 'Snapshot'}
          </dd>
        </div>
      </dl>

      {hasFull ? (
        <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Đã làm được
          </p>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {report.doneToday}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Chỉ có snapshot tiến độ. Nhấn card để xem lịch sử đầy đủ.
        </p>
      )}

      {hasFull && (
        <div
          className="mt-4 flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          <Button size="sm" variant="ghost" onClick={copyContent}>
            <Copy className="h-4 w-4" />
            Copy
          </Button>
        </div>
      )}
    </div>
  );
}
