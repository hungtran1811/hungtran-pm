import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { Field, Textarea, Select } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { STAGES, STATUSES, STATUS_TONES } from '../../constants/index.js';
import { submitProgressReport } from '../../services/reports.service.js';
import { formatDateTime, getErrorMessage } from '../../lib/firestore.js';
import { isProjectNameApproved, projectNameAwaitingReview } from '../../lib/classFinalMode.js';

export function ProgressReportView({ classDoc, student, onUpdateStudent }) {
  const toast = useToast();
  const [form, setForm] = useState({
    stage: student.currentStage || STAGES[0],
    status: student.currentStatus || STATUSES[0],
    progressPercent: student.currentProgressPercent || 0,
    doneToday: '',
    nextGoal: '',
    difficulties: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

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
      await submitProgressReport({ student, classDoc, form });
      toast.success('Đã gửi báo cáo.');
      setJustSubmitted(true);
      onUpdateStudent?.({
        ...student,
        currentStage: form.stage,
        currentStatus: form.status,
        currentProgressPercent: Number(form.progressPercent),
        currentDifficulties: form.difficulties.trim(),
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

  return (
    <div className="space-y-5">
      <div className="card overflow-hidden p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-4xl font-bold tabular-nums text-brand-600 dark:text-brand-400">{pct}%</p>
            <p className="mt-1 text-sm text-slate-500">
              {student.currentStage || '—'} ·{' '}
              {student.lastReportedAt ? formatDateTime(student.lastReportedAt) : 'Chưa báo cáo'}
            </p>
          </div>
          <Badge tone={STATUS_TONES[student.currentStatus] || 'slate'}>{student.currentStatus}</Badge>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {!canReport ? (
        <div className="card p-5 text-sm text-slate-600 dark:text-slate-300">
          <p className="font-medium text-slate-800 dark:text-slate-100">Chưa thể báo cáo tiến độ</p>
          <p className="mt-2">
            Tên dự án <em>{projectNameAwaitingReview(student)}</em> đang chờ giáo viên duyệt. Sau khi được duyệt, bạn
            có thể gửi báo cáo tiến độ sản phẩm.
          </p>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="card space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Báo cáo tiến độ</h3>
          {justSubmitted && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              Đã gửi
            </span>
          )}
        </div>

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

        <div className="sticky bottom-0 -mx-5 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
          <Button type="submit" size="lg" className="w-full min-h-12" loading={submitting}>
            Gửi báo cáo
          </Button>
        </div>
      </form>
      )}
    </div>
  );
}
