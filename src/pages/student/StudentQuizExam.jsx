import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ClipboardList,
  Code2,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { CodeQuestionPanel } from '../../ui/components/CodeQuestionPanel.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { Spinner } from '../../ui/components/Spinner.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { getErrorMessage } from '../../lib/firestore.js';
import {
  canTakeQuizAttempt,
  getPublicQuiz,
  getQuizLatestStatus,
  getRemainingQuizAttempts,
  resolveQuizMaxAttempts,
  submitQuizSubmission,
} from '../../services/quiz.service.js';
import { resolveProgramId } from '../../services/curriculum.service.js';

function examDraftKey(classCode, studentId, lessonId) {
  return `quizExamDraft:${classCode}:${studentId}:${lessonId}`;
}

function formatCountdown(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} giây`;
  return s ? `${m} phút ${s} giây` : `${m} phút`;
}

function isQuestionAnswered(q, answers) {
  if (q.type === 'code') {
    const text = String(answers[q.id] ?? '').trim();
    const starter = String(q.starterCode ?? '').trim();
    if (!text) return false;
    if (starter && text === starter) return false;
    return true;
  }
  return answers[q.id] !== undefined;
}

function QuestionNavButton({ index, q, answers, marked, isCurrent, onClick }) {
  const answered = isQuestionAnswered(q, answers);
  const isMarked = marked.has(q.id);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Câu ${index + 1}${isMarked ? ' — đã đánh dấu' : ''}`}
      className={`relative flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold transition ${
        isCurrent
          ? 'bg-brand-600 text-white ring-2 ring-brand-400 ring-offset-1 dark:ring-offset-slate-900'
          : answered
            ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
            : isMarked
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {index + 1}
      {isMarked && (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500" />
      )}
    </button>
  );
}

export function StudentQuizExam({ lesson, classDoc, student, onPhaseChange }) {
  const toast = useToast();
  const programId = resolveProgramId(classDoc.curriculumProgramId);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [latestStatus, setLatestStatus] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState(() => new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startedAtMs, setStartedAtMs] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [publicQuiz, status] = await Promise.all([
        getPublicQuiz(programId, lesson.id),
        getQuizLatestStatus(classDoc.classCode, student.id, lesson.id),
      ]);
      setQuiz(publicQuiz);
      setLatestStatus(status);
      if (!publicQuiz?.enabled || !publicQuiz.questions?.length) {
        setPhase('hidden');
        return;
      }
      if (status?.attemptNumber > 0) {
        setPhase('done');
      } else {
        setPhase('intro');
      }
    } catch (error) {
      setQuiz(null);
      const message = getErrorMessage(error);
      setLoadError(message);
      setPhase('error');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [programId, lesson.id, classDoc.classCode, student.id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const timeLimitSeconds = useMemo(() => {
    const mins = Number(quiz?.timeLimitMinutes ?? 0);
    return mins > 0 ? mins * 60 : null;
  }, [quiz?.timeLimitMinutes]);

  const mcqCount = useMemo(
    () => quiz?.questions?.filter((q) => q.type !== 'code').length ?? 0,
    [quiz?.questions],
  );
  const codeCount = useMemo(
    () => quiz?.questions?.filter((q) => q.type === 'code').length ?? 0,
    [quiz?.questions],
  );

  const answeredCount = useMemo(() => {
    if (!quiz?.questions) return 0;
    return quiz.questions.filter((q) => isQuestionAnswered(q, answers)).length;
  }, [quiz?.questions, answers]);

  const attemptCount = Number(latestStatus?.attemptNumber ?? 0);
  const maxAttempts = resolveQuizMaxAttempts(quiz);
  const remainingAttempts = getRemainingQuizAttempts(quiz, attemptCount);
  const canRetake = canTakeQuizAttempt(quiz, attemptCount);

  const persistDraft = useCallback(
    (nextAnswers, nextMarked, nextStartedAt) => {
      if (phase !== 'exam') return;
      try {
        localStorage.setItem(
          examDraftKey(classDoc.classCode, student.id, lesson.id),
          JSON.stringify({
            answers: nextAnswers,
            marked: [...nextMarked],
            startedAtMs: nextStartedAt,
            currentIndex,
          }),
        );
      } catch {
        // best-effort
      }
    },
    [phase, classDoc.classCode, student.id, lesson.id, currentIndex],
  );

  const doSubmit = useCallback(
    async (timedOut = false) => {
      if (!quiz || submitting) return;
      if (!timedOut) {
        const unanswered = quiz.questions.filter((q) => !isQuestionAnswered(q, answers));
        if (unanswered.length) {
          toast.error('Hãy trả lời tất cả câu hỏi trước khi nộp.');
          return;
        }
      }
      const durationSeconds = startedAtMs
        ? Math.round((Date.now() - startedAtMs) / 1000)
        : 0;
      setSubmitting(true);
      try {
        const result = await submitQuizSubmission({
          student,
          classDoc,
          lesson,
          programId,
          quiz,
          answers,
          startedAtMs,
          durationSeconds,
          timedOut,
        });
        setLatestStatus({ attemptNumber: result.attemptNumber });
        setPhase('done');
        try {
          localStorage.removeItem(examDraftKey(classDoc.classCode, student.id, lesson.id));
        } catch {
          // ignore
        }
        toast.success(
          timedOut ? 'Hết giờ — bài đã được nộp tự động.' : 'Đã nộp bài kiểm tra.',
        );
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setSubmitting(false);
      }
    },
    [
      quiz,
      submitting,
      answers,
      startedAtMs,
      student,
      classDoc,
      lesson,
      programId,
      toast,
    ],
  );

  useEffect(() => {
    if (phase !== 'exam' || !timeLimitSeconds || !startedAtMs) return undefined;
    autoSubmittedRef.current = false;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAtMs) / 1000);
      const left = timeLimitSeconds - elapsed;
      setRemainingSeconds(left);
      if (left <= 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        doSubmit(true);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, timeLimitSeconds, startedAtMs, doSubmit]);

  useEffect(() => {
    persistDraft(answers, marked, startedAtMs);
  }, [answers, marked, startedAtMs, persistDraft]);

  const startExam = () => {
    if (!canTakeQuizAttempt(quiz, attemptCount)) {
      toast.error(`Đã hết lượt làm bài (tối đa ${maxAttempts} lần).`);
      return;
    }
    const now = Date.now();
    try {
      const raw = localStorage.getItem(examDraftKey(classDoc.classCode, student.id, lesson.id));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.startedAtMs && timeLimitSeconds) {
          const elapsed = Math.floor((now - parsed.startedAtMs) / 1000);
          if (elapsed < timeLimitSeconds) {
            setAnswers(parsed.answers ?? {});
            setMarked(new Set(parsed.marked ?? []));
            setCurrentIndex(Number(parsed.currentIndex) || 0);
            setStartedAtMs(parsed.startedAtMs);
            setPhase('exam');
            setRemainingSeconds(timeLimitSeconds - elapsed);
            return;
          }
        }
      }
    } catch {
      // ignore
    }
    const seeded = {};
    quiz.questions.forEach((q) => {
      if (q.type === 'code' && q.starterCode) seeded[q.id] = q.starterCode;
    });
    setAnswers(seeded);
    setMarked(new Set());
    setCurrentIndex(0);
    setStartedAtMs(now);
    setRemainingSeconds(timeLimitSeconds);
    setPhase('exam');
  };

  const handleRetake = () => {
    if (!canRetake) {
      toast.error(`Đã hết lượt làm bài (tối đa ${maxAttempts} lần).`);
      return;
    }
    setAnswers({});
    setMarked(new Set());
    setCurrentIndex(0);
    setStartedAtMs(null);
    setRemainingSeconds(null);
    try {
      localStorage.removeItem(examDraftKey(classDoc.classCode, student.id, lesson.id));
    } catch {
      // ignore
    }
    setPhase('intro');
  };

  const toggleMark = (qId) => {
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  if (loading || phase === 'loading') {
    return (
      <div className="mt-5 flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="mt-5">
        <EmptyState
          icon={<AlertCircle className="h-7 w-7 text-red-500" />}
          title="Không tải được bài kiểm tra"
          description={loadError || 'Vui lòng thử lại sau.'}
          action={
            <Button size="sm" variant="secondary" onClick={load}>
              <RotateCcw className="h-4 w-4" />
              Thử lại
            </Button>
          }
        />
      </div>
    );
  }

  if (phase === 'hidden') return null;

  const title = quiz.title || `Kiểm tra buổi ${lesson.sessionNumber}`;
  const timerUrgent = remainingSeconds !== null && remainingSeconds <= 300;
  const currentQ = quiz.questions[currentIndex];

  if (phase === 'intro') {
    return (
      <div className="card mt-5 overflow-hidden p-0">
        <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-6 text-white">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            <h3 className="text-lg font-bold">{title}</h3>
          </div>
          <p className="mt-2 text-sm text-brand-100">Bài kiểm tra trắc nghiệm &amp; lập trình</p>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {quiz.questions.length}
              </p>
              <p className="text-xs text-slate-500">câu hỏi</p>
            </div>
            {mcqCount > 0 && (
              <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{mcqCount}</p>
                <p className="text-xs text-slate-500">trắc nghiệm</p>
              </div>
            )}
            {codeCount > 0 && (
              <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{codeCount}</p>
                <p className="text-xs text-slate-500">viết code</p>
              </div>
            )}
            {timeLimitSeconds && (
              <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {quiz.timeLimitMinutes}
                </p>
                <p className="text-xs text-slate-500">phút</p>
              </div>
            )}
          </div>
          <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
            <li>• Chọn câu từ danh sách bên cạnh, đánh dấu câu cần xem lại.</li>
            <li>• Trả lời hết câu hỏi trước khi nộp bài.</li>
            {timeLimitSeconds && (
              <li>
                • Hết giờ hệ thống tự nộp — câu chưa trả lời tính sai (trắc nghiệm) hoặc trống
                (code).
              </li>
            )}
            <li>• Giáo viên sẽ xem và chấm kết quả của bạn.</li>
            <li>
              • Số lần làm tối đa: <strong>{maxAttempts}</strong> lần.
            </li>
          </ul>
          <Button size="lg" className="w-full min-h-12" onClick={startExam}>
            Bắt đầu làm bài
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="card mt-5 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
          <div className="flex-1">
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              Đã nộp bài kiểm tra (lần {attemptCount}/{maxAttempts})
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Giáo viên sẽ xem và chấm bài của bạn. Bạn không thấy điểm ngay sau khi nộp.
            </p>
            {canRetake ? (
              <Button size="sm" variant="secondary" className="mt-4" onClick={handleRetake}>
                <RotateCcw className="h-4 w-4" />
                Làm lại (còn {remainingAttempts} lượt)
              </Button>
            ) : (
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                Đã dùng hết {maxAttempts} lượt làm bài cho buổi này.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const questionSidebar = (
    <aside className="shrink-0 lg:w-44">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Danh sách câu
      </p>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6 lg:grid-cols-4">
        {quiz.questions.map((q, i) => (
          <QuestionNavButton
            key={q.id}
            index={i}
            q={q}
            answers={answers}
            marked={marked}
            isCurrent={i === currentIndex}
            onClick={() => setCurrentIndex(i)}
          />
        ))}
      </div>
      <div className="mt-3 hidden space-y-1 text-[11px] text-slate-400 lg:block">
        <p>
          <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded bg-green-200 dark:bg-green-500/30" />
          Đã trả lời
        </p>
        <p>
          <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded bg-amber-200 dark:bg-amber-500/30" />
          Đánh dấu xem lại
        </p>
      </div>
    </aside>
  );

  return (
    <div className="mt-5 -mx-4 sm:mx-0">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-950/95 sm:rounded-t-xl sm:border sm:border-b-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {title}
            </p>
            <p className="text-xs text-slate-500">
              Câu {currentIndex + 1}/{quiz.questions.length} · Đã trả lời {answeredCount}/
              {quiz.questions.length}
              {marked.size > 0 ? ` · ${marked.size} đánh dấu` : ''}
            </p>
          </div>
          {timeLimitSeconds && remainingSeconds !== null && (
            <div
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-mono font-bold ${
                timerUrgent
                  ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              <Clock className="h-4 w-4" />
              {formatCountdown(remainingSeconds)}
            </div>
          )}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-300"
            style={{ width: `${(answeredCount / quiz.questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 border border-t-0 border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:rounded-b-xl lg:flex-row">
        {questionSidebar}

        <div className="min-w-0 flex-1">
          {currentQ && (
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                    {currentIndex + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                      {currentQ.prompt}
                    </p>
                    {currentQ.type === 'code' && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <Code2 className="h-3.5 w-3.5" />
                        Câu lập trình
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleMark(currentQ.id)}
                  className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                    marked.has(currentQ.id)
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'
                  }`}
                >
                  <Bookmark
                    className={`h-3.5 w-3.5 ${marked.has(currentQ.id) ? 'fill-current' : ''}`}
                  />
                  {marked.has(currentQ.id) ? 'Đã đánh dấu' : 'Đánh dấu'}
                </button>
              </div>

              {currentQ.type === 'code' ? (
                <CodeQuestionPanel
                  value={answers[currentQ.id] ?? currentQ.starterCode ?? ''}
                  onChange={(val) =>
                    setAnswers((prev) => ({ ...prev, [currentQ.id]: val }))
                  }
                  editorHeight="340px"
                />
              ) : (
                <div className="space-y-2">
                  {currentQ.options.map((opt, oi) => (
                    <label
                      key={oi}
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                        answers[currentQ.id] === oi
                          ? 'border-brand-400 bg-brand-50 dark:border-brand-500 dark:bg-brand-500/10'
                          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name={currentQ.id}
                        checked={answers[currentQ.id] === oi}
                        onChange={() =>
                          setAnswers((prev) => ({ ...prev, [currentQ.id]: oi }))
                        }
                        className="h-4 w-4 text-brand-600"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-200">
                        <span className="mr-2 font-medium text-slate-400">
                          {String.fromCharCode(65 + oi)}.
                        </span>
                        {opt}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentIndex <= 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Trước
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentIndex >= quiz.questions.length - 1}
              onClick={() =>
                setCurrentIndex((i) => Math.min(quiz.questions.length - 1, i + 1))
              }
            >
              Sau
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {timeLimitSeconds && remainingSeconds !== null && remainingSeconds <= 120 && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Sắp hết giờ — hãy kiểm tra và nộp bài.
            </div>
          )}

          <div className="sticky bottom-0 -mx-4 mt-4 border-t border-slate-100 bg-white/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
            <Button
              size="lg"
              className="w-full min-h-12"
              loading={submitting}
              onClick={() => doSubmit(false)}
            >
              Nộp bài kiểm tra
            </Button>
            {startedAtMs && (
              <p className="mt-2 text-center text-xs text-slate-400">
                Thời gian làm bài:{' '}
                {formatDuration(Math.round((Date.now() - startedAtMs) / 1000))}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
