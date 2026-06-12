import { useEffect, useState } from 'react';
import { CheckCircle2, HelpCircle, RotateCcw } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
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

export function LessonPracticeQuiz({ lesson, classDoc, student, programId, embedded = false }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [retaking, setRetaking] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      setResult(null);
      setAnswers({});
      setRetaking(false);
      try {
        const resolved = resolveProgramId(programId || classDoc.curriculumProgramId);
        const publicQuiz = await getPublicPracticeQuiz(resolved, lesson.id);
        if (cancelled) return;
        if (!publicQuiz?.enabled || !publicQuiz.questions?.length) {
          setQuiz(null);
          return;
        }
        setQuiz(publicQuiz);
      } catch (error) {
        if (!cancelled) {
          setQuiz(null);
          const message = getErrorMessage(error);
          setLoadError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lesson.id, classDoc.classCode, student.id, programId, classDoc.curriculumProgramId]);

  useEffect(() => {
    if (!quiz) return undefined;
    const unsubscribe = subscribePracticeSubmission(
      classDoc.classCode,
      student.id,
      lesson.id,
      (existing) => {
        if (retaking) return;
        if (existing) {
          setResult({
            mcqCorrect: existing.mcqCorrect,
            mcqTotal: existing.mcqTotal,
            mcqPercent: existing.mcqPercent,
          });
          setAttemptCount(existing.attemptCount);
        } else {
          setResult(null);
        }
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
      setAttemptCount(scores.attemptCount);
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

  const body = (
      <div className={`space-y-5 ${embedded ? '' : 'p-5 sm:p-6'}`}>
        {result && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium text-emerald-800 dark:text-emerald-200">
                Điểm: {result.mcqCorrect}/{result.mcqTotal} ({result.mcqPercent}%)
              </span>
              {attemptCount > 1 && (
                <span className="text-sm text-slate-500">· Lần {attemptCount}</span>
              )}
            </div>
            <Button size="sm" variant="secondary" onClick={handleRetry}>
              <RotateCcw className="h-4 w-4" />
              Làm lại
            </Button>
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
    return (
      <div>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Trả lời câu trắc nghiệm để củng cố kiến thức trước khi gửi phản hồi buổi học.
        </p>
        {body}
      </div>
    );
  }

  return (
    <section className="card mt-6 overflow-hidden">
      <div className="border-b border-slate-200 bg-emerald-50 px-5 py-4 dark:border-slate-700 dark:bg-emerald-500/10">
        <div className="flex items-start gap-3">
          <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">
              {quiz.title || `Ôn tập buổi ${lesson.sessionNumber}`}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Trả lời vài câu trắc nghiệm để củng cố kiến thức trước khi gửi phản hồi buổi học.
            </p>
          </div>
        </div>
      </div>
      {body}
    </section>
  );
}
