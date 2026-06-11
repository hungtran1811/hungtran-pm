import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Copy, History, RotateCcw } from 'lucide-react';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog.jsx';
import { SkeletonRows } from '../../ui/components/Skeleton.jsx';
import { ClassFilterBar } from '../../ui/components/ClassFilterBar.jsx';
import { Input } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { StudentHistoryModal } from '../../ui/components/StudentHistoryModal.jsx';
import { ALL_CLASSES_VALUE, buildClassesByCode, resolveScopedClasses } from '../../lib/classFilterScope.js';
import { invalidateAdminDataCache } from '../../lib/adminDataCache.js';
import { loadAdminClasses, loadFeedbackPanelSnapshot } from '../../lib/adminPanelData.js';
import { AdminSnapshotControls } from '../../ui/components/AdminSnapshotControls.jsx';
import { resetKnowledgeFeedback } from '../../services/knowledgeReports.service.js';
import {
  latestFeedbackPerStudent,
  studentsMissingFeedback,
} from '../../lib/submissionTracking.js';
import {
  buildClassExport,
  copyToClipboard,
  formatKnowledgeFeedback,
} from '../../utils/exportText.js';
import { formatDateTime, getErrorMessage } from '../../lib/firestore.js';
import {
  ALL_SESSIONS_VALUE,
  filterBySessionScope,
  filterBySessionScopeMulti,
  maxCurrentSession,
} from '../../lib/sessionScope.js';

const LEVEL_TONES = { 1: 'red', 2: 'red', 3: 'amber', 4: 'green', 5: 'green' };

export function FeedbackPanel() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const sessionFilter = ALL_SESSIONS_VALUE;
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetting, setResetting] = useState(false);

  const scopedClasses = useMemo(
    () => resolveScopedClasses(classes, selectedClass, showArchived),
    [classes, selectedClass, showArchived],
  );
  const classCodes = useMemo(() => scopedClasses.map((c) => c.classCode), [scopedClasses]);
  const classesByCode = useMemo(() => buildClassesByCode(scopedClasses), [scopedClasses]);
  const isAllClasses = selectedClass === ALL_CLASSES_VALUE;
  const selectedClassDoc = isAllClasses ? null : scopedClasses[0] || null;

  const toggleArchived = (checked) => {
    setShowArchived(checked);
    setSelectedClass('');
  };

  useEffect(() => {
    loadAdminClasses()
      .then((list) => {
        setClasses(list);
        setLoadingClasses(false);
        setSelectedClass((prev) => {
          const fromUrl = searchParams.get('class');
          if (fromUrl && list.some((c) => c.classCode === fromUrl)) return fromUrl;
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
        const data = await loadFeedbackPanelSnapshot(classCodes, { force });
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

  const currentSession = isAllClasses
    ? maxCurrentSession(scopedClasses)
    : Number(selectedClassDoc?.curriculumCurrentSession) || 0;
  const scopedReports = useMemo(() => {
    if (isAllClasses) {
      return filterBySessionScopeMulti(reports, classesByCode, sessionFilter);
    }
    return filterBySessionScope(reports, selectedClassDoc, sessionFilter);
  }, [reports, selectedClassDoc, sessionFilter, isAllClasses, classesByCode]);

  const sessionNum =
    sessionFilter && sessionFilter !== ALL_SESSIONS_VALUE ? Number(sessionFilter) : null;

  const visible = useMemo(() => {
    let list =
      sessionNum != null
        ? latestFeedbackPerStudent(scopedReports, sessionNum)
        : [...scopedReports].sort((a, b) => {
            if (b.sessionNumber !== a.sessionNumber) return b.sessionNumber - a.sessionNumber;
            return a.studentName.localeCompare(b.studentName, 'vi');
          });
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((r) => r.studentName.toLowerCase().includes(q));
    return list;
  }, [scopedReports, sessionNum, search]);

  const missing = useMemo(() => {
    if (isAllClasses || !students.length) return [];
    const targetSession = sessionNum || currentSession;
    if (!targetSession) return [];
    return studentsMissingFeedback(students, reports, targetSession);
  }, [students, reports, sessionNum, currentSession, isAllClasses]);

  const avgLevel = useMemo(() => {
    if (!visible.length) return null;
    const sum = visible.reduce((acc, r) => acc + (r.understandingLevel || 0), 0);
    return (sum / visible.length).toFixed(1);
  }, [visible]);

  const handleReset = async () => {
    if (!resetTarget) return;
    setResetting(true);
    try {
      await resetKnowledgeFeedback(resetTarget.feedbackId || resetTarget.id);
      toast.success(`Đã reset phản hồi của ${resetTarget.studentName}. Học sinh có thể gửi lại.`);
      setResetTarget(null);
      loadSnapshot({ force: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setResetting(false);
    }
  };

  const copyAll = async () => {
    if (!visible.length) return;
    const className = selectedClassDoc?.className || '';
    const sessionLabel =
      sessionNum != null
        ? `Buổi ${sessionNum}`
        : `Tất cả buổi (đến buổi ${currentSession || '—'})`;
    const header = isAllClasses
      ? `PHẢN HỒI BUỔI HỌC - TẤT CẢ LỚP · ${sessionLabel}`
      : `PHẢN HỒI BUỔI HỌC - ${selectedClass}${className ? ` (${className})` : ''} · ${sessionLabel}`;
    const text = buildClassExport(header, visible, formatKnowledgeFeedback);
    try {
      await copyToClipboard(text);
      toast.success(`Đã sao chép ${visible.length} phản hồi.`);
    } catch {
      toast.error('Không sao chép được.');
    }
  };

  return (
    <>
      {loadingClasses ? (
        <SkeletonRows count={3} />
      ) : classes.length === 0 ? (
        <EmptyState icon={<MessageSquare className="h-7 w-7" />} title="Chưa có lớp" />
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
            <p className="text-sm text-slate-500">
              {visible.length} phản hồi
              {missing.length > 0 && currentSession > 0
                ? ` · ${missing.length} chưa nộp buổi ${sessionNum || currentSession}`
                : ''}
              {avgLevel ? ` · Mức hiểu TB: ${avgLevel}/5` : ''}
            </p>
            <Button size="sm" variant="secondary" onClick={copyAll} disabled={!visible.length}>
              <Copy className="h-4 w-4" />
              Copy tất cả
            </Button>
          </div>

          {missing.length > 0 && (sessionNum || currentSession) > 0 && (
            <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Chưa nộp phản hồi buổi {sessionNum || currentSession} ({missing.length} học sinh)
              </p>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                {missing.map((s) => s.fullName).join(', ')}
              </p>
            </div>
          )}

          {loading ? (
            <SkeletonRows count={5} />
          ) : visible.length === 0 ? (
            <EmptyState
              title={
                sessionNum != null
                  ? `Chưa có phản hồi buổi ${sessionNum}`
                  : 'Chưa có phản hồi trong phạm vi buổi hiện tại'
              }
            />
          ) : (
            <div className="space-y-3">
              {visible.map((report) => (
                <FeedbackCard
                  key={report.id}
                  report={report}
                  showClass={isAllClasses}
                  onViewHistory={() =>
                    setHistoryTarget({
                      id: report.studentId,
                      fullName: report.studentName,
                      currentProgressPercent: 0,
                    })
                  }
                  onReset={() => setResetTarget(report)}
                />
              ))}
            </div>
          )}
            </>
          )}
        </>
      )}

      {historyTarget && (
        <StudentHistoryModal
          student={historyTarget}
          feedbackOnly
          onClose={() => setHistoryTarget(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(resetTarget)}
        title="Reset phản hồi buổi học?"
        message={
          resetTarget
            ? `Xóa phản hồi buổi ${resetTarget.sessionNumber} của ${resetTarget.studentName}. Học sinh sẽ thấy lại form để điền mới.`
            : ''
        }
        confirmLabel="Reset"
        loading={resetting}
        onConfirm={handleReset}
        onCancel={() => setResetTarget(null)}
      />
    </>
  );
}

export function FeedbackPage() {
  return (
    <AppShell title="Phản hồi buổi học">
      <FeedbackPanel />
    </AppShell>
  );
}

function FeedbackCard({ report, showClass, onViewHistory, onReset }) {
  const toast = useToast();

  const copyContent = async (e) => {
    e.stopPropagation();
    try {
      await copyToClipboard(formatKnowledgeFeedback(report));
      toast.success('Đã sao chép phản hồi.');
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
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{report.studentName}</h3>
          <p className="text-xs text-slate-400">
            {showClass ? `${report.classCode} · ` : ''}
            Buổi {report.sessionNumber} · {formatDateTime(report.submittedAt)}
          </p>
        </div>
        <Badge tone={LEVEL_TONES[report.understandingLevel] || 'slate'}>
          Mức hiểu {report.understandingLevel}/5
        </Badge>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <p>
          <span className="font-medium text-slate-500">Đã hiểu: </span>
          <span className="text-slate-700 dark:text-slate-200">{report.understoodTopics}</span>
        </p>
        <p>
          <span className="font-medium text-slate-500">Chưa rõ: </span>
          <span className="text-slate-700 dark:text-slate-200">{report.unclearTopics}</span>
        </p>
        {report.supportRequest && (
          <p>
            <span className="font-medium text-slate-500">Cần hỗ trợ: </span>
            <span className="text-slate-700 dark:text-slate-200">{report.supportRequest}</span>
          </p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onViewHistory();
          }}
        >
          <History className="h-4 w-4" />
          Xem lịch sử
        </Button>
        <Button size="sm" variant="ghost" onClick={copyContent}>
          <Copy className="h-4 w-4" />
          Copy
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-amber-600"
          onClick={(e) => {
            e.stopPropagation();
            onReset?.();
          }}
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>
    </div>
  );
}
