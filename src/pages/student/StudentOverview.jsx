import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ClipboardList,
  FileText,
  HelpCircle,
  Target,
} from 'lucide-react';
import { Badge } from '../../ui/components/Badge.jsx';
import { UNDERSTANDING_LEVELS } from '../../constants/index.js';
import { displayStudentStatus, displayStudentStatusTone } from '../../lib/classFinalMode.js';
import { formatDateTime } from '../../lib/firestore.js';
import { loadStudentLessonActivity } from '../../lib/lessonActivity.js';
import {
  buildStudentLearningStatus,
  getOpenLessonsForClass,
} from '../../lib/learningStatus.js';
import { FEATURE_KNOWLEDGE_FEEDBACK_ENABLED } from '../../config/features.js';
import { subscribeFeedbackSummariesForStudent } from '../../services/knowledgeReports.service.js';
import { listPublicPracticeQuizBanksForProgram } from '../../services/practiceQuiz.service.js';
import { listPublicQuizBanksForProgram } from '../../services/quiz.service.js';

const NEXT_ACTION_STYLES = {
  red: 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100',
  amber: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
  blue: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100',
};

const NEXT_ACTION_ICONS = {
  red: AlertTriangle,
  amber: Target,
  blue: HelpCircle,
  green: CheckCircle2,
};

function understandingLabel(level) {
  return UNDERSTANDING_LEVELS.find((item) => item.value === level)?.label ?? `Mức ${level}`;
}

function StatTile({ label, value, hint, icon, tone = 'brand' }) {
  const toneClass = {
    brand: 'text-brand-600 dark:text-brand-300',
    green: 'text-emerald-600 dark:text-emerald-300',
    amber: 'text-amber-600 dark:text-amber-300',
    blue: 'text-blue-600 dark:text-blue-300',
    slate: 'text-slate-600 dark:text-slate-300',
  }[tone] || 'text-brand-600 dark:text-brand-300';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <span className={toneClass}>{icon}</span>
      </div>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function ProgressBar({ value }) {
  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

function projectLinkStatusLabel(student) {
  const savedLinks = [];
  if (String(student?.projectGithubUrl || '').trim()) savedLinks.push('GitHub');
  if (String(student?.projectCanvaUrl || '').trim()) savedLinks.push('Canva');
  return savedLinks.length ? `Đã lưu ${savedLinks.join(' + ')}` : 'Tùy chọn';
}

function FeedbackDetails({ summary }) {
  if (!summary) {
    return (
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
        Đã ghi nhận phản hồi. Nội dung chi tiết chưa có trong bản tóm tắt.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="slate">{understandingLabel(summary.understandingLevel)}</Badge>
        <span className="text-xs text-slate-500">
          {summary.submittedAt ? formatDateTime(summary.submittedAt) : 'Đã gửi'}
        </span>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Đã hiểu</p>
        <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200">
          {summary.understoodTopics || '—'}
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Chưa rõ</p>
        <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200">
          {summary.unclearTopics || '—'}
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
  );
}

function lessonPriority(row) {
  if (FEATURE_KNOWLEDGE_FEEDBACK_ENABLED && !row.feedbackDone) return 0;
  if (row.practiceRequired && !row.practiceDone) return 1;
  if (row.quizRequired && !row.quizSubmitted) return 2;
  return 3;
}

function LessonChecklist({ status, loading, feedbackSummaryByLesson }) {
  const [showAll, setShowAll] = useState(false);
  const [expandedLessonId, setExpandedLessonId] = useState(null);
  const sortedLessons = useMemo(
    () =>
      [...status.lessonStatuses].sort((a, b) => {
        const byPriority = lessonPriority(a) - lessonPriority(b);
        if (byPriority !== 0) return byPriority;
        return Number(a.lesson.sessionNumber) - Number(b.lesson.sessionNumber);
      }),
    [status.lessonStatuses],
  );
  const visibleLessons = showAll ? sortedLessons : sortedLessons.slice(0, 4);

  if (!visibleLessons.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Chưa có bài học nào được mở.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">Checklist học tập</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {loading
              ? 'Đang cập nhật trạng thái quiz/ôn tập...'
              : FEATURE_KNOWLEDGE_FEEDBACK_ENABLED
                ? 'Ưu tiên buổi còn thiếu phản hồi, ôn tập hoặc quiz.'
                : 'Ưu tiên buổi còn thiếu ôn tập hoặc quiz.'}
          </p>
        </div>
        <a
          href="#student-lessons"
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
        >
          Mở bài học
        </a>
      </div>

      <div className="space-y-2">
        {visibleLessons.map(({ lesson, feedbackDone, practiceRequired, practiceDone, practiceScore, quizRequired, quizSubmitted }) => {
          const summary = feedbackSummaryByLesson[lesson.id];
          const expanded = expandedLessonId === lesson.id;
          return (
            <div
              key={lesson.id}
              className="rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-800"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">Buổi {lesson.sessionNumber}</Badge>
                    {FEATURE_KNOWLEDGE_FEEDBACK_ENABLED && (
                      feedbackDone
                        ? <Badge tone="green">Đã phản hồi</Badge>
                        : <Badge tone="amber">Chờ phản hồi</Badge>
                    )}
                    {practiceRequired && (
                      <Badge tone={practiceDone ? 'green' : 'blue'}>
                        {practiceDone ? `Ôn tập ${practiceScore != null ? `${practiceScore}%` : 'xong'}` : 'Cần ôn tập'}
                      </Badge>
                    )}
                    {quizRequired && (
                      <Badge tone={quizSubmitted ? 'green' : 'amber'}>
                        {quizSubmitted ? 'Đã nộp quiz' : 'Cần nộp quiz'}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                    {lesson.title || `Buổi ${lesson.sessionNumber}`}
                  </p>
                </div>
                {FEATURE_KNOWLEDGE_FEEDBACK_ENABLED && feedbackDone && (
                  <button
                    type="button"
                    onClick={() => setExpandedLessonId(expanded ? null : lesson.id)}
                    className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                  >
                    {expanded ? 'Ẩn phản hồi' : 'Xem phản hồi'}
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                )}
              </div>
              {FEATURE_KNOWLEDGE_FEEDBACK_ENABLED && expanded && (
                <div className="mt-3">
                  <FeedbackDetails summary={summary} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sortedLessons.length > 4 && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-brand-500/50"
        >
          {showAll ? 'Thu gọn' : `Xem tất cả ${sortedLessons.length} buổi`}
          {showAll ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      )}
    </section>
  );
}

function ProjectPanel({ student, status }) {
  const lastReportText = student.lastReportedAt
    ? formatDateTime(student.lastReportedAt)
    : 'Chưa có báo cáo';
  const projectLinkLabel = projectLinkStatusLabel(student);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">Tiến độ dự án</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{lastReportText}</p>
        </div>
        <Badge tone={status.needsReport ? 'amber' : 'green'}>
          {status.needsReport ? 'Cần cập nhật' : 'Đã cập nhật'}
        </Badge>
      </div>

      <div className="space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>{student.currentStage || 'Chưa chọn giai đoạn'}</span>
            <span>{student.currentProgressPercent || 0}%</span>
          </div>
          <ProgressBar value={student.currentProgressPercent || 0} />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs text-slate-500">Trạng thái</p>
            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
              {student.currentStatus || 'Chưa bắt đầu'}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs text-slate-500">Link mở rộng</p>
            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
              {projectLinkLabel}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function StudentOverview({ classDoc, student, program, isFinalPhase, submittedLessonIds = [] }) {
  const openLessons = useMemo(
    () => getOpenLessonsForClass(classDoc, program),
    [classDoc, program],
  );
  const [lessonActivity, setLessonActivity] = useState({});
  const [quizLessonIds, setQuizLessonIds] = useState([]);
  const [practiceLessonIds, setPracticeLessonIds] = useState([]);
  const [feedbackSummaries, setFeedbackSummaries] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  useEffect(() => {
    if (!classDoc?.classCode || !student?.id || !program?.id || !openLessons.length) {
      setLessonActivity({});
      setQuizLessonIds([]);
      setPracticeLessonIds([]);
      setLoadingActivity(false);
      return undefined;
    }

    let cancelled = false;
    const lessonIds = openLessons.map((lesson) => lesson.id);
    setLoadingActivity(true);
    Promise.allSettled([
      loadStudentLessonActivity(classDoc.classCode, student.id, openLessons),
      listPublicQuizBanksForProgram(program.id, { lessonIds }),
      listPublicPracticeQuizBanksForProgram(program.id, { lessonIds }),
    ]).then(([activityResult, quizResult, practiceResult]) => {
      if (cancelled) return;
      if (activityResult.status === 'fulfilled') setLessonActivity(activityResult.value);
      else {
        console.warn('[StudentOverview] Failed to load lesson activity', activityResult.reason);
        setLessonActivity({});
      }
      if (quizResult.status === 'fulfilled') setQuizLessonIds(quizResult.value.map((bank) => bank.lessonId));
      else {
        console.warn('[StudentOverview] Failed to load quiz banks', quizResult.reason);
        setQuizLessonIds([]);
      }
      if (practiceResult.status === 'fulfilled') {
        setPracticeLessonIds(practiceResult.value.map((bank) => bank.lessonId));
      } else {
        console.warn('[StudentOverview] Failed to load practice banks', practiceResult.reason);
        setPracticeLessonIds([]);
      }
      setLoadingActivity(false);
    });

    return () => {
      cancelled = true;
    };
  }, [classDoc?.classCode, student?.id, program?.id, openLessons]);

  useEffect(() => {
    if (!FEATURE_KNOWLEDGE_FEEDBACK_ENABLED || isFinalPhase || !classDoc?.classCode || !student?.id) {
      setFeedbackSummaries([]);
      return undefined;
    }
    return subscribeFeedbackSummariesForStudent(
      classDoc.classCode,
      student.id,
      setFeedbackSummaries,
      (error) => {
        console.warn('[StudentOverview] Failed to load feedback summaries', error);
        setFeedbackSummaries([]);
      },
    );
  }, [isFinalPhase, classDoc?.classCode, student?.id]);

  const status = useMemo(
    () =>
      buildStudentLearningStatus({
        classDoc,
        student,
        program,
        submittedLessonIds,
        lessonActivity,
        quizLessonIds,
        practiceLessonIds,
      }),
    [classDoc, student, program, submittedLessonIds, lessonActivity, quizLessonIds, practiceLessonIds],
  );

  const nextTone = status.nextAction?.tone || 'green';
  const NextIcon = NEXT_ACTION_ICONS[nextTone] || Target;
  const showFeedbackStats = FEATURE_KNOWLEDGE_FEEDBACK_ENABLED && status.feedbackTotal != null;
  const progressValue = `${student.currentProgressPercent || 0}%`;
  const statsGridClass = isFinalPhase
    ? 'grid gap-3 sm:grid-cols-2'
    : showFeedbackStats
      ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4'
      : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3';
  const feedbackSummaryByLesson = useMemo(() => {
    const map = {};
    feedbackSummaries.forEach((summary) => {
      if (!map[summary.lessonId]) map[summary.lessonId] = summary;
    });
    return map;
  }, [feedbackSummaries]);

  return (
    <div className="mb-5 space-y-4">
      <section className={`rounded-2xl border p-4 shadow-sm ${NEXT_ACTION_STYLES[nextTone] || NEXT_ACTION_STYLES.green}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 text-current shadow-sm dark:bg-slate-950/40">
              <NextIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={displayStudentStatusTone(student, classDoc, program)}>
                  {displayStudentStatus(student, classDoc, program)}
                </Badge>
                {!isFinalPhase && <Badge tone="slate">Buổi {classDoc.curriculumCurrentSession || 0}</Badge>}
                {isFinalPhase && student.currentStage && <Badge tone="slate">{student.currentStage}</Badge>}
              </div>
              <h2 className="mt-2 text-lg font-bold">{status.nextAction?.title}</h2>
              <p className="mt-1 text-sm leading-6 opacity-90">{status.nextAction?.description}</p>
            </div>
          </div>
          <a
            href={isFinalPhase ? '#student-report' : '#student-lessons'}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-white/80 px-3 py-2 text-sm font-medium text-current shadow-sm transition hover:bg-white dark:bg-slate-950/40 dark:hover:bg-slate-950/70"
          >
            Mở phần liên quan
          </a>
        </div>
      </section>

      <div className={statsGridClass}>
        {showFeedbackStats ? (
          <StatTile
            label="Phản hồi"
            value={`${status.feedbackDone}/${status.feedbackTotal}`}
            hint={`${status.pendingFeedback} buổi còn thiếu`}
            tone={status.pendingFeedback > 0 ? 'amber' : 'green'}
            icon={<ClipboardList className="h-4 w-4" />}
          />
        ) : isFinalPhase ? (
          <StatTile
            label="Tiến độ"
            value={progressValue}
            hint="Sản phẩm cuối khóa"
            tone="green"
            icon={<ClipboardList className="h-4 w-4" />}
          />
        ) : null}
        {!isFinalPhase && (
          <>
            <StatTile
              label="Ôn tập"
              value={`${status.practiceDone}/${status.practiceTotal}`}
              hint={status.practiceTotal ? `${status.pendingPracticeLessons.length} bài còn thiếu` : 'Chưa có bài ôn tập mở'}
              tone={status.pendingPracticeLessons.length ? 'blue' : 'green'}
              icon={<HelpCircle className="h-4 w-4" />}
            />
            <StatTile
              label="Quiz"
              value={`${status.quizSubmitted}/${status.quizTotal}`}
              hint={status.quizTotal ? `${status.pendingQuizLessons.length} quiz còn thiếu` : 'Chưa có quiz mở'}
              tone={status.pendingQuizLessons.length ? 'amber' : 'green'}
              icon={<BookOpenCheck className="h-4 w-4" />}
            />
          </>
        )}
        <StatTile
          label={isFinalPhase ? 'Báo cáo' : 'Bài đã mở'}
          value={isFinalPhase ? (student.lastReportedAt ? 'Có' : 'Chưa') : status.openLessons.length}
          hint={isFinalPhase ? (student.lastReportedAt ? formatDateTime(student.lastReportedAt) : 'Cần báo cáo đầu tiên') : 'Theo buổi hiện tại'}
          tone={status.needsReport ? 'amber' : 'brand'}
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      {isFinalPhase && status.finalMode === 'project' ? (
        <ProjectPanel student={student} status={status} />
      ) : (
        <LessonChecklist
          status={status}
          loading={loadingActivity}
          feedbackSummaryByLesson={feedbackSummaryByLesson}
        />
      )}
    </div>
  );
}
