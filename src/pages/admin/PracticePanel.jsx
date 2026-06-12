import { useCallback, useEffect, useMemo, useState } from 'react';
import { GraduationCap, RotateCcw } from 'lucide-react';
import { Badge } from '../../ui/components/Badge.jsx';
import { Button } from '../../ui/components/Button.jsx';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { SkeletonRows } from '../../ui/components/Skeleton.jsx';
import { ClassFilterBar } from '../../ui/components/ClassFilterBar.jsx';
import { Select, Input } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { ALL_CLASSES_VALUE, buildClassesByCode, resolveScopedClasses } from '../../lib/classFilterScope.js';
import { invalidateAdminSnapshots, loadAdminClasses, loadPracticePanelSnapshot } from '../../lib/adminPanelData.js';
import { AdminSnapshotControls } from '../../ui/components/AdminSnapshotControls.jsx';
import { resetPracticeSubmission } from '../../services/practiceQuiz.service.js';
import { formatDateTime, getErrorMessage } from '../../lib/firestore.js';
import {
  ALL_SESSIONS_VALUE,
  filterBySessionScope,
  filterBySessionScopeMulti,
  maxCurrentSession,
  sessionNumbersUpToCurrent,
  sessionNumbersUpToCurrentMulti,
} from '../../lib/sessionScope.js';

export function PracticePanel({ activeOnly = false }) {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(ALL_CLASSES_VALUE);
  const [submissions, setSubmissions] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [sessionFilter, setSessionFilter] = useState(ALL_SESSIONS_VALUE);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetting, setResetting] = useState(false);

  const poolClasses = useMemo(
    () => (activeOnly ? classes.filter((c) => c.status === 'active') : classes),
    [classes, activeOnly],
  );

  const scopedClasses = useMemo(
    () => resolveScopedClasses(poolClasses, selectedClass, activeOnly ? false : showArchived),
    [poolClasses, selectedClass, showArchived, activeOnly],
  );
  const classCodes = useMemo(() => scopedClasses.map((c) => c.classCode), [scopedClasses]);
  const classesByCode = useMemo(() => buildClassesByCode(scopedClasses), [scopedClasses]);
  const isAllClasses = selectedClass === ALL_CLASSES_VALUE;
  const selectedClassDoc = isAllClasses ? null : scopedClasses[0] || null;
  const currentSession = isAllClasses
    ? maxCurrentSession(scopedClasses)
    : Number(selectedClassDoc?.curriculumCurrentSession) || 0;

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
  }, [activeOnly]);

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

  useEffect(() => {
    setSessionFilter(ALL_SESSIONS_VALUE);
  }, [selectedClass]);

  const sessionOptions = useMemo(
    () =>
      isAllClasses
        ? sessionNumbersUpToCurrentMulti(scopedClasses)
        : sessionNumbersUpToCurrent(selectedClassDoc),
    [isAllClasses, scopedClasses, selectedClassDoc],
  );

  const filtered = useMemo(() => {
    let list = isAllClasses
      ? filterBySessionScopeMulti(submissions, classesByCode, sessionFilter)
      : filterBySessionScope(submissions, selectedClassDoc, sessionFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((s) => s.studentName.toLowerCase().includes(q));
    return list;
  }, [submissions, sessionFilter, search, selectedClassDoc, isAllClasses, classesByCode]);

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
      loadSnapshot({ force: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setResetting(false);
    }
  };

  if (loadingClasses) return <SkeletonRows count={3} />;
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
        <div className={`grid gap-3 ${!isAllClasses && selectedClass ? 'sm:grid-cols-2' : ''}`}>
          {!isAllClasses && selectedClass && (
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
          )}
          <Input placeholder="Tìm học sinh..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <AdminSnapshotControls
        lastLoadedAt={lastLoadedAt}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        className="mb-3"
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{filtered.length} bài ôn tập</p>
      </div>

      {loading ? (
        <SkeletonRows count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Chưa có bài ôn tập" />
      ) : (
        <div className="space-y-3">
          {filtered.map((sub) => (
            <div key={sub.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{sub.studentName}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {isAllClasses ? `${sub.classCode} · ` : ''}
                    Buổi {sub.sessionNumber}
                    {sub.quizTitle ? ` · ${sub.quizTitle}` : ''}
                    {' · '}
                    {formatDateTime(sub.submittedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="blue">Lần {sub.attemptCount}</Badge>
                  {sub.mcqTotal > 0 && (
                    <Badge
                      tone={
                        sub.mcqPercent >= 80 ? 'green' : sub.mcqPercent >= 50 ? 'amber' : 'red'
                      }
                    >
                      {sub.mcqCorrect}/{sub.mcqTotal} ({sub.mcqPercent}%)
                    </Badge>
                  )}
                  <Button size="sm" variant="danger" onClick={() => setResetTarget(sub)}>
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>
              {sub.responses.length > 0 && (
                <div className="mt-3 space-y-2">
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
              )}
            </div>
          ))}
        </div>
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
