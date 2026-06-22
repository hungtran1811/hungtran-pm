import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { Field, Textarea, Select } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { STAGES, STATUSES, STATUS_TONES } from '../../constants/index.js';
import { submitProgressReport } from '../../services/reports.service.js';
import { formatDateTime, getErrorMessage } from '../../lib/firestore.js';
import { isProjectNameApproved, projectNameAwaitingReview } from '../../lib/classFinalMode.js';
import { ProgressReportHistory } from './ProgressReportHistory.jsx';
import { ProjectLinksReadonly } from './ProjectProductLinks.jsx';
import { ProjectExtrasPanel } from './ProjectExtrasPanel.jsx';

export function ProgressReportView({ classDoc, student, onUpdateStudent, onOpenGuide, embedded = false }) {
  const toast = useToast();
  const [form, setForm] = useState({
    stage: student.currentStage || STAGES[0],
    status: student.currentStatus || STATUSES[0],
    progressPercent: student.currentProgressPercent || 0,
    doneToday: '',
    nextGoal: '',
    difficulties: '',
  });
  const [links, setLinks] = useState({
    githubUrl: student.projectGithubUrl || '',
    canvaUrl: student.projectCanvaUrl || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    setLinks({
      githubUrl: student.projectGithubUrl || '',
      canvaUrl: student.projectCanvaUrl || '',
    });
  }, [student.id, student.projectGithubUrl, student.projectCanvaUrl]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const updateLink = (key, value) => setLinks((prev) => ({ ...prev, [key]: value }));

  const validate = () => {
    if (form.doneToday.trim().length < 10) return 'Phần "đã làm được" cần ít nhất 10 ký tự.';
    if (form.nextGoal.trim().length < 10) return 'Phần "mục tiêu tiếp theo" cần ít nhất 10 ký tự.';
    if (form.status === 'Cần hỗ trợ' && form.difficulties.trim().length < 15) {
      return 'Khi chọn "Cần hỗ trợ", hãy mô tả khó khăn ít nhất 15 ký tự.';
    }
    if (form.status === 'Hoàn thành' && Number(form.progressPercent) !== 100) {
      return 'Khi chọn "Hoàn thành", tiến độ phải là 100%.';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errorMsg = validate();
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }
    setSubmitting(true);
    try {
      await submitProgressReport({
        student,
        classDoc,
        form: {
          ...form,
          projectGithubUrl: links.githubUrl,
          projectCanvaUrl: links.canvaUrl,
        },
      });
      toast.success('Đã gửi báo cáo.');
      setJustSubmitted(true);
      onUpdateStudent?.({
        ...student,
        currentStage: form.stage,
        currentStatus: form.status,
        currentProgressPercent: Number(form.progressPercent),
        currentDifficulties: form.difficulties.trim(),
        projectGithubUrl: links.githubUrl.trim(),
        projectCanvaUrl: links.canvaUrl.trim(),
        lastReportedAt: new Date(),
      });
      setForm((prev) => ({ ...prev, doneToday: '', nextGoal: '', difficulties: '' }));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const pct = student.currentProgressPercent || 0;
  const canReport = isProjectNameApproved(student);
  const formShellClass = embedded
    ? 'space-y-4'
    : 'card space-y-4 p-5';

  const reportForm = (
    <form onSubmit={handleSubmit} className={formShellClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Báo cáo tiến độ</h3>
            {justSubmitted && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Đã gửi
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {student.currentStage || '—'} ·{' '}
            {student.lastReportedAt ? formatDateTime(student.lastReportedAt) : 'Chưa báo cáo'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold tabular-nums text-brand-600 dark:text-brand-400">{pct}%</span>
          <Badge tone={STATUS_TONES[student.currentStatus] || 'slate'}>{student.currentStatus}</Badge>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ProjectLinksReadonly
        githubUrl={student.projectGithubUrl}
        canvaUrl={student.projectCanvaUrl}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Giai đoạn">
          <Select value={form.stage} onChange={(e) => update('stage', e.target.value)}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Trạng thái">
          <Select value={form.status} onChange={(e) => update('status', e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`Tiến độ ${form.progressPercent}%`}>
          <input
            type="range"
            min="0"
            max="100"
            value={form.progressPercent}
            onChange={(e) => update('progressPercent', Number(e.target.value))}
            className="mt-2 w-full accent-brand-600"
          />
        </Field>
      </div>

      <Field label="Đã làm được gì?" required>
        <Textarea
          rows={3}
          value={form.doneToday}
          onChange={(e) => update('doneToday', e.target.value)}
          placeholder="Ví dụ: hoàn thành màn hình đăng nhập, kết nối cơ sở dữ liệu... (ít nhất 10 ký tự)"
        />
      </Field>

      <Field label="Mục tiêu buổi sau?" required>
        <Textarea
          rows={3}
          value={form.nextGoal}
          onChange={(e) => update('nextGoal', e.target.value)}
          placeholder="Ví dụ: làm chức năng thêm sản phẩm... (ít nhất 10 ký tự)"
        />
      </Field>

      <Field label="Khó khăn (tuỳ chọn)">
        <Textarea
          rows={2}
          value={form.difficulties}
          onChange={(e) => update('difficulties', e.target.value)}
          placeholder={
            form.status === 'Cần hỗ trợ'
              ? 'Mô tả khó khăn (ít nhất 15 ký tự)...'
              : 'Ghi khó khăn nếu có...'
          }
        />
      </Field>

      <div className="student-sticky-footer dark:border-slate-800 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <Button type="submit" size="lg" className="w-full min-h-12" loading={submitting}>
          Gửi báo cáo
        </Button>
      </div>
    </form>
  );

  const reportContent = !canReport ? (
    <div className={embedded ? 'rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10' : 'card p-5 text-sm'}>
      <p className="font-medium text-slate-800 dark:text-slate-100">Chưa thể báo cáo tiến độ</p>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        Tên dự án <em>{projectNameAwaitingReview(student)}</em> đang chờ giáo viên duyệt. Sau khi được duyệt, bạn
        có thể gửi báo cáo tiến độ sản phẩm.
      </p>
    </div>
  ) : (
    <>
      {reportForm}
      <ProjectExtrasPanel
        classDoc={classDoc}
        student={student}
        links={links}
        onChangeLink={updateLink}
        onOpenGuide={onOpenGuide}
        disabled={submitting}
      />
    </>
  );

  return (
    <div className="space-y-4">
      {reportContent}
      {!embedded && <ProgressReportHistory studentId={student.id} />}
    </div>
  );
}
