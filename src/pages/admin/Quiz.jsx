import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { SelectClassPrompt, LoadingCatState } from '../../ui/components/WaitingCatIllustration.jsx';
import { ClassFilterBar } from '../../ui/components/ClassFilterBar.jsx';
import { Select, Input } from '../../ui/components/Field.jsx';
import { QuizClassScoreboard } from '../../ui/components/QuizClassScoreboard.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { ALL_CLASSES_VALUE, buildClassesByCode, resolveScopedClasses } from '../../lib/classFilterScope.js';
import { invalidateAdminSnapshots, loadAdminClasses, loadQuizPanelSnapshot } from '../../lib/adminPanelData.js';
import { AdminSnapshotControls } from '../../ui/components/AdminSnapshotControls.jsx';
import { buildClassQuizScoreRows } from '../../lib/quizAdminScores.js';
import {
  filterQuizAttemptsForStudent,
  resetStudentQuizAttempts,
} from '../../services/quiz.service.js';
import { getErrorMessage } from '../../lib/firestore.js';
import {
  ALL_SESSIONS_VALUE,
  maxCurrentSession,
  sessionNumbersUpToCurrent,
  sessionNumbersUpToCurrentMulti,
} from '../../lib/sessionScope.js';

export function QuizPanel({
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
  const [resettingId, setResettingId] = useState(null);

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

  const scopedClasses = useMemo(
    () => resolveScopedClasses(poolClasses, selectedClass, activeOnly ? false : showArchived),
    [poolClasses, selectedClass, showArchived, activeOnly],
  );
  const classCodes = useMemo(() => scopedClasses.map((c) => c.classCode), [scopedClasses]);
  const isAllClasses = selectedClass === ALL_CLASSES_VALUE;
  const selectedClassDoc = isAllClasses ? null : scopedClasses[0] || null;
  const currentSession = isAllClasses
    ? maxCurrentSession(scopedClasses)
    : Number(selectedClassDoc?.curriculumCurrentSession) || 0;

  const sessionOptions = useMemo(
    () =>
      isAllClasses
        ? sessionNumbersUpToCurrentMulti(scopedClasses)
        : sessionNumbersUpToCurrent(selectedClassDoc),
    [isAllClasses, scopedClasses, selectedClassDoc],
  );

  const sessionLabel =
    sessionFilter && sessionFilter !== ALL_SESSIONS_VALUE ? `buổi ${sessionFilter}` : null;

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
        const data = await loadQuizPanelSnapshot(classCodes, { force });
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

  const scoreRows = useMemo(() => {
    if (isAllClasses || !selectedClass) return [];
    const sessionNum =
      sessionFilter && sessionFilter !== ALL_SESSIONS_VALUE ? Number(sessionFilter) : null;
    let rows = buildClassQuizScoreRows(submissions, {
      classCode: selectedClass,
      sessionNumber: sessionNum,
    });
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((row) => row.studentName.toLowerCase().includes(q));
    return rows;
  }, [submissions, selectedClass, isAllClasses, sessionFilter, search]);

  const toggleArchived = (checked) => {
    setShowArchived(checked);
    setSelectedClass(ALL_CLASSES_VALUE);
  };

  const openResetDialog = (row) => {
    const sub = row.submission;
    const attempts = filterQuizAttemptsForStudent(submissions, sub.studentId, sub.lessonId);
    setResetTarget({
      rowId: row.id,
      studentName: row.studentName,
      sessionNumber: row.sessionNumber,
      quizTitle: row.quizTitle,
      attemptCount: attempts.length,
      latest: sub,
      attempts,
    });
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    setResettingId(resetTarget.rowId);
    try {
      await resetStudentQuizAttempts({
        classCode: resetTarget.latest.classCode,
        studentId: resetTarget.latest.studentId,
        lessonId: resetTarget.latest.lessonId,
        submissionIds: resetTarget.attempts.map((a) => a.id),
      });
      toast.success(
        `Đã reset bài quiz của ${resetTarget.studentName}. Học sinh có thể làm lại từ đầu.`,
      );
      setResetTarget(null);
      invalidateAdminSnapshots();
      loadSnapshot({ force: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setResettingId(null);
    }
  };

  return (
    <>
      {loadingClasses ? (
        <LoadingCatState message="Đang tải danh sách lớp..." />
      ) : poolClasses.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-7 w-7" />}
          title={activeOnly ? 'Chưa có lớp đang hoạt động' : 'Chưa có lớp'}
        />
      ) : (
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
                <Input
                  placeholder="Tìm học sinh..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}
          </div>

          <AdminSnapshotControls
            lastLoadedAt={lastLoadedAt}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            className="mb-4"
          />

          {isAllClasses ? (
            <SelectClassPrompt
              title="Chọn một lớp để xem điểm quiz"
              description="Quiz tự chấm trắc nghiệm và code theo đáp án bạn ra đề. Chọn lớp cụ thể (không phải “Tất cả lớp”) để xem báo cáo."
            />
          ) : loading ? (
            <LoadingCatState message="Đang tải điểm quiz..." />
          ) : (
            <QuizClassScoreboard
              rows={scoreRows}
              classCode={selectedClass}
              sessionLabel={sessionLabel}
              onResetRow={openResetDialog}
              resettingId={resettingId}
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(resetTarget)}
        title="Reset bài quiz?"
        message={
          resetTarget
            ? `Xóa ${resetTarget.attemptCount} lần làm của ${resetTarget.studentName} (buổi ${resetTarget.sessionNumber}${resetTarget.quizTitle ? ` · ${resetTarget.quizTitle}` : ''}). Học sinh có thể làm lại từ đầu — dùng khi có lỗi kỹ thuật hoặc nộp nhầm.`
            : ''
        }
        confirmLabel="Reset"
        loading={Boolean(resettingId)}
        onConfirm={handleReset}
        onCancel={() => !resettingId && setResetTarget(null)}
      />
    </>
  );
}

export function QuizPage() {
  return (
    <AppShell title="Quiz trắc nghiệm">
      <QuizPanel />
    </AppShell>
  );
}
