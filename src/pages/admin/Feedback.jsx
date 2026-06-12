import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Copy } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog.jsx';
import { SkeletonRows } from '../../ui/components/Skeleton.jsx';
import { ClassFilterBar } from '../../ui/components/ClassFilterBar.jsx';
import { Input, Select } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { StudentHistoryModal } from '../../ui/components/StudentHistoryModal.jsx';
import {
  PanelSummaryGrid,
  PanelSummaryStat,
  SubmissionCardActions,
  SubmissionCardShell,
  SubmissionField,
  UnderstandingBadge,
} from '../../ui/components/SubmissionDisplay.jsx';
import { ALL_CLASSES_VALUE, buildClassesByCode, resolveScopedClasses } from '../../lib/classFilterScope.js';
import { invalidateAdminSnapshots, loadAdminClasses, loadFeedbackPanelSnapshot } from '../../lib/adminPanelData.js';
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
  sessionNumbersUpToCurrent,
  sessionNumbersUpToCurrentMulti,
} from '../../lib/sessionScope.js';

function summaryToneForAvg(avg) {
  if (avg == null) return 'slate';
  if (avg >= 4) return 'green';
  if (avg >= 3) return 'amber';
  return 'red';
}

export function FeedbackPanel({
  selectedClass: selectedClassProp,
  onSelectedClassChange,
  showArchived: showArchivedProp,
  onShowArchivedChange,
  sessionFilter: sessionFilterProp,
  onSessionFilterChange,
}) {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [reports, setReports] = useState([]);
  const [internalClass, setInternalClass] = useState('');
  const [internalArchived, setInternalArchived] = useState(false);
  const [internalSessionFilter, setInternalSessionFilter] = useState(ALL_SESSIONS_VALUE);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [search, setSearch] = useState('');
  const [historyTarget, setHistoryTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetting, setResetting] = useState(false);

  const isControlled = selectedClassProp !== undefined;
  const selectedClass = isControlled ? selectedClassProp : internalClass;
  const setSelectedClass = onSelectedClassChange ?? setInternalClass;
  const showArchived = showArchivedProp ?? internalArchived;
  const setShowArchived = onShowArchivedChange ?? setInternalArchived;
  const sessionFilter = sessionFilterProp ?? internalSessionFilter;
  const setSessionFilter = onSessionFilterChange ?? setInternalSessionFilter;

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

  useEffect(() => {
    if (sessionFilterProp !== undefined) return;
    setSessionFilter(ALL_SESSIONS_VALUE);
  }, [selectedClass, sessionFilterProp]);

  const sessionOptions = useMemo(
    () =>
      isAllClasses
        ? sessionNumbersUpToCurrentMulti(scopedClasses)
        : sessionNumbersUpToCurrent(selectedClassDoc),
    [isAllClasses, scopedClasses, selectedClassDoc],
  );

  const handleRefresh = () => {
    invalidateAdminSnapshots();
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

  const missingGroups = useMemo(() => {
    if (!students.length) return [];
    const sessionFilterNum = sessionNum;

    if (!isAllClasses) {
      const targetSession = sessionFilterNum || currentSession;
      if (!targetSession) return [];
      const list = studentsMissingFeedback(students, reports, targetSession);
      if (!list.length) return [];
      return [
        {
          classCode: selectedClassDoc?.classCode || selectedClass,
          className: selectedClassDoc?.className || '',
          session: targetSession,
          students: list,
        },
      ];
    }

    return scopedClasses
      .filter((cls) => cls.curriculumPhase === 'learning' && Number(cls.curriculumCurrentSession) > 0)
      .map((cls) => {
        const targetSession = sessionFilterNum || Number(cls.curriculumCurrentSession);
        if (!targetSession) return null;
        const classStudents = students.filter((s) => s.classCode === cls.classCode);
        const classReports = reports.filter((r) => r.classCode === cls.classCode);
        const missingStudents = studentsMissingFeedback(classStudents, classReports, targetSession);
        if (!missingStudents.length) return null;
        return {
          classCode: cls.classCode,
          className: cls.className,
          session: targetSession,
          students: missingStudents,
        };
      })
      .filter(Boolean);
  }, [
    students,
    reports,
    sessionNum,
    currentSession,
    isAllClasses,
    selectedClassDoc,
    selectedClass,
    scopedClasses,
  ]);

  const missingCount = useMemo(
    () => missingGroups.reduce((sum, group) => sum + group.students.length, 0),
    [missingGroups],
  );

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
            <div className={`grid gap-3 ${selectedClass ? 'sm:grid-cols-2' : ''}`}>
              {selectedClass && (
                <Select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)}>
                  <option value={ALL_SESSIONS_VALUE}>
                    Tất cả buổi{currentSession > 0 ? ` (đến buổi ${currentSession})` : ''}
                  </option>
                  {sessionOptions.map((s) => (
                    <option key={s} value={String(s)}>
                      Buổi {s}
                      {!isAllClasses && currentSession === s ? ' (hiện tại)' : ''}
                    </option>
                  ))}
                </Select>
              )}
              <Input
                placeholder={selectedClass ? 'Tìm học sinh...' : 'Chọn lớp để tìm học sinh...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={!selectedClass}
              />
            </div>
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
              <PanelSummaryStat label="Phản hồi" value={visible.length} />
              {avgLevel != null && (
                <PanelSummaryStat
                  label="Mức hiểu trung bình"
                  value={`${avgLevel}/5`}
                  tone={summaryToneForAvg(Number(avgLevel))}
                />
              )}
              {missingCount > 0 && (
                <PanelSummaryStat
                  label={
                    sessionNum != null
                      ? `Chưa nộp buổi ${sessionNum}`
                      : isAllClasses
                        ? 'Chưa nộp (theo lớp)'
                        : `Chưa nộp buổi ${currentSession}`
                  }
                  value={missingCount}
                  hint="học sinh"
                  tone="amber"
                />
              )}
            </PanelSummaryGrid>
            <Button size="sm" variant="secondary" onClick={copyAll} disabled={!visible.length} className="shrink-0">
              <Copy className="h-4 w-4" />
              Copy tất cả
            </Button>
          </div>

          {missingCount > 0 && (
            <div className="mb-4 space-y-3">
              {missingGroups.map((group) => (
                <div
                  key={`${group.classCode}-${group.session}`}
                  className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
                >
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    {isAllClasses ? `${group.classCode} · ` : ''}
                    Chưa nộp phản hồi buổi {group.session} ({group.students.length} học sinh)
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {group.students.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-slate-900/60 dark:text-amber-200"
                      >
                        {s.fullName}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
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
            <div className="min-w-0 space-y-3">
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

function FeedbackCard({ report, showClass, onViewHistory, onReset }) {
  const toast = useToast();

  const stop = (e) => e.stopPropagation();

  const copyContent = async (e) => {
    stop(e);
    try {
      await copyToClipboard(formatKnowledgeFeedback(report));
      toast.success('Đã sao chép phản hồi.');
    } catch {
      toast.error('Không sao chép được.');
    }
  };

  return (
    <SubmissionCardShell
      title={report.studentName}
      meta={`${showClass ? `${report.classCode} · ` : ''}Buổi ${report.sessionNumber} · ${formatDateTime(report.submittedAt)}`}
      right={<UnderstandingBadge level={report.understandingLevel} />}
      onClick={onViewHistory}
      actions={
        <SubmissionCardActions
          onHistory={(e) => {
            stop(e);
            onViewHistory();
          }}
          onCopy={copyContent}
          onReset={
            onReset
              ? (e) => {
                  stop(e);
                  onReset();
                }
              : undefined
          }
        />
      }
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <SubmissionField label="Đã hiểu" variant="success">
          {report.understoodTopics}
        </SubmissionField>
        <SubmissionField label="Chưa rõ" variant="warning">
          {report.unclearTopics}
        </SubmissionField>
        {report.supportRequest && (
          <div className="lg:col-span-2">
            <SubmissionField label="Cần hỗ trợ" variant="danger">
              {report.supportRequest}
            </SubmissionField>
          </div>
        )}
      </div>
    </SubmissionCardShell>
  );
}
