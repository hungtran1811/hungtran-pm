import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../../ui/components/Button.jsx';

export function SubmissionSuccess({
  studentName,
  classCode,
  lessonLabel,
  storedFileName,
  storedFileNames,
  submittedAt,
  requiresReport = false,
  samePageReport = false,
  onAgain,
}) {
  const timeLabel = submittedAt
    ? new Date(submittedAt).toLocaleString('vi-VN', { hour12: false })
    : '';
  const names = Array.isArray(storedFileNames) && storedFileNames.length
    ? storedFileNames.filter(Boolean)
    : storedFileName
      ? [storedFileName]
      : [];

  return (
    <div className="card space-y-5 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="student-success-pop flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Xong
          </p>
          <h2 className="mt-0.5 text-lg font-semibold text-slate-800 dark:text-slate-50">Đã nộp bài</h2>
          {samePageReport ? (
            <p className="mt-1 text-sm text-slate-500">File đã lưu. Gửi báo cáo ở bước 1 nếu chưa gửi.</p>
          ) : requiresReport ? (
            <p className="mt-1 text-sm text-slate-500">File đã lưu. Gửi báo cáo ở tab Dự án nếu chưa gửi.</p>
          ) : null}
        </div>
      </div>

      <dl className="space-y-2 rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/50">
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
          <dd className="max-w-[16rem] text-right font-medium text-slate-800 dark:text-slate-100">
            {names.length ? (
              <ul className="space-y-1">
                {names.map((name) => (
                  <li key={name} className="truncate">
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              storedFileName
            )}
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
