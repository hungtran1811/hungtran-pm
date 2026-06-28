import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { Badge } from '../../ui/components/Badge.jsx';
import { UNDERSTANDING_LEVELS } from '../../constants/index.js';
import { formatDateTime } from '../../lib/firestore.js';
import { subscribeFeedbackSummariesForStudent } from '../../services/knowledgeReports.service.js';

function understandingLabel(level) {
  return UNDERSTANDING_LEVELS.find((l) => l.value === level)?.label ?? `Mức ${level}`;
}

function FeedbackSummaryCard({ summary, lessonTitle }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">Buổi {summary.sessionNumber}</Badge>
            <Badge tone="slate">{understandingLabel(summary.understandingLevel)}</Badge>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
            {lessonTitle || `Buổi ${summary.sessionNumber}`}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {summary.submittedAt ? formatDateTime(summary.submittedAt) : '—'}
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        )}
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3 text-sm dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Đã hiểu</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200">
              {summary.understoodTopics}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Chưa rõ</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200">
              {summary.unclearTopics}
            </p>
          </div>
          {summary.supportRequest?.trim() && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cần hỗ trợ</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                {summary.supportRequest}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StudentFeedbackHistory({ classCode, studentId, program, isFinalPhase }) {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (isFinalPhase || !classCode || !studentId) {
      setSummaries([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsubscribe = subscribeFeedbackSummariesForStudent(
      classCode,
      studentId,
      (rows) => {
        setSummaries(rows);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsubscribe;
  }, [classCode, studentId, isFinalPhase]);

  const lessonTitleById = useMemo(() => {
    const map = {};
    program?.lessons?.forEach((lesson) => {
      map[lesson.id] = lesson.title || `Buổi ${lesson.sessionNumber}`;
    });
    return map;
  }, [program?.lessons]);

  if (isFinalPhase) return null;

  if (loading) return null;

  if (!summaries.length) return null;

  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500/50"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Phản hồi đã gửi
          </span>
          <Badge tone="slate">{summaries.length}</Badge>
        </div>
        <span className="flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400">
          {expanded ? 'Thu gọn' : 'Xem lại'}
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {summaries.map((summary) => (
            <FeedbackSummaryCard
              key={summary.id}
              summary={summary}
              lessonTitle={lessonTitleById[summary.lessonId]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
