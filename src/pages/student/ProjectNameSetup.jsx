import { useState } from 'react';
import { FolderKanban, Send } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Field, Input, Textarea } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { submitProjectName } from '../../services/students.service.js';
import { getErrorMessage } from '../../lib/firestore.js';
import { isProjectNameAwaitingReview, projectNameAwaitingReview } from '../../lib/classFinalMode.js';

export function ProjectNameSetup({ student }) {
  const toast = useToast();
  const rejected = student.projectNameStatus === 'rejected';
  const [name, setName] = useState(
    () => (rejected ? student.projectNameSubmission || '' : ''),
  );
  const [topic, setTopic] = useState(() => student.projectTopic || '');
  const [problem, setProblem] = useState(() => student.projectProblemSolution || '');
  const [features, setFeatures] = useState(() => student.projectPlannedFeatures || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitProjectName(student.id, {
        projectName: name,
        projectTopic: topic,
        projectProblemSolution: problem,
        projectPlannedFeatures: features,
      });
      toast.success('Đã gửi đề xuất dự án. Giáo viên sẽ duyệt sớm.');
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
            <p className="font-semibold text-slate-800 dark:text-slate-100">Đề xuất sản phẩm cá nhân</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Điền tên, chủ đề, vấn đề và tính năng dự kiến — giáo viên duyệt trước khi báo cáo tiến độ cuối khóa.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 p-4">
          {rejected && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              <p className="font-medium">Đề xuất chưa được duyệt — hãy chỉnh sửa và gửi lại</p>
              {student.projectNameSubmission && (
                <p className="mt-1">
                  Đã gửi: <em>{student.projectNameSubmission}</em>
                </p>
              )}
              {student.projectNameReviewNote && <p className="mt-1">{student.projectNameReviewNote}</p>}
            </div>
          )}

          <Field label="Tên dự án" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Website quản lý thư viện lớp"
              maxLength={80}
            />
          </Field>

          <Field label="Chủ đề" required>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ví dụ: Quản lý sách / Theo dõi thói quen học tập"
              maxLength={120}
            />
          </Field>

          <Field label="Vấn đề — cách giải quyết" required>
            <Textarea
              rows={3}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Ai gặp khó khăn gì? Sản phẩm của bạn giúp họ như thế nào?"
              maxLength={800}
            />
          </Field>

          <Field label="Các tính năng dự kiến" required>
            <Textarea
              rows={3}
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              placeholder="Liệt kê 3–5 tính năng chính bạn dự định làm (mỗi dòng một ý)."
              maxLength={800}
            />
          </Field>

          <Button type="submit" className="w-full min-h-11" loading={submitting}>
            <Send className="h-4 w-4" />
            Gửi đề xuất dự án
          </Button>
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
      <p className="font-medium">Đề xuất dự án đang chờ giáo viên duyệt</p>
      <p className="mt-1">
        <em>{name}</em>
        {student.projectTopic ? ` · Chủ đề: ${student.projectTopic}` : ''}
        {' — '}bạn có thể học bình thường; báo cáo tiến độ mở sau khi được duyệt.
      </p>
    </div>
  );
}
