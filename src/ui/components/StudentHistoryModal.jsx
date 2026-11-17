import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal.jsx';
import { Badge } from './Badge.jsx';
import { Spinner } from './Spinner.jsx';
import { EmptyState } from './EmptyState.jsx';
import { StudentTextBlock } from './StudentTextBlock.jsx';
import { CodeSubmissionsPanel } from './CodeSubmissionsPanel.jsx';
import { ProjectLinksReadonly } from '../../pages/student/ProjectProductLinks.jsx';
import { useToast } from './Toast.jsx';
import { STAGE_TONES, STATUS_TONES, UNDERSTANDING_LEVELS } from '../../constants/index.js';
import { listReportsByStudent } from '../../services/reports.service.js';
import { listKnowledgeReportsByStudent } from '../../services/knowledgeReports.service.js';
import { listCodeSubmissionsByStudent } from '../../services/codeSubmissions.service.js';
import { formatDateTime, getErrorMessage } from '../../lib/firestore.js';
import { formatLessonKey } from '../../lib/submissionFileName.js';
import { approvePinReset, fetchPinStatus, lockStudentPin } from '../../services/studentGate.service.js';
import { Button } from './Button.jsx';
import { MaskedPin } from './ClassPinBoard.jsx';
import {
  FEATURE_CODE_UPLOAD_ENABLED,
  FEATURE_KNOWLEDGE_FEEDBACK_ENABLED,
  FEATURE_PROGRESS_REPORTS_ENABLED,
} from '../../config/features.js';

const UNDERSTANDING_LABELS = UNDERSTANDING_LEVELS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

export function StudentHistoryModal({ student, onClose, onPinChanged, feedbackOnly = false }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [codeSubmissions, setCodeSubmissions] = useState([]);
  const [pinStatus, setPinStatus] = useState(null);
  const [pinBusy, setPinBusy] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    fetchPinStatus(student.id)
      .then((result) => {
        if (!cancelled) setPinStatus(result?.enabled ? result : null);
      })
      .catch(() => {
        if (!cancelled) setPinStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [student.id]);

  const refreshPin = async () => {
    const result = await fetchPinStatus(student.id);
    setPinStatus(result?.enabled ? result : null);
  };

  const classReports = useMemo(() => {
    const code = student.classId || student.classCode;
    return reports.filter((row) => !code || row.classId === code || row.classCode === code);
  }, [reports, student.classId, student.classCode]);

  const timeline = useMemo(() => {
    const items = [
      ...classReports.map((r) => ({ kind: 'report', at: r.submittedAt, data: r })),
      ...feedbacks.map((f) => ({ kind: 'feedback', at: f.submittedAt, data: f })),
    ];
    return items.sort((a, b) => (b.at?.getTime?.() ?? 0) - (a.at?.getTime?.() ?? 0));
  }, [classReports, feedbacks]);

  const latestReport = useMemo(() => {
    if (!classReports.length) return null;
    return [...classReports].sort(
      (a, b) => (b.submittedAt?.getTime?.() ?? 0) - (a.submittedAt?.getTime?.() ?? 0),
    )[0];
  }, [classReports]);
  const latestReportId = latestReport?.id || null;

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
      title={feedbackOnly ? `Phản hồi · ${student.fullName}` : `Hồ sơ · ${student.fullName}`}
      size="xl"
    >
      <div className="space-y-4">
        {!feedbackOnly ? (
          <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hồ sơ</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{student.fullName}</h3>
              {pinStatus ? <MaskedPin pin={pinStatus.pin} hasCredential={pinStatus.hasCredential} /> : null}
            </div>
            <p className="text-sm text-slate-500">{classCode}</p>
            <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-100">
              {student.projectName || 'Chưa có dự án'}
            </p>
            <p className="text-sm text-slate-500">
              {student.currentStage || 'Chưa có giai đoạn'} · {student.currentProgressPercent ?? 0}%
            </p>
            <div className="mt-3">
              <ProjectLinksReadonly
                githubUrl={student.projectGithubUrl}
                canvaUrl={student.projectCanvaUrl}
                slidesUrl={student.projectSlidesUrl}
                otherUrl={student.projectOtherUrl}
              />
            </div>
            {latestReport ? (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                Báo cáo mới nhất · {formatLessonKey(latestReport.lessonKey)} · {formatDateTime(latestReport.submittedAt)}
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Chưa có báo cáo trong lớp này.</p>
            )}
            {pinStatus ? (
              <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
                <p className="text-sm text-slate-700 dark:text-slate-200">PIN · {pinStatus.status}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {pinStatus.status === 'Chờ reset' && pinStatus.requestId ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={pinBusy}
                      onClick={async () => {
                        setPinBusy(true);
                        try {
                          await approvePinReset(pinStatus.requestId);
                          await refreshPin();
                          onPinChanged?.();
                          toast.success('Đã duyệt đặt lại PIN.');
                        } catch (pinError) {
                          toast.error(getErrorMessage(pinError));
                        } finally {
                          setPinBusy(false);
                        }
                      }}
                    >
                      Duyệt đặt lại
                    </Button>
                  ) : null}
                  {pinStatus.status !== 'Chưa tạo' && pinStatus.status !== 'Tạm khóa' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={pinBusy}
                      onClick={async () => {
                        setPinBusy(true);
                        try {
                          await lockStudentPin(student.id);
                          await refreshPin();
                          onPinChanged?.();
                          toast.success('Đã khóa PIN.');
                        } catch (pinError) {
                          toast.error(getErrorMessage(pinError));
                        } finally {
                          setPinBusy(false);
                        }
                      }}
                    >
                      Khóa PIN
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
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
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{classReports.length}</p>
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

        {!feedbackOnly &&
          (student.projectGithubUrl || student.projectCanvaUrl || student.projectSlidesUrl || student.projectOtherUrl) && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="mb-2 text-xs font-medium text-slate-500">Liên kết sản phẩm</p>
            <ProjectLinksReadonly
              githubUrl={student.projectGithubUrl}
              canvaUrl={student.projectCanvaUrl}
              slidesUrl={student.projectSlidesUrl}
              otherUrl={student.projectOtherUrl}
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
        {report.stage ? <Badge tone={STAGE_TONES[report.stage] || 'slate'}>{report.stage}</Badge> : null}
        {report.lessonKey ? <Badge tone="slate">{formatLessonKey(report.lessonKey)}</Badge> : null}
        <span className="text-xs text-slate-400">{formatDateTime(report.submittedAt)}</span>
      </div>
      <p className="mb-3 text-sm text-slate-700 dark:text-slate-200">
        {report.progressPercent ?? 0}%
      </p>
      {report.doneToday ? <StudentTextBlock label="Đã làm được">{report.doneToday}</StudentTextBlock> : null}
      {report.nextGoal ? (
        <div className="mt-3">
          <StudentTextBlock label="Mục tiêu tiếp">{report.nextGoal}</StudentTextBlock>
        </div>
      ) : null}
      {report.difficulties?.trim() ? (
        <div className="mt-3">
          <StudentTextBlock label="Khó khăn">{report.difficulties}</StudentTextBlock>
        </div>
      ) : null}
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
