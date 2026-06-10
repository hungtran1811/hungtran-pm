import { useCallback, useEffect, useMemo, useState } from 'react';
import { TrendingUp, Copy, History } from 'lucide-react';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { SkeletonRows } from '../../ui/components/Skeleton.jsx';
import { ClassFilterBar } from '../../ui/components/ClassFilterBar.jsx';
import { Select, Input } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { StudentHistoryModal } from '../../ui/components/StudentHistoryModal.jsx';
import { STATUSES, STATUS_TONES } from '../../constants/index.js';
import { ALL_CLASSES_VALUE, resolveScopedClasses } from '../../lib/classFilterScope.js';
import { invalidateAdminDataCache } from '../../lib/adminDataCache.js';
import { loadAdminClasses, loadReportsPanelSnapshot } from '../../lib/adminPanelData.js';
import { AdminSnapshotControls } from '../../ui/components/AdminSnapshotControls.jsx';
import { formatDateTime, getErrorMessage } from '../../lib/firestore.js';
import {
  buildClassExport,
  copyToClipboard,
  formatProgressReport,
} from '../../utils/exportText.js';

export function ReportsPanel() {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(ALL_CLASSES_VALUE);
  const [reports, setReports] = useState([]);
  const [students, setStudents] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);

  const scopedClasses = useMemo(
    () => resolveScopedClasses(classes, selectedClass, showArchived),
    [classes, selectedClass, showArchived],
  );
  const classCodes = useMemo(() => scopedClasses.map((c) => c.classCode), [scopedClasses]);
  const isAllClasses = selectedClass === ALL_CLASSES_VALUE;

  const toggleArchived = (checked) => {
    setShowArchived(checked);
    setSelectedClass(ALL_CLASSES_VALUE);
  };

  useEffect(() => {
    loadAdminClasses()
      .then((list) => {
        setClasses(list);
        setLoadingClasses(false);
        setSelectedClass((prev) => {
          if (prev === ALL_CLASSES_VALUE) return prev;
          if (prev && list.some((c) => c.classCode === prev)) return prev;
          return ALL_CLASSES_VALUE;
        });
      })
      .catch((error) => {
        toast.error(getErrorMessage(error));
        setLoadingClasses(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSnapshot = useCallback(
    async ({ force = false, initial = false } = {}) => {
      if (!classCodes.length) {
        setReports([]);
        setStudents([]);
        return;
      }
      if (initial) setLoading(true);
      else setRefreshing(true);
      try {
        const data = await loadReportsPanelSnapshot(classCodes, { force });
        setStudents(data.students);
        setReports(data.reports);
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
    invalidateAdminDataCache();
    loadSnapshot({ force: true });
  };

  const latestByStudent = useMemo(() => {
    const map = new Map();
    reports.forEach((report) => {
      if (!map.has(report.studentId)) map.set(report.studentId, report);
    });
    return map;
  }, [reports]);

  const visible = useMemo(() => {
    let list = students.map((student) => ({
      student,
      report: latestByStudent.get(student.id) || null,
    }));
    if (statusFilter === '__none__') {
      list = list.filter((item) => !item.report);
    } else if (statusFilter) {
      list = list.filter((item) => item.report?.status === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((item) => item.student.fullName.toLowerCase().includes(q));
    return list.sort((a, b) => {
      if (isAllClasses && a.student.classCode !== b.student.classCode) {
        return a.student.classCode.localeCompare(b.student.classCode, 'vi');
      }
      return a.student.fullName.localeCompare(b.student.fullName, 'vi');
    });
  }, [students, latestByStudent, statusFilter, search, isAllClasses]);

  const reportsForCopy = useMemo(
    () => visible.map((item) => item.report).filter(Boolean),
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
              allLabel={`Tất cả lớp${showArchived ? ' lưu trữ' : ' đang hoạt động'}`}
              showStudentCount
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tất cả học sinh</option>
              <option value="__none__">Chưa báo cáo</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Input placeholder="Tìm học sinh..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <AdminSnapshotControls
            lastLoadedAt={lastLoadedAt}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            className="mb-3"
          />

          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {visible.length} học sinh · {reportsForCopy.length} đã báo cáo
            </p>
            <Button size="sm" variant="secondary" onClick={copyAll} disabled={!reportsForCopy.length}>
              <Copy className="h-4 w-4" />
              Copy tất cả
            </Button>
          </div>

          {loading ? (
            <SkeletonRows count={5} />
          ) : visible.length === 0 ? (
            <EmptyState title="Chưa có học sinh" />
          ) : (
            <div className="space-y-3">
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
                  <div key={student.id} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">{student.fullName}</h3>
                        <p className="text-xs text-slate-400">
                          {isAllClasses ? `${student.classCode} · ` : ''}Chưa gửi báo cáo tiến độ
                        </p>
                      </div>
                      <Badge tone="slate">Chưa báo cáo</Badge>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </>
      )}

      {historyTarget && (
        <StudentHistoryModal student={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}
    </>
  );
}

export function ReportsPage() {
  return (
    <AppShell title="Báo cáo tiến độ">
      <ReportsPanel />
    </AppShell>
  );
}

function ReportCard({ report, showClass, onViewHistory }) {
  const toast = useToast();

  const copyContent = async (e) => {
    e.stopPropagation();
    try {
      await copyToClipboard(formatProgressReport(report));
      toast.success('Đã sao chép nội dung báo cáo.');
    } catch {
      toast.error('Không sao chép được.');
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onViewHistory}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onViewHistory()}
      className="card cursor-pointer p-5 transition hover:border-brand-400 hover:shadow-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{report.studentName}</h3>
          <p className="text-xs text-slate-400">
            {showClass ? `${report.classCode} · ` : ''}
            {report.projectName} · {formatDateTime(report.submittedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONES[report.status] || 'slate'}>{report.status}</Badge>
          <Badge tone="brand">{report.progressPercent}%</Badge>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <Badge tone="slate">{report.stage}</Badge>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <p>
          <span className="font-medium text-slate-500">Đã làm: </span>
          <span className="text-slate-700 dark:text-slate-200">{report.doneToday}</span>
        </p>
        <p>
          <span className="font-medium text-slate-500">Mục tiêu tiếp theo: </span>
          <span className="text-slate-700 dark:text-slate-200">{report.nextGoal}</span>
        </p>
        {report.difficulties && (
          <p>
            <span className="font-medium text-slate-500">Khó khăn: </span>
            <span className="text-slate-700 dark:text-slate-200">{report.difficulties}</span>
          </p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onViewHistory(); }}>
          <History className="h-4 w-4" />
          Xem lịch sử
        </Button>
        <Button size="sm" variant="ghost" onClick={copyContent}>
          <Copy className="h-4 w-4" />
          Copy
        </Button>
      </div>
    </div>
  );
}
