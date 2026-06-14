import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, HelpCircle, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { Spinner } from '../../ui/components/Spinner.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { getErrorMessage } from '../../lib/firestore.js';
import { resolveProgramId } from '../../services/curriculum.service.js';
import {
  getPublicPracticeQuiz,
  subscribePracticeSubmission,
  submitPracticeQuiz,
} from '../../services/practiceQuiz.service.js';

function mapPracticeResult(existing) {
  if (!existing) return null;
  return {
    mcqCorrect: existing.mcqCorrect,
    mcqTotal: existing.mcqTotal,
    mcqPercent: existing.mcqPercent,
    attemptCount: existing.attemptCount,
    responses: existing.responses ?? [],
  };
}

function PracticeBreakdown({ quiz, responses }) {
  const byQuestion = Object.fromEntries((responses ?? []).map((r) => [r.questionId, r]));

  return (
    <div className="space-y-3">
      {quiz.questions.map((q, qi) => {
        const response = byQuestion[q.id];
        const isCorrect = response?.isCorrect === true;
        return (
          <div
            key={q.id}
            className={`rounded-xl border p-4 ${
              isCorrect
                ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/5'
                : 'border-red-200 bg-red-50/50 dark:border-red-500/30 dark:bg-red-500/5'
            }`}
          >
            <div className="mb-2 flex items-start gap-2">
              {isCorrect ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              )}
              <p className="font-medium text-slate-800 dark:text-slate-100">
                <span className="mr-2 text-sm text-slate-400">Câu {qi + 1}</span>
                {q.prompt}
              </p>
            </div>
            {response?.selectedLabel && (
              <p className="ml-6 text-sm text-slate-600 dark:text-slate-300">
                Bạn chọn: <span className="font-medium">{response.selectedLabel}</span>
              </p>
            )}
            {!isCorrect && (
              <p className="ml-6 mt-1 text-sm text-red-700 dark:text-red-300">Chưa đúng — xem lại bài giảng nhé.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LessonPracticeQuiz({ lesson, classDoc, student, programId, embedded = false }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [retaking, setRetaking] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setResult(null);
    setAnswers({});
    setRetaking(false);
    try {
      const resolved = resolveProgramId(programId || classDoc.curriculumProgramId);
      const publicQuiz = await getPublicPracticeQuiz(resolved, lesson.id);
      if (!publicQuiz?.enabled || !publicQuiz.questions?.length) {
        setQuiz(null);
        return;
      }
      setQuiz(publicQuiz);
    } catch (error) {
      setQuiz(null);
      const message = getErrorMessage(error);
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [lesson.id, programId, classDoc.curriculumProgramId, toast]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  useEffect(() => {
    if (!quiz) return undefined;
    const unsubscribe = subscribePracticeSubmission(
      classDoc.classCode,
      student.id,
      lesson.id,
      (existing) => {
        if (retaking) return;
        setResult(mapPracticeResult(existing));
      },
      () => {},
    );
    return unsubscribe;
  }, [quiz, lesson.id, classDoc.classCode, student.id, retaking]);

  if (loading) {
    return (
      <div className={`flex justify-center py-8 ${embedded ? '' : 'mt-6'}`}>
        <Spinner />
      </div>
    );
  }

  if (loadError && !quiz) {
    const errorBody = (
      <EmptyState
        icon={<HelpCircle className="h-7 w-7 text-red-500" />}
        title="Không tải được bài ôn tập"
        description={loadError}
        action={
          <Button size="sm" variant="secondary" onClick={loadQuiz}>
            <RotateCcw className="h-4 w-4" />
            Thử lại
          </Button>
        }
      />
    );
    if (embedded) return errorBody;
    return <section className="card mt-6 overflow-hidden p-5">{errorBody}</section>;
  }

  if (!quiz) {
    if (embedded) {
      return (
        <EmptyState
          icon={<HelpCircle className="h-7 w-7" />}
          title="Chưa có câu hỏi ôn tập"
          description="Giáo viên sẽ thêm câu trắc nghiệm ôn tập cho buổi này sau."
        />
      );
    }
    return null;
  }

  const allAnswered = quiz.questions.every((q) => answers[q.id] !== undefined);

  const handleSubmit = async () => {
    if (!allAnswered) {
      toast.error('Vui lòng trả lời hết các câu hỏi.');
      return;
    }
    setSubmitting(true);
    try {
      const resolved = resolveProgramId(programId || classDoc.curriculumProgramId);
      const scores = await submitPracticeQuiz({
        student,
        classDoc,
        lesson,
        programId: resolved,
        quiz,
        answers,
      });
      setRetaking(false);
      setResult(scores);
      toast.success('Đã nộp bài ôn tập.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setRetaking(true);
    setAnswers({});
    setResult(null);
  };

  const introCopy = embedded
    ? 'Ôn tập không giới hạn lượt · không tính vào điểm kiểm tra chính thức.'
    : 'Trả lời vài câu trắc nghiệm để củng cố kiến thức. Làm lại không giới hạn.';

  const body = (
    <div className={`space-y-5 ${embedded ? '' : 'p-5 sm:p-6'}`}>
      <p className="text-sm text-slate-500 dark:text-slate-400">{introCopy}</p>

      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <div className="flex flex-wrap items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium text-emerald-800 dark:text-emerald-200">
                Điểm: {result.mcqCorrect}/{result.mcqTotal} ({result.mcqPercent}%)
              </span>
              {result.attemptCount > 1 && (
                <Badge tone="slate">Lần {result.attemptCount}</Badge>
              )}
            </div>
            <Button size="sm" variant="secondary" onClick={handleRetry}>
              <RotateCcw className="h-4 w-4" />
              Làm lại
            </Button>
          </div>
          {result.responses?.length > 0 && (
            <PracticeBreakdown quiz={quiz} responses={result.responses} />
          )}
        </div>
      )}

      {!result &&
        quiz.questions.map((q, qi) => (
          <div key={q.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="mb-3 font-medium text-slate-800 dark:text-slate-100">
              <span className="mr-2 text-sm text-slate-400">Câu {qi + 1}</span>
              {q.prompt}
            </p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                    answers[q.id] === oi
                      ? 'border-brand-400 bg-brand-50 dark:border-brand-500/50 dark:bg-brand-500/10'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name={`practice-${q.id}`}
                    checked={answers[q.id] === oi}
                    onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                    className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-slate-700 dark:text-slate-200">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

      {!result && (
        <div className="flex justify-end">
          <Button onClick={handleSubmit} loading={submitting} disabled={!allAnswered}>
            Nộp bài ôn tập
          </Button>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return <div>{body}</div>;
  }

  return (
    <section className="card mt-6 overflow-hidden">
      <div className="border-b border-slate-200 bg-emerald-50 px-5 py-4 dark:border-slate-700 dark:bg-emerald-500/10">
        <div className="flex items-start gap-3">
          <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">
                {quiz.title || `Ôn tập buổi ${lesson.sessionNumber}`}
              </h2>
              <Badge tone="green">Ôn tập · không giới hạn</Badge>
            </div>
          </div>
        </div>
      </div>
      {body}
    </section>
  );
}
