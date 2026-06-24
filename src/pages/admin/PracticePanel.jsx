import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, GraduationCap, RotateCcw } from 'lucide-react';
import { Badge } from '../../ui/components/Badge.jsx';
import { Button } from '../../ui/components/Button.jsx';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { SelectClassPrompt, LoadingCatState } from '../../ui/components/WaitingCatIllustration.jsx';
import { ClassFilterBar } from '../../ui/components/ClassFilterBar.jsx';
import { Select, Input } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { ALL_CLASSES_VALUE, resolveScopedClasses } from '../../lib/classFilterScope.js';
import { invalidateAdminSnapshots, loadAdminClasses, loadPracticePanelSnapshot } from '../../lib/adminPanelData.js';
import { AdminSnapshotControls } from '../../ui/components/AdminSnapshotControls.jsx';
import { resetPracticeSubmission } from '../../services/practiceQuiz.service.js';
import { formatDateTime, getErrorMessage } from '../../lib/firestore.js';
import {
  ALL_SESSIONS_VALUE,
  filterBySessionScope,
  maxCurrentSession,
  sessionNumbersUpToCurrent,
} from '../../lib/sessionScope.js';

function PracticeSubmissionCard({ sub, expanded, onToggle, onReset }) {
  const scoreTone = sub.mcqPercent >= 80 ? 'green' : sub.mcqPercent >= 50 ? 'amber' : 'red';

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-800 dark:text-slate-100">{sub.studentName}</p>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            Buổi {sub.sessionNumber}
            {sub.quizTitle ? ` · ${sub.quizTitle}` : ''}
            {' · '}
            {formatDateTime(sub.submittedAt)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <Badge tone="blue">Lần {sub.attemptCount}</Badge>
          {sub.mcqTotal > 0 && (
            <Badge tone={scoreTone}>
              {sub.mcqCorrect}/{sub.mcqTotal}
            </Badge>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800">
          {sub.responses.length > 0 ? (
            <div className="space-y-2">
              {sub.responses.map((r, i) => (
                <div key={`${sub.id}-${i}`} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {i + 1}. {r.prompt}
                  </p>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">Trả lời:</span> {r.selectedLabel || '—'}
                    {r.isCorrect !== undefined && (
                      <Badge tone={r.isCorrect ? 'green' : 'red'} className="ml-2 inline-flex">
                        {r.isCorrect ? 'Đúng' : 'Sai'}
                      </Badge>
                    )}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Không có chi tiết câu trả lời.</p>
          )}
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="danger" onClick={() => onReset(sub)}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PracticePanel({
  activeOnly = false,
  selectedClass: selectedClassProp,
  onSelectedClassChange,
  sessionFilter: sessionFilterProp,
  onSessionFilterChange,
}) {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [internalClass, setInternalClass] = useState(ALL_CLASSES_VALUE);
  const [internalSessionFilter, setInternalSessionFilter] = useState(ALL_SESSIONS_VALUE);
  const [submissions, setSubmissions] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const isClassControlled = selectedClassProp !== undefined;
  const isSessionControlled = sessionFilterProp !== undefined;
  const selectedClass = isClassControlled ? selectedClassProp : internalClass;
  const setSelectedClass = onSelectedClassChange ?? setInternalClass;
  const sessionFilter = sessionFilterProp ?? internalSessionFilter;
  const setSessionFilter = onSessionFilterChange ?? setInternalSessionFilter;

  const poolClasses = useMemo(
    () => (activeOnly ? classes.filter((c) => c.status === 'active') : classes),
    [classes, activeOnly],
  );

  const isAllClasses = selectedClass === ALL_CLASSES_VALUE;
  const scopedClasses = useMemo(
    () => resolveScopedClasses(poolClasses, selectedClass, activeOnly ? false : showArchived),
    [poolClasses, selectedClass, showArchived, activeOnly],
  );
  const selectedClassDoc = isAllClasses ? null : scopedClasses[0] || null;
  const classCodes = useMemo(() => {
    if (isAllClasses || !selectedClass) return [];
    return [selectedClass];
  }, [isAllClasses, selectedClass]);
  const currentSession = Number(selectedClassDoc?.curriculumCurrentSession) || 0;

  const toggleArchived = (checked) => {
    setShowArchived(checked);
    setSelectedClass(ALL_CLASSES_VALUE);
  };

  useEffect(() => {
    loadAdminClasses()
      .then((list) => {
        setClasses(list);
        setLoadingClasses(false);
        if (isClassControlled) return;
        setSelectedClass((prev) => {
          if (prev === ALL_CLASSES_VALUE) return prev;
          const pool = activeOnly ? list.filter((c) => c.status === 'active') : list;
          if (prev && pool.some((c) => c.classCode === prev)) return prev;
          return ALL_CLASSES_VALUE;
        });
      })
      .catch((error) => {
        toast.error(getErrorMessage(error));
        setLoadingClasses(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly, isClassControlled]);

  useEffect(() => {
    if (isSessionControlled) return;
    setSessionFilter(ALL_SESSIONS_VALUE);
  }, [selectedClass, isSessionControlled, setSessionFilter]);

  const loadSnapshot = useCallback(
    async ({ force = false, initial = false } = {}) => {
      if (!classCodes.length) {
        setSubmissions([]);
        return;
      }
      if (initial) setLoading(true);
      else setRefreshing(true);
      try {
        const data = await loadPracticePanelSnapshot(classCodes, { force });
        setSubmissions(data.submissions);
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

  const sessionOptions = useMemo(
    () => sessionNumbersUpToCurrent(selectedClassDoc),
    [selectedClassDoc],
  );

  const filtered = useMemo(() => {
    let list = filterBySessionScope(submissions, selectedClassDoc, sessionFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((s) => s.studentName.toLowerCase().includes(q));
    return list;
  }, [submissions, sessionFilter, search, selectedClassDoc]);

  useEffect(() => {
    setExpandedId(null);
  }, [selectedClass, sessionFilter, search]);

  const handleReset = async () => {
    if (!resetTarget) return;
    setResetting(true);
    try {
      await resetPracticeSubmission({
        classCode: resetTarget.classCode,
        studentId: resetTarget.studentId,
        lessonId: resetTarget.lessonId,
      });
      toast.success(`Đã reset ôn tập của ${resetTarget.studentName}. Học sinh có thể làm lại.`);
      setResetTarget(null);
      setExpandedId(null);
      loadSnapshot({ force: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setResetting(false);
    }
  };

  if (loadingClasses) return <LoadingCatState message="Đang tải danh sách lớp..." />;
  if (poolClasses.length === 0) {
    return (
      <EmptyState
        icon={<GraduationCap className="h-7 w-7" />}
        title={activeOnly ? 'Chưa có lớp đang hoạt động' : 'Chưa có lớp'}
      />
    );
  }

  return (
    <>
      <div className="mb-5 space-y-3">
        <ClassFilterBar
          classes={poolClasses}
          value={selectedClass}
          onChange={setSelectedClass}
          showArchived={activeOnly ? undefined : showArchived}
          onShowArchivedChange={activeOnly ? undefined : toggleArchived}
          allowAll
          allLabel={
            activeOnly
              ? 'Tất cả lớp đang hoạt động'
              : `Tất cả lớp${showArchived ? ' lưu trữ' : ' đang hoạt động'}`
          }
          showStudentCount
        />
        {!isAllClasses && selectedClass && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)}>
              <option value={ALL_SESSIONS_VALUE}>
                Tất cả buổi{currentSession > 0 ? ` (đến buổi ${currentSession})` : ''}
              </option>
              {sessionOptions.map((s) => (
                <option key={s} value={String(s)}>
                  Buổi {s}
                  {currentSession === s ? ' (hiện tại)' : ''}
                </option>
              ))}
            </Select>
            <Input placeholder="Tìm học sinh..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        )}
      </div>

      {isAllClasses ? (
        <SelectClassPrompt
          title="Chọn một lớp để xem điểm ôn tập"
          description="Chọn lớp cụ thể (không phải “Tất cả lớp”) để xem học sinh đã ôn tập đúng bao nhiêu câu."
        />
      ) : (
        <>
          <AdminSnapshotControls
            lastLoadedAt={lastLoadedAt}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            className="mb-3"
          />

          <p className="mb-4 text-sm text-slate-500">
            {filtered.length} bài ôn tập · bấm vào dòng để xem chi tiết từng câu
          </p>

          {loading ? (
            <LoadingCatState message="Đang tải bài ôn tập..." />
          ) : filtered.length === 0 ? (
            <EmptyState title="Chưa có bài ôn tập" />
          ) : (
            <div className="space-y-2">
              {filtered.map((sub) => (
                <PracticeSubmissionCard
                  key={sub.id}
                  sub={sub}
                  expanded={expandedId === sub.id}
                  onToggle={() => setExpandedId((prev) => (prev === sub.id ? null : sub.id))}
                  onReset={setResetTarget}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(resetTarget)}
        title="Reset bài ôn tập?"
        message={
          resetTarget
            ? `Xóa kết quả ôn tập buổi ${resetTarget.sessionNumber} của ${resetTarget.studentName}. Học sinh có thể làm lại từ đầu.`
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
