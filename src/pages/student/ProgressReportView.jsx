import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { Field, Textarea, Select } from '../../ui/components/Field.jsx';
import { ToneSelect } from '../../ui/components/ToneSelect.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { STAGES, STAGE_TONES, STATUSES, STATUS_TONES } from '../../constants/index.js';
import { listReportsByStudent, submitProgressReport } from '../../services/reports.service.js';
import { formatDateTime, getErrorMessage } from '../../lib/firestore.js';
import { reportTextError, resolveDifficulties } from '../../lib/progressReports.js';
import { buildStudentLessonOptions, defaultLessonKey } from '../../lib/submissionLessons.js';
import { lessonKeysEqual } from '../../lib/submissionFileName.js';
import { isProjectNameApproved, projectNameAwaitingReview } from '../../lib/classFinalMode.js';
import { ProgressReportHistory } from './ProgressReportHistory.jsx';
import { ProjectLinksReadonly } from './ProjectProductLinks.jsx';
import { ProjectExtrasPanel } from './ProjectExtrasPanel.jsx';

export function ProgressReportView({
  classDoc,
  program,
  student,
  onUpdateStudent,
  onOpenGuide,
  stagePrefill = null,
  onStagePrefillConsumed,
  embedded = false,
  lessonKey: lessonKeyProp,
  onLessonKeyChange,
  hideLessonSelect = false,
  hideHistory = false,
  hideExtras = false,
  unstickFooter = false,
  links: linksProp,
  onChangeLink,
  onContinueAfterSubmit,
}) {
  const toast = useToast();
  const lessonOptions = useMemo(() => buildStudentLessonOptions(classDoc, program), [classDoc, program]);
  const [form, setForm] = useState({
    lessonKey: lessonKeyProp || defaultLessonKey(classDoc, program),
    stage: student.currentStage || STAGES[0],
    status: student.currentStatus || STATUSES[0],
    progressPercent: student.currentProgressPercent || 0,
    doneToday: '',
    nextGoal: '',
    difficulties: '',
  });
  const [recentReports, setRecentReports] = useState([]);
  const [internalLinks, setInternalLinks] = useState({
    githubUrl: student.projectGithubUrl || '',
    canvaUrl: student.projectCanvaUrl || '',
    slidesUrl: student.projectSlidesUrl || '',
    otherUrl: student.projectOtherUrl || '',
  });
  const links = linksProp ?? internalLinks;
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (linksProp) return;
    setInternalLinks({
      githubUrl: student.projectGithubUrl || '',
      canvaUrl: student.projectCanvaUrl || '',
      slidesUrl: student.projectSlidesUrl || '',
      otherUrl: student.projectOtherUrl || '',
    });
  }, [linksProp, student.id, student.projectGithubUrl, student.projectCanvaUrl, student.projectSlidesUrl, student.projectOtherUrl]);

  useEffect(() => {
    if (!student.id) return undefined;
    let cancelled = false;
    listReportsByStudent(student.id, 20)
      .then((rows) => {
        if (!cancelled) setRecentReports(rows.filter((row) => row?.lessonKey));
      })
      .catch(() => {
        if (!cancelled) setRecentReports([]);
      });
    return () => {
      cancelled = true;
    };
  }, [student.id, student.latestReportId]);

  useEffect(() => {
    setForm((prev) => {
      if (lessonOptions.some((option) => option.value === prev.lessonKey)) return prev;
      return { ...prev, lessonKey: defaultLessonKey(classDoc, program) };
    });
  }, [lessonOptions, classDoc, program]);

  useEffect(() => {
    if (!stagePrefill || !STAGES.includes(stagePrefill)) return;
    setForm((prev) => ({ ...prev, stage: stagePrefill }));
    onStagePrefillConsumed?.();
  }, [stagePrefill, onStagePrefillConsumed]);

  useEffect(() => {
    if (!lessonKeyProp) return;
    setForm((prev) => (prev.lessonKey === lessonKeyProp ? prev : { ...prev, lessonKey: lessonKeyProp }));
  }, [lessonKeyProp]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'lessonKey') onLessonKeyChange?.(value);
  };
  const updateLink = (key, value) => {
    if (onChangeLink) {
      onChangeLink(key, value);
      return;
    }
    setInternalLinks((prev) => ({ ...prev, [key]: value }));
  };

  const selectedLesson = lessonOptions.find((item) => item.value === form.lessonKey);

  const validate = () => {
    if (!form.lessonKey || !lessonOptions.some((option) => option.value === form.lessonKey)) {
      return 'Hãy chọn buổi giáo viên đã mở cho lớp.';
    }
    const doneError = reportTextError('đã làm được', form.doneToday);
    if (doneError) return doneError;
    const goalError = reportTextError('mục tiêu buổi sau', form.nextGoal);
    if (goalError) return goalError;
    if (form.status === 'Cần hỗ trợ') {
      const hardshipError = reportTextError('khó khăn', form.difficulties);
      if (hardshipError) return hardshipError;
    }
    if (form.status === 'Hoàn thành' && Number(form.progressPercent) !== 100) {
      return 'Khi chọn "Hoàn thành", tiến độ phải là 100%.';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    const errorMsg = validate();
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await submitProgressReport({
        student,
        classDoc,
        form: {
          ...form,
          projectGithubUrl: links.githubUrl,
          projectCanvaUrl: links.canvaUrl,
          projectSlidesUrl: links.slidesUrl,
          projectOtherUrl: links.otherUrl,
        },
      });
      toast.success('Đã gửi báo cáo.');
      setJustSubmitted(true);
      setRecentReports((prev) => [
        { lessonKey: form.lessonKey, submittedAt: new Date() },
        ...prev.filter((row) => row.lessonKey !== form.lessonKey),
      ]);
      onUpdateStudent?.({
        ...student,
        currentStage: form.stage,
        currentStatus: form.status,
        currentProgressPercent: Number(form.progressPercent),
        currentDifficulties: resolveDifficulties(form.status, form.difficulties),
        projectGithubUrl: links.githubUrl.trim(),
        projectCanvaUrl: links.canvaUrl.trim(),
        projectSlidesUrl: (links.slidesUrl || '').trim(),
        projectOtherUrl: (links.otherUrl || '').trim(),
        lastReportedAt: new Date(),
      });
      setForm((prev) => ({ ...prev, doneToday: '', nextGoal: '', difficulties: '' }));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const pct = Number(form.progressPercent) || 0;
  const canReport = isProjectNameApproved(student);
  const formShellClass = embedded
    ? 'space-y-4'
    : 'card space-y-4 p-5';

  const slimChrome = embedded && hideLessonSelect;
  const reportForm = (
    <form onSubmit={handleSubmit} className={formShellClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {slimChrome ? (
            <div>
              {justSubmitted ? (
                <p className="inline-flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4 student-success-pop" />
                  Đã gửi
                </p>
              ) : null}
              <div className={`flex flex-wrap items-center gap-1.5 text-sm text-slate-500 ${justSubmitted ? 'mt-1' : ''}`}>
                {form.stage ? (
                  <Badge tone={STAGE_TONES[form.stage] || 'slate'}>{form.stage}</Badge>
                ) : (
                  <span>—</span>
                )}
                {form.status ? (
                  <Badge tone={STATUS_TONES[form.status] || 'slate'}>{form.status}</Badge>
                ) : null}
                <span>{student.lastReportedAt ? formatDateTime(student.lastReportedAt) : 'Chưa báo cáo'}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Báo cáo tiến độ</h3>
                {justSubmitted && (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4 student-success-pop" />
                    Đã gửi
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
                <span>{selectedLesson?.label || form.lessonKey}</span>
                {form.stage ? (
                  <Badge tone={STAGE_TONES[form.stage] || 'slate'}>{form.stage}</Badge>
                ) : (
                  <span>—</span>
                )}
                {form.status ? (
                  <Badge tone={STATUS_TONES[form.status] || 'slate'}>{form.status}</Badge>
                ) : null}
                <span>{student.lastReportedAt ? formatDateTime(student.lastReportedAt) : 'Chưa báo cáo'}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {hideExtras ? null : (
        <ProjectLinksReadonly
          githubUrl={student.projectGithubUrl}
          canvaUrl={student.projectCanvaUrl}
          slidesUrl={student.projectSlidesUrl}
          otherUrl={student.projectOtherUrl}
        />
      )}

      {hideLessonSelect ? (
        lessonOptions.length ? null : (
          <p className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Giáo viên chưa đặt buổi hiện tại cho lớp. Chưa gửi được báo cáo.
          </p>
        )
      ) : lessonOptions.length ? (
        <Field label="Buổi" required>
          <Select value={form.lessonKey} onChange={(e) => update('lessonKey', e.target.value)}>
            {lessonOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
                {recentReports.some((row) => lessonKeysEqual(row.lessonKey, option.value)) ? ' · đã gửi' : ''}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Giáo viên chưa đặt buổi hiện tại cho lớp. Chưa gửi được báo cáo.
        </p>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Giai đoạn">
          <ToneSelect
            label="Giai đoạn"
            value={form.stage}
            options={STAGES}
            tones={STAGE_TONES}
            onChange={(value) => update('stage', value)}
          />
        </Field>
        <Field label="Trạng thái">
          <ToneSelect
            label="Trạng thái"
            value={form.status}
            options={STATUSES}
            tones={STATUS_TONES}
            onChange={(value) => update('status', value)}
          />
        </Field>
        <Field label={`Tiến độ ${form.progressPercent}%`}>
          <input
            type="range"
            min="0"
            max="100"
            value={form.progressPercent}
            onChange={(e) => update('progressPercent', Number(e.target.value))}
            className="mt-2 w-full accent-brand-600"
            aria-label="Tiến độ sản phẩm"
          />
        </Field>
      </div>

      <Field label="Đã làm được gì?" required>
        <Textarea
          rows={6}
          value={form.doneToday}
          onChange={(e) => update('doneToday', e.target.value)}
          placeholder="Viết mỗi ý là một gạch đầu dòng (ít nhất 3 gạch đầu dòng)"
          className="min-h-36"
        />
      </Field>

      <Field label="Mục tiêu buổi sau?" required>
        <Textarea
          rows={5}
          value={form.nextGoal}
          onChange={(e) => update('nextGoal', e.target.value)}
          placeholder="Viết mỗi ý là một gạch đầu dòng (ít nhất 3 gạch đầu dòng)"
          className="min-h-28"
        />
      </Field>

      <Field label="Khó khăn (tuỳ chọn)">
        <Textarea
          rows={4}
          value={form.difficulties}
          onChange={(e) => update('difficulties', e.target.value)}
          placeholder={
            form.status === 'Cần hỗ trợ'
              ? 'Viết mỗi ý là một gạch đầu dòng (ít nhất 3 gạch đầu dòng)'
              : 'Để trống nếu chưa vướng. Nếu có, viết mỗi ý một gạch đầu dòng.'
          }
        />
      </Field>

      <div
        className={
          unstickFooter
            ? ''
            : 'student-sticky-footer dark:border-slate-800 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none'
        }
      >
        <Button
          type="submit"
          size="lg"
          className="w-full min-h-12"
          loading={submitting}
          disabled={!lessonOptions.length}
        >
          Gửi báo cáo
        </Button>
        {justSubmitted && onContinueAfterSubmit ? (
          <button
            type="button"
            onClick={onContinueAfterSubmit}
            className="mt-2 w-full min-h-11 text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
          >
            Tiếp: nộp file →
          </button>
        ) : null}
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
      {onOpenGuide ? (
        <button
          type="button"
          onClick={() => onOpenGuide()}
          className="mt-3 text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
        >
          Trong lúc chờ, đọc Hướng dẫn nộp sản phẩm →
        </button>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Đợi giáo viên duyệt tên rồi hãy gửi báo cáo.</p>
      )}
    </div>
  ) : (
    <>
      {reportForm}
      {hideExtras ? null : (
        <ProjectExtrasPanel
          classDoc={classDoc}
          student={student}
          links={links}
          onChangeLink={updateLink}
          onOpenGuide={onOpenGuide}
          disabled={submitting}
        />
      )}
    </>
  );

  return (
    <div className="space-y-4">
      {reportContent}
      {hideHistory ? null : !embedded ? (
        <ProgressReportHistory
          studentId={student.id}
          latestReportId={student.latestReportId}
        />
      ) : (
        <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
          <ProgressReportHistory
            studentId={student.id}
            latestReportId={student.latestReportId}
            embedded
          />
        </div>
      )}
    </div>
  );
}
