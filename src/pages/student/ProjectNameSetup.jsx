import { useState } from 'react';
import { FolderKanban, Send } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Field, Input } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { submitProjectName } from '../../services/students.service.js';
import { getErrorMessage } from '../../lib/firestore.js';
import { isProjectNameAwaitingReview, projectNameAwaitingReview } from '../../lib/classFinalMode.js';

export function ProjectNameSetup({ student }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const rejected = student.projectNameStatus === 'rejected';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      toast.error('Tên dự án cần ít nhất 3 ký tự.');
      return;
    }
    if (trimmed.length > 80) {
      toast.error('Tên dự án tối đa 80 ký tự.');
      return;
    }
    setSubmitting(true);
    try {
      await submitProjectName(student.id, trimmed);
      toast.success('Đã gửi tên dự án. Giáo viên sẽ duyệt sớm.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sticky top-[4.25rem] z-20 mb-5">
      <div className="card overflow-hidden border-brand-200 shadow-md dark:border-brand-500/30">
        <div className="flex items-start gap-3 border-b border-brand-100 bg-gradient-to-r from-brand-50 to-white px-4 py-3 dark:border-brand-500/20 dark:from-brand-500/10 dark:to-slate-900">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <FolderKanban className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-800 dark:text-slate-100">Đặt tên dự án (tuỳ chọn bây giờ)</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Gửi một lần khi bạn đã có ý tưởng — giáo viên duyệt trước khi báo cáo tiến độ cuối khóa.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 p-4">
          {rejected && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              <p className="font-medium">Tên dự án chưa được duyệt</p>
              {student.projectNameSubmission && (
                <p className="mt-1">
                  Đã gửi: <em>{student.projectNameSubmission}</em>
                </p>
              )}
              {student.projectNameReviewNote && <p className="mt-1">{student.projectNameReviewNote}</p>}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Field label="Tên dự án">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Website quản lý thư viện"
                  maxLength={80}
                />
              </Field>
            </div>
            <Button type="submit" className="shrink-0 sm:mb-0.5" loading={submitting}>
              <Send className="h-4 w-4" />
              Gửi
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ProjectNamePendingBanner({ student }) {
  if (!isProjectNameAwaitingReview(student)) return null;
  const name = projectNameAwaitingReview(student);
  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      <p className="font-medium">Tên dự án đang chờ giáo viên duyệt</p>
      <p className="mt-1">
        <em>{name}</em> — bạn có thể học bình thường, báo cáo tiến độ sẽ mở sau khi được duyệt.
      </p>
    </div>
  );
}
