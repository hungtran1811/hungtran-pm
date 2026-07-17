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
import {
  FEATURE_CODE_UPLOAD_ENABLED,
  FEATURE_KNOWLEDGE_FEEDBACK_ENABLED,
  FEATURE_PROGRESS_REPORTS_ENABLED,
} from '../../config/features.js';

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

  const loadFeedback = FEATURE_KNOWLEDGE_FEEDBACK_ENABLED;
  const loadReports = FEATURE_PROGRESS_REPORTS_ENABLED && !feedbackOnly;
  const loadCode = FEATURE_CODE_UPLOAD_ENABLED && !feedbackOnly;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const classCode = student.classId || student.classCode;
        const [f, r, code] = await Promise.all([
          loadFeedback ? listKnowledgeReportsByStudent(student.id) : Promise.resolve([]),
          loadReports ? listReportsByStudent(student.id) : Promise.resolve([]),
          loadCode ? listCodeSubmissionsByStudent(classCode, student.id) : Promise.resolve([]),
        ]);
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
  }, [student.id, student.classId, student.classCode, loadFeedback, loadReports, loadCode]);

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
  const showProgressStats = loadReports;
  const showCodeStats = loadCode;
  const showFeedbackStats = loadFeedback;
  const statCols = [showProgressStats, showProgressStats, showCodeStats, showFeedbackStats].filter(Boolean).length;

  return (
    <Modal
      open
      onClose={onClose}
      title={feedbackOnly ? `Phản hồi · ${student.fullName}` : `Lịch sử · ${student.fullName}`}
      size="xl"
    >
      <div className="space-y-4">
        {statCols > 0 && (
          <div
            className={`grid gap-3 ${
              statCols === 1 ? 'grid-cols-1' : statCols === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'
            }`}
          >
            {showProgressStats && (
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
            {showCodeStats && (
              <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/50">
                <p className="text-xs text-slate-500">File code</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{codeFileCount}</p>
              </div>
            )}
            {showFeedbackStats && (
              <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/50">
                <p className="text-xs text-slate-500">Phản hồi buổi học</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{feedbacks.length}</p>
              </div>
            )}
          </div>
        )}

        {!feedbackOnly && (student.projectGithubUrl || student.projectCanvaUrl) && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="mb-2 text-xs font-medium text-slate-500">Liên kết sản phẩm</p>
            <ProjectLinksReadonly
              githubUrl={student.projectGithubUrl}
              canvaUrl={student.projectCanvaUrl}
            />
          </div>
        )}

        {showCodeStats && (
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
          <EmptyState
            title="Chưa có hoạt động"
            description={
              !loadReports && !loadFeedback
                ? 'Lịch sử báo cáo / phản hồi đang tắt.'
                : undefined
            }
          />
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

function TimelineReport({ report, isLatest }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone="brand">Báo cáo tiến độ</Badge>
        {isLatest && <Badge tone="green">Mới nhất</Badge>}
        <Badge tone={STATUS_TONES[report.status] || 'slate'}>{report.status || '—'}</Badge>
        <span className="text-xs text-slate-400">{formatDateTime(report.submittedAt)}</span>
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-200">
        {report.stage || '—'} · {report.progressPercent ?? 0}%
      </p>
      {report.doneToday && (
        <p className="mt-1 text-xs text-slate-500">Đã làm: {report.doneToday}</p>
      )}
      {report.nextGoal && (
        <p className="mt-1 text-xs text-slate-500">Tiếp theo: {report.nextGoal}</p>
      )}
    </div>
  );
}

function TimelineFeedback({ feedback }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone="amber">Phản hồi buổi {feedback.sessionNumber}</Badge>
        <span className="text-xs text-slate-400">{formatDateTime(feedback.submittedAt)}</span>
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-200">
        Mức hiểu: {UNDERSTANDING_LABELS[feedback.understandingLevel] || feedback.understandingLevel}
      </p>
    </div>
  );
}
