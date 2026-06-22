import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal.jsx';
import { Badge } from './Badge.jsx';
import { Spinner } from './Spinner.jsx';
import { EmptyState } from './EmptyState.jsx';
import { CodeSubmissionsPanel } from './CodeSubmissionsPanel.jsx';
import { ProjectLinksReadonly } from '../../pages/student/ProjectProductLinks.jsx';
import { useToast } from './Toast.jsx';
import { STATUS_TONES, UNDERSTANDING_LEVELS } from '../../constants/index.js';
import { listReportsByStudent } from '../../services/reports.service.js';
import { listKnowledgeReportsByStudent } from '../../services/knowledgeReports.service.js';
import { listCodeSubmissionsByStudent } from '../../services/codeSubmissions.service.js';
import { formatDateTime, getErrorMessage } from '../../lib/firestore.js';

const UNDERSTANDING_LABELS = UNDERSTANDING_LEVELS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

export function StudentHistoryModal({ student, onClose, feedbackOnly = false }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [codeSubmissions, setCodeSubmissions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const classCode = student.classId || student.classCode;
        const f = await listKnowledgeReportsByStudent(student.id);
        const r = feedbackOnly ? [] : await listReportsByStudent(student.id);
        const code = feedbackOnly ? [] : await listCodeSubmissionsByStudent(classCode, student.id);
        if (!cancelled) {
          setReports(r);
          setFeedbacks(f);
          setCodeSubmissions(code);
        }
      } catch (error) {
        if (!cancelled) toast.error(getErrorMessage(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id, student.classId, student.classCode]);

  const timeline = useMemo(() => {
    const items = [
      ...reports.map((r) => ({ kind: 'report', at: r.submittedAt, data: r })),
      ...feedbacks.map((f) => ({ kind: 'feedback', at: f.submittedAt, data: f })),
    ];
    return items.sort((a, b) => (b.at?.getTime?.() ?? 0) - (a.at?.getTime?.() ?? 0));
  }, [reports, feedbacks]);

  const latestReportId = useMemo(() => {
    if (!reports.length) return null;
    return [...reports].sort(
      (a, b) => (b.submittedAt?.getTime?.() ?? 0) - (a.submittedAt?.getTime?.() ?? 0),
    )[0]?.id;
  }, [reports]);

  const codeFileCount = useMemo(
    () => codeSubmissions.reduce((sum, row) => sum + (row.files?.length ?? 0), 0),
    [codeSubmissions],
  );

  const classCode = student.classId || student.classCode;

  return (
    <Modal
      open
      onClose={onClose}
      title={feedbackOnly ? `Phản hồi · ${student.fullName}` : `Lịch sử · ${student.fullName}`}
      size="xl"
    >
      <div className="space-y-4">
        <div className={`grid gap-3 ${feedbackOnly ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-4'}`}>
          {!feedbackOnly && (
            <>
              <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/50">
                <p className="text-xs text-slate-500">Báo cáo tiến độ</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{reports.length}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/50">
                <p className="text-xs text-slate-500">Tiến độ hiện tại</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {student.currentProgressPercent ?? 0}%
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/50">
                <p className="text-xs text-slate-500">File code</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{codeFileCount}</p>
              </div>
            </>
          )}
          <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/50">
            <p className="text-xs text-slate-500">Phản hồi buổi học</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{feedbacks.length}</p>
          </div>
        </div>

        {!feedbackOnly && (student.projectGithubUrl || student.projectCanvaUrl) && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="mb-2 text-xs font-medium text-slate-500">Liên kết sản phẩm</p>
            <ProjectLinksReadonly
              githubUrl={student.projectGithubUrl}
              canvaUrl={student.projectCanvaUrl}
            />
          </div>
        )}

        {!feedbackOnly && (
          <CodeSubmissionsPanel
            submissions={codeSubmissions}
            classCode={classCode}
            studentId={student.id}
          />
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : timeline.length === 0 ? (
          <EmptyState title="Chưa có hoạt động" />
        ) : (
          <div className="space-y-3">
            {timeline.map((item, i) =>
              item.kind === 'report' ? (
                <TimelineReport
                  key={`r-${i}`}
                  report={item.data}
                  isLatest={item.data.id === latestReportId}
                />
              ) : (
                <TimelineFeedback key={`f-${i}`} feedback={item.data} />
              ),
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function TimelineReport({ report, isLatest = false }) {
  return (
    <div
      className={`card-prose min-w-0 overflow-hidden rounded-xl border p-4 ${
        isLatest
          ? 'border-brand-400 bg-brand-50/50 ring-2 ring-brand-400/25 dark:border-brand-500/50 dark:bg-brand-500/10 dark:ring-brand-400/20'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand">Báo cáo tiến độ</Badge>
        {isLatest && <Badge tone="brand">Mới nhất</Badge>}
        <Badge tone={STATUS_TONES[report.status] || 'slate'}>{report.status}</Badge>
        <span className="text-xs text-slate-400">
          {report.submittedAt ? formatDateTime(report.submittedAt) : ''}
        </span>
        <span className="ml-auto text-sm font-semibold text-brand-600 dark:text-brand-300">
          {report.progressPercent}%
        </span>
      </div>
      <p className="mt-2 text-xs font-medium text-slate-500">{report.stage}</p>
      {report.doneToday && (
        <p className="card-prose mt-1.5 text-sm text-slate-700 dark:text-slate-200">
          <span className="font-medium">Đã làm:</span> {report.doneToday}
        </p>
      )}
      {report.nextGoal && (
        <p className="card-prose mt-1 text-sm text-slate-700 dark:text-slate-200">
          <span className="font-medium">Mục tiêu tiếp:</span> {report.nextGoal}
        </p>
      )}
      {report.difficulties && (
        <p className="card-prose mt-1 text-sm text-amber-700 dark:text-amber-300">
          <span className="font-medium">Khó khăn:</span> {report.difficulties}
        </p>
      )}
      <ProjectLinksReadonly
        githubUrl={report.projectGithubUrl}
        canvaUrl={report.projectCanvaUrl}
        className="mt-2"
      />
    </div>
  );
}

function TimelineFeedback({ feedback }) {
  return (
    <div className="card-prose min-w-0 overflow-hidden rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="amber">Phản hồi buổi {feedback.sessionNumber}</Badge>
        <span className="text-xs text-slate-400">
          {feedback.submittedAt ? formatDateTime(feedback.submittedAt) : ''}
        </span>
        <span className="ml-auto text-xs font-medium text-slate-500">
          Mức hiểu: {UNDERSTANDING_LABELS[feedback.understandingLevel] || feedback.understandingLevel}
        </span>
      </div>
      {feedback.understoodTopics && (
        <p className="card-prose mt-2 text-sm text-slate-700 dark:text-slate-200">
          <span className="font-medium">Đã hiểu:</span> {feedback.understoodTopics}
        </p>
      )}
      {feedback.unclearTopics && (
        <p className="card-prose mt-1 text-sm text-slate-700 dark:text-slate-200">
          <span className="font-medium">Chưa rõ:</span> {feedback.unclearTopics}
        </p>
      )}
      {feedback.supportRequest && (
        <p className="card-prose mt-1 text-sm text-amber-700 dark:text-amber-300">
          <span className="font-medium">Cần hỗ trợ:</span> {feedback.supportRequest}
        </p>
      )}
    </div>
  );
}
