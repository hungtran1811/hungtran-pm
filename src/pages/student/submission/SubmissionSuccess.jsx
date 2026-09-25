import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../../ui/components/Button.jsx';

export function SubmissionSuccess({
  studentName,
  classCode,
  lessonLabel,
  storedFileName,
  submittedAt,
  requiresReport = false,
  samePageReport = false,
  onAgain,
}) {
  const timeLabel = submittedAt
    ? new Date(submittedAt).toLocaleString('vi-VN', { hour12: false })
    : '';

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-50">Đã nộp bài</h2>
          {samePageReport ? (
            <p className="mt-1 text-sm text-slate-500">File đã lưu. Gửi báo cáo ở bước 1 nếu chưa gửi.</p>
          ) : requiresReport ? (
            <p className="mt-1 text-sm text-slate-500">File đã lưu. Gửi báo cáo ở tab Dự án nếu chưa gửi.</p>
          ) : null}
        </div>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Học sinh</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-100">{studentName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Lớp</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-100">{classCode}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Buổi</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-100">{lessonLabel}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">File</dt>
          <dd className="max-w-[16rem] truncate text-right font-medium text-slate-800 dark:text-slate-100">
            {storedFileName}
          </dd>
        </div>
        {timeLabel ? (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Thời gian</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-100">{timeLabel}</dd>
          </div>
        ) : null}
      </dl>

      <Button type="button" className="w-full min-h-12" onClick={onAgain}>
        Nộp bài khác
      </Button>
    </div>
  );
}
