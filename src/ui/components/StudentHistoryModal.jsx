import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal.jsx';
import { Badge } from './Badge.jsx';
import { Spinner } from './Spinner.jsx';
import { EmptyState } from './EmptyState.jsx';
import { useToast } from './Toast.jsx';
import { STATUS_TONES, UNDERSTANDING_LEVELS } from '../../constants/index.js';
import { listReportsByStudent } from '../../services/reports.service.js';
import { listKnowledgeReportsByStudent } from '../../services/knowledgeReports.service.js';
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const f = await listKnowledgeReportsByStudent(student.id);
        const r = feedbackOnly ? [] : await listReportsByStudent(student.id);
        if (!cancelled) {
          setReports(r);
          setFeedbacks(f);
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
  }, [student.id]);

  const timeline = useMemo(() => {
    const items = [
      ...reports.map((r) => ({ kind: 'report', at: r.submittedAt, data: r })),
      ...feedbacks.map((f) => ({ kind: 'feedback', at: f.submittedAt, data: f })),
    ];
    return items.sort((a, b) => (b.at?.getTime?.() ?? 0) - (a.at?.getTime?.() ?? 0));
  }, [reports, feedbacks]);

  return (
    <Modal
      open
      onClose={onClose}
      title={feedbackOnly ? `Phản hồi · ${student.fullName}` : `Lịch sử · ${student.fullName}`}
      size="xl"
    >
      <div className="space-y-4">
        <div className={`grid gap-3 ${feedbackOnly ? 'grid-cols-1' : 'grid-cols-3'}`}>
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
            </>
          )}
          <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/50">
            <p className="text-xs text-slate-500">Phản hồi buổi học</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{feedbacks.length}</p>
          </div>
        </div>

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
                <TimelineReport key={`r-${i}`} report={item.data} />
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

function TimelineReport({ report }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand">Báo cáo tiến độ</Badge>
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
        <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-200">
          <span className="font-medium">Đã làm:</span> {report.doneToday}
        </p>
      )}
      {report.nextGoal && (
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
          <span className="font-medium">Mục tiêu tiếp:</span> {report.nextGoal}
        </p>
      )}
      {report.difficulties && (
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
          <span className="font-medium">Khó khăn:</span> {report.difficulties}
        </p>
      )}
    </div>
  );
}

function TimelineFeedback({ feedback }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
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
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
          <span className="font-medium">Đã hiểu:</span> {feedback.understoodTopics}
        </p>
      )}
      {feedback.unclearTopics && (
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
          <span className="font-medium">Chưa rõ:</span> {feedback.unclearTopics}
        </p>
      )}
      {feedback.supportRequest && (
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
          <span className="font-medium">Cần hỗ trợ:</span> {feedback.supportRequest}
        </p>
      )}
    </div>
  );
}
