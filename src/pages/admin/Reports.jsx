import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TrendingUp, Copy } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { SkeletonRows } from '../../ui/components/Skeleton.jsx';
import { ClassFilterBar } from '../../ui/components/ClassFilterBar.jsx';
import { Input } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { StudentHistoryModal } from '../../ui/components/StudentHistoryModal.jsx';
import {
  PanelSummaryGrid,
  PanelSummaryStat,
  ProgressMiniBar,
  SubmissionCardActions,
  SubmissionCardShell,
  SubmissionField,
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
    return list.sort((a, b) => {
      if (isAllClasses && a.student.classCode !== b.student.classCode) {
        return a.student.classCode.localeCompare(b.student.classCode, 'vi');
      }
      return a.student.fullName.localeCompare(b.student.fullName, 'vi');
    });
  }, [students, resolveReport, search, isAllClasses]);

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
        <SkeletonRows count={3} />
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

          {!selectedClass ? null : (
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

              {loading ? (
                <SkeletonRows count={5} />
              ) : visible.length === 0 ? (
                <EmptyState title="Chưa có học sinh" />
              ) : (
                <div className="min-w-0 space-y-3">
                  {visible.map(({ student, report }) =>
                    report ? (
                      <ReportCard
                        key={student.id}
                        report={report}
                        showClass={isAllClasses}
                        onViewHistory={() =>
                          setHistoryTarget({
                            id: student.id,
                            fullName: student.fullName,
                            currentProgressPercent: report.progressPercent,
                          })
                        }
                      />
                    ) : (
                      <SubmissionCardShell
                        key={student.id}
                        title={student.fullName}
                        meta={`${isAllClasses ? `${student.classCode} · ` : ''}Chưa gửi báo cáo tiến độ`}
                        badges={<Badge tone="slate">Chưa báo cáo</Badge>}
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

function ReportCard({ report, showClass, onViewHistory }) {
  const toast = useToast();

  const stop = (e) => e.stopPropagation();

  const copyContent = async (e) => {
    stop(e);
    if (report.snapshotOnly) {
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

  return (
    <SubmissionCardShell
      title={report.studentName}
      meta={`${showClass ? `${report.classCode} · ` : ''}${report.projectName} · ${formatDateTime(report.submittedAt)}${report.snapshotOnly ? ' · snapshot' : ''}`}
      badges={
        <>
          <Badge tone={STATUS_TONES[report.status] || 'slate'}>{report.status}</Badge>
          <Badge tone="slate">{report.stage}</Badge>
        </>
      }
      right={<Badge tone="brand">{report.progressPercent}%</Badge>}
      onClick={onViewHistory}
      actions={
        <SubmissionCardActions
          onHistory={(e) => {
            stop(e);
            onViewHistory();
          }}
          onCopy={copyContent}
        />
      }
    >
      <ProgressMiniBar percent={report.progressPercent} className="mb-4" />
      {report.snapshotOnly ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tiến độ và trạng thái mới nhất từ hồ sơ học sinh. Bấm <strong>Lịch sử</strong> để xem nội dung báo cáo đầy đủ.
          {report.difficulties && (
            <span className="mt-2 block text-amber-700 dark:text-amber-300">
              Khó khăn ghi nhận: {report.difficulties}
            </span>
          )}
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <SubmissionField label="Đã làm">{report.doneToday}</SubmissionField>
          <SubmissionField label="Mục tiêu tiếp theo">{report.nextGoal}</SubmissionField>
          {report.difficulties && (
            <div className="lg:col-span-2">
              <SubmissionField label="Khó khăn" variant="warning">
                {report.difficulties}
              </SubmissionField>
            </div>
          )}
        </div>
      )}
    </SubmissionCardShell>
  );
}
