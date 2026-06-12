import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Code2, History, RotateCcw, Sparkles } from 'lucide-react';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { Button } from '../../ui/components/Button.jsx';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { SkeletonRows } from '../../ui/components/Skeleton.jsx';
import { ClassFilterBar } from '../../ui/components/ClassFilterBar.jsx';
import { Input } from '../../ui/components/Field.jsx';
import { QuizAttemptHistoryModal } from '../../ui/components/QuizAttemptHistoryModal.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { ALL_CLASSES_VALUE, buildClassesByCode, resolveScopedClasses } from '../../lib/classFilterScope.js';
import { invalidateAdminSnapshots, loadAdminClasses, loadQuizPanelSnapshot } from '../../lib/adminPanelData.js';
import { AdminSnapshotControls } from '../../ui/components/AdminSnapshotControls.jsx';
import {
  countPendingCodeGrades,
  filterQuizAttemptsForStudent,
  reautoGradeQuizSubmission,
  resetStudentQuizAttempts,
  saveQuizSubmissionGrades,
} from '../../services/quiz.service.js';
import { formatDateTime, getErrorMessage } from '../../lib/firestore.js';
import {
  ALL_SESSIONS_VALUE,
  filterBySessionScope,
  filterBySessionScopeMulti,
} from '../../lib/sessionScope.js';

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s ? `${m}p ${s}s` : `${m}p`;
}

function ResponseBlock({ response, index, editable, saving, onGradeCode }) {
  const isCode = response.questionType === 'code';
  const isGraded = response.isCorrect === true || response.isCorrect === false;

  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
        {index + 1}. {response.prompt}
      </p>
      {isCode ? (
        <>
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-green-400">
            {response.codeAnswer || '(trống)'}
          </pre>
          {isGraded && (
            <Badge
              tone={response.isCorrect ? 'green' : 'red'}
              className="mt-1.5 inline-flex"
            >
              {response.isCorrect
                ? response.manuallyGraded
                  ? 'Đúng (chấm tay)'
                  : 'Đúng (tự chấm)'
                : response.manuallyGraded
                  ? 'Sai (chấm tay)'
                  : 'Sai (tự chấm)'}
            </Badge>
          )}
          {editable && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={response.isCorrect === true ? 'primary' : 'secondary'}
                disabled={saving}
                onClick={() => onGradeCode(index, true)}
              >
                Đúng
              </Button>
              <Button
                size="sm"
                variant={response.isCorrect === false ? 'danger' : 'secondary'}
                disabled={saving}
                onClick={() => onGradeCode(index, false)}
              >
                Sai
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
          <span className="text-slate-400">Trả lời:</span> {response.selectedLabel}
          {response.selectedLabel === 'Chưa trả lời' ? (
            <Badge tone="slate" className="ml-2 inline-flex">
              Bỏ trống
            </Badge>
          ) : response.isCorrect !== undefined ? (
            <Badge
              tone={response.isCorrect ? 'green' : 'red'}
              className="ml-2 inline-flex"
            >
              {response.isCorrect ? 'Đúng' : 'Sai'}
            </Badge>
          ) : null}
        </p>
      )}
      {isCode && !isGraded && !editable && (
        <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-300">
          <Code2 className="h-3.5 w-3.5" />
          Chờ chấm code
        </p>
      )}
    </div>
  );
}

function groupKey(sub) {
  return `${sub.classCode}__${sub.studentId}__${sub.lessonId}`;
}

export function QuizPanel({ activeOnly = false }) {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(ALL_CLASSES_VALUE);
  const [submissions, setSubmissions] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

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

  const filtered = useMemo(() => {
    let list = isAllClasses
      ? filterBySessionScopeMulti(submissions, classesByCode, ALL_SESSIONS_VALUE)
      : filterBySessionScope(submissions, selectedClassDoc, ALL_SESSIONS_VALUE);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((s) => s.studentName.toLowerCase().includes(q));
    return list;
  }, [submissions, search, selectedClassDoc, isAllClasses, classesByCode]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((sub) => {
      const key = groupKey(sub);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { latest: sub, attempts: [sub], count: 1 });
        return;
      }
      existing.attempts.push(sub);
      existing.count += 1;
      if ((sub.attemptNumber ?? 0) >= (existing.latest.attemptNumber ?? 0)) {
        existing.latest = sub;
      }
    });
    return [...map.values()].sort(
      (a, b) =>
        (b.latest.submittedAt?.getTime?.() ?? 0) - (a.latest.submittedAt?.getTime?.() ?? 0),
    );
  }, [filtered]);

  const toggleArchived = (checked) => {
    setShowArchived(checked);
    setSelectedClass(ALL_CLASSES_VALUE);
  };

  const openHistory = (group) => {
    const attempts = filterQuizAttemptsForStudent(
      submissions,
      group.latest.studentId,
      group.latest.lessonId,
    );
    setHistoryTarget({
      studentName: group.latest.studentName,
      sessionNumber: group.latest.sessionNumber,
      quizTitle: group.latest.quizTitle,
      attempts,
    });
  };

  const handleGradeCode = async (submission, responseIndex, isCorrect) => {
    setActionLoading(submission.id);
    try {
      const responses = submission.responses.map((r, i) => {
        if (i !== responseIndex || r.questionType !== 'code') return r;
        return { ...r, isCorrect, manuallyGraded: true, autoGraded: false };
      });
      const scores = await saveQuizSubmissionGrades(submission.id, responses);
      toast.success(`Đã cập nhật điểm: ${scores.gradedCorrect}/${scores.gradedTotal}`);
      loadSnapshot({ force: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReautoGrade = async (submission) => {
    setActionLoading(`reauto-${submission.id}`);
    try {
      const scores = await reautoGradeQuizSubmission(submission);
      toast.success(`Tự chấm lại: ${scores.gradedCorrect}/${scores.gradedTotal}`);
      loadSnapshot({ force: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    setActionLoading('reset');
    try {
      await resetStudentQuizAttempts({
        classCode: resetTarget.latest.classCode,
        studentId: resetTarget.latest.studentId,
        lessonId: resetTarget.latest.lessonId,
        submissionIds: resetTarget.attempts.map((a) => a.id),
      });
      toast.success(`Đã reset lượt làm bài của ${resetTarget.latest.studentName}.`);
      setResetTarget(null);
      loadSnapshot({ force: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      {loadingClasses ? (
        <SkeletonRows count={3} />
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
            <Input
              placeholder="Tìm học sinh..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <AdminSnapshotControls
            lastLoadedAt={lastLoadedAt}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            className="mb-3"
          />

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {grouped.length} học sinh · {filtered.length} lần nộp
            </p>
          </div>

          {loading ? (
            <SkeletonRows count={5} />
          ) : grouped.length === 0 ? (
            <EmptyState title="Chưa có bài quiz" />
          ) : (
            <div className="space-y-3">
              {grouped.map((group) => {
                const sub = group.latest;
                const maxAttempts = sub.maxAttempts || group.count;
                const pendingCode = countPendingCodeGrades(sub.responses);
                const saving = actionLoading === sub.id;
                return (
                  <div key={groupKey(sub)} className="card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                          {sub.studentName}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {isAllClasses ? `${sub.classCode} · ` : ''}
                          Buổi {sub.sessionNumber}
                          {sub.quizTitle ? ` · ${sub.quizTitle}` : ''}
                          {' · '}
                          Lần mới nhất: {formatDateTime(sub.submittedAt)}
                          {sub.durationSeconds > 0 ? ` · ${formatDuration(sub.durationSeconds)}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={group.count >= maxAttempts ? 'amber' : 'blue'}>
                          {group.count}/{maxAttempts} lần
                        </Badge>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openHistory(group)}
                        >
                          <History className="h-4 w-4" />
                          Lịch sử
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={actionLoading === `reauto-${sub.id}`}
                          onClick={() => handleReautoGrade(sub)}
                        >
                          <Sparkles className="h-4 w-4" />
                          Tự chấm lại
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setResetTarget(group)}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Reset lượt
                        </Button>
                        {sub.timedOut && <Badge tone="amber">Hết giờ tự nộp</Badge>}
                        {sub.unansweredCount > 0 && (
                          <Badge tone="slate">{sub.unansweredCount} câu trống</Badge>
                        )}
                        {pendingCode > 0 && (
                          <Badge tone="amber">{pendingCode} code chờ chấm</Badge>
                        )}
                        {sub.gradedTotal > 0 ? (
                          <Badge
                            tone={
                              sub.gradedPercent >= 80
                                ? 'green'
                                : sub.gradedPercent >= 50
                                  ? 'amber'
                                  : 'red'
                            }
                          >
                            {sub.gradedCorrect}/{sub.gradedTotal} ({sub.gradedPercent}%)
                          </Badge>
                        ) : sub.mcqTotal > 0 ? (
                          <Badge
                            tone={
                              sub.mcqPercent >= 80 ? 'green' : sub.mcqPercent >= 50 ? 'amber' : 'red'
                            }
                          >
                            TN: {sub.mcqCorrect}/{sub.mcqTotal} ({sub.mcqPercent}%)
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Lần {sub.attemptNumber} (mới nhất) — chấm câu code bằng Đúng/Sai bên dưới
                    </p>
                    <div className="mt-3 space-y-2">
                      {sub.responses.map((r, i) => (
                        <ResponseBlock
                          key={`${sub.id}-${i}`}
                          response={r}
                          index={i}
                          editable={r.questionType === 'code'}
                          saving={saving}
                          onGradeCode={(idx, correct) => handleGradeCode(sub, idx, correct)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {historyTarget && (
        <QuizAttemptHistoryModal
          studentName={historyTarget.studentName}
          sessionNumber={historyTarget.sessionNumber}
          quizTitle={historyTarget.quizTitle}
          attempts={historyTarget.attempts}
          onGradeCode={handleGradeCode}
          onReautoGrade={handleReautoGrade}
          actionLoading={actionLoading}
          onClose={() => setHistoryTarget(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(resetTarget)}
        title="Reset lượt làm bài?"
        message={
          resetTarget
            ? `Xóa ${resetTarget.count} lần làm của ${resetTarget.latest.studentName} (buổi ${resetTarget.latest.sessionNumber}). Học sinh có thể làm lại từ đầu.`
            : ''
        }
        confirmLabel="Reset"
        loading={actionLoading === 'reset'}
        onConfirm={handleReset}
        onCancel={() => setResetTarget(null)}
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
