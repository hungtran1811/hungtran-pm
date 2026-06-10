import { useMemo } from 'react';
import { Badge } from '../../ui/components/Badge.jsx';
import { displayStudentStatus, displayStudentStatusTone } from '../../lib/classFinalMode.js';
import { daysSince, STALE_REPORT_DAYS } from '../../lib/submissionTracking.js';
import { formatDateTime } from '../../lib/firestore.js';

export function StudentOverview({ classDoc, student, program, isFinalPhase, submittedLessonIds = [] }) {

  const openLessons = program
    ? program.lessons.filter(
        (l) =>
          !l.archived &&
          Number(l.sessionNumber) <= Number(classDoc.curriculumCurrentSession || 0),
      )
    : [];

  const openLessonIds = useMemo(
    () => new Set(openLessons.map((l) => l.id)),
    [openLessons],
  );

  const feedbackDone = useMemo(() => {
    if (isFinalPhase || !openLessons.length) return null;
    return submittedLessonIds.filter((lessonId) => openLessonIds.has(lessonId)).length;
  }, [submittedLessonIds, isFinalPhase, openLessons.length, openLessonIds]);

  const staleDays = student.lastReportedAt ? daysSince(student.lastReportedAt) : null;
  const needsReport =
    isFinalPhase &&
    (!student.lastReportedAt || (staleDays !== null && staleDays >= STALE_REPORT_DAYS));

  const pendingFeedback =
    feedbackDone !== null ? Math.max(0, openLessons.length - feedbackDone) : null;

  let nextAction = '';
  if (isFinalPhase) {
    if (needsReport) {
      nextAction = student.lastReportedAt
        ? `${staleDays} ngày chưa báo cáo — hãy cập nhật.`
        : 'Chưa có báo cáo — hãy gửi báo cáo đầu tiên.';
    } else if (student.lastReportedAt) {
      nextAction = `Cập nhật ${formatDateTime(student.lastReportedAt)}`;
    }
  } else if (pendingFeedback !== null) {
    const session = classDoc.curriculumCurrentSession || 0;
    nextAction =
      pendingFeedback > 0
        ? `Buổi ${session} · còn ${pendingFeedback} buổi chưa phản hồi`
        : 'Đã phản hồi đủ các buổi đã mở';
  }

  return (
    <div className="card mb-5 space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={displayStudentStatusTone(student, classDoc, program)}>
          {displayStudentStatus(student, classDoc, program)}
        </Badge>
        {isFinalPhase && (
          <Badge tone="brand">{student.currentProgressPercent || 0}%</Badge>
        )}
        {!isFinalPhase && feedbackDone !== null && (
          <Badge tone="brand">
            Phản hồi {feedbackDone}/{openLessons.length}
          </Badge>
        )}
        {!isFinalPhase && (
          <Badge tone="slate">Buổi {classDoc.curriculumCurrentSession || 0}</Badge>
        )}
        {isFinalPhase && student.currentStage && (
          <Badge tone="slate">{student.currentStage}</Badge>
        )}
      </div>
      {nextAction && (
        <p
          className={`text-sm ${
            needsReport
              ? 'font-medium text-amber-700 dark:text-amber-300'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          {nextAction}
        </p>
      )}
    </div>
  );
}
