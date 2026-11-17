import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, School } from 'lucide-react';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { Modal } from '../../ui/components/Modal.jsx';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { SkeletonRows } from '../../ui/components/Skeleton.jsx';
import { GroupedProgramSelect } from '../../ui/components/GroupedProgramSelect.jsx';
import { SubjectFilterSelect } from '../../ui/components/SubjectFilterSelect.jsx';
import { Field, Input, Select } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import {
  CLASS_STATUSES,
  CLASS_STATUS_LABELS,
  CURRICULUM_FINAL_MODES,
  CURRICULUM_FINAL_MODE_LABELS,
  CURRICULUM_PHASES,
  CURRICULUM_PHASE_LABELS,
} from '../../constants/index.js';
import {
  createClass,
  deleteClass,
  isArchivedClassStatus,
  setClassStatus,
  subscribeClasses,
  updateClass,
} from '../../services/classes.service.js';
import { invalidateAdminSnapshots, loadFeedbackByClassCodes } from '../../lib/adminPanelData.js';
import { listCurriculumPrograms } from '../../services/curriculum.service.js';
import { averageUnderstanding } from '../../lib/classAnalytics.js';
import { UnderstandingDots } from '../../ui/components/SubmissionDisplay.jsx';
import { useSettings } from '../../state/settings.store.jsx';
import { getErrorMessage } from '../../lib/firestore.js';
import { filterClassesBySubject, subjectsWithClasses } from '../../lib/subjectGroups.js';
import { CodeSubmissionsPurgePanel } from '../../ui/components/CodeSubmissionsPurgePanel.jsx';
import { FEATURE_KNOWLEDGE_FEEDBACK_ENABLED, FEATURE_CODE_UPLOAD_ENABLED } from '../../config/features.js';
import { getPublicBaseUrl } from '../../config/publicUrl.js';
import { classRoadmapSessions, defaultLessonKey } from '../../lib/submissionLessons.js';
import {
  findActiveAliasConflicts,
  suggestStudentAccessCode,
} from '../../lib/classAccessCode.js';
import { upLevelGate } from '../../lib/upLevel.js';
import { UpLevelWizard } from './UpLevelWizard.jsx';
import { auditClassAccessCode } from '../../services/studentGate.service.js';

const STATUS_TONES = { active: 'green', completed: 'blue', archived: 'slate' };

const EMPTY_FORM = {
  classCode: '',
  className: '',
  status: 'active',
  hidden: false,
  startDate: '',
  endDate: '',
  curriculumProgramId: '',
  curriculumPhase: 'learning',
  curriculumCurrentSession: 0,
  finalMode: 'project',
};

export function ClassesPage() {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState('active');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [classSearch, setClassSearch] = useState('');
  const [feedbacksByClass, setFeedbacksByClass] = useState({});
  const [selectedClassCode, setSelectedClassCode] = useState('');

  const reloadPrograms = async () => {
    try {
      setPrograms(await listCurriculumPrograms());
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeClasses(
      (classList) => {
        setClasses(classList);
        setLoading(false);
      },
      (error) => {
        toast.error(getErrorMessage(error));
        setLoading(false);
      },
    );
    reloadPrograms();
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (cls) => {
    setEditing(cls);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteClass(deleteTarget.classCode);
      invalidateAdminSnapshots();
      toast.success('Đã xoá lớp.');
      setDeleteTarget(null);
      setClasses((prev) => prev.filter((c) => c.classCode !== deleteTarget.classCode));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (cls, status) => {
    try {
      await setClassStatus(cls.classCode, status, cls.status);
      invalidateAdminSnapshots();
      toast.success(status === 'completed' ? 'Đã hoàn thành lớp. Tiến độ dự án được giữ nguyên.' : 'Đã khôi phục lớp.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const activeClasses = classes.filter((c) => !isArchivedClassStatus(c.status));
  const archivedClasses = classes.filter((c) => isArchivedClassStatus(c.status));
  const tabClasses = tab === 'active' ? activeClasses : archivedClasses;

  const programsById = useMemo(
    () => Object.fromEntries(programs.map((p) => [p.id, p])),
    [programs],
  );

  const subjectOptions = useMemo(
    () => subjectsWithClasses(tabClasses, programsById),
    [tabClasses, programsById],
  );

  const visibleClasses = useMemo(() => {
    let list = filterClassesBySubject(tabClasses, subjectFilter, programsById);
    const q = classSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.classCode.toLowerCase().includes(q) ||
          String(c.className || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [tabClasses, subjectFilter, programsById, classSearch]);

  const selectedClass = useMemo(
    () => visibleClasses.find((cls) => cls.classCode === selectedClassCode) || null,
    [visibleClasses, selectedClassCode],
  );

  const visibleClassCodes = useMemo(
    () => visibleClasses.map((c) => c.classCode).join('|'),
    [visibleClasses],
  );

  useEffect(() => {
    if (!FEATURE_KNOWLEDGE_FEEDBACK_ENABLED) {
      setFeedbacksByClass({});
      return undefined;
    }
    let cancelled = false;
    const codes = visibleClassCodes ? visibleClassCodes.split('|').filter(Boolean) : [];
    if (!codes.length) {
      setFeedbacksByClass({});
      return undefined;
    }
    loadFeedbackByClassCodes(codes)
      .then((map) => {
        if (cancelled) return;
        setFeedbacksByClass(map);
      })
      .catch((error) => {
        if (!cancelled) {
          setFeedbacksByClass({});
          toast.error(getErrorMessage(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [visibleClassCodes, toast]);

  return (
    <AppShell
      title="Lớp học"
      actions={
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Thêm lớp
        </Button>
      }
    >
      <div className="mb-5 space-y-3">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <TabButton active={tab === 'active'} onClick={() => setTab('active')}>
            Đang hoạt động ({activeClasses.length})
          </TabButton>
          <TabButton active={tab === 'archived'} onClick={() => setTab('archived')}>
            Lưu trữ ({archivedClasses.length})
          </TabButton>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SubjectFilterSelect options={subjectOptions} value={subjectFilter} onChange={setSubjectFilter} />
          {tabClasses.length > 8 ? (
            <div className="max-w-xs">
              <Input
                placeholder="Tìm lớp..."
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
              />
            </div>
          ) : null}
        </div>
      </div>

      {selectedClass ? (
        <ClassProgressPanel
          cls={selectedClass}
          program={programsById[selectedClass.curriculumProgramId]}
          programs={programs}
          classes={classes}
        />
      ) : null}

      {FEATURE_CODE_UPLOAD_ENABLED && tab === 'archived' && (
        <CodeSubmissionsPurgePanel classes={classes} />
      )}

      {loading ? (
        <SkeletonRows count={4} />
      ) : visibleClasses.length === 0 ? (
        <EmptyState
          icon={<School className="h-7 w-7" />}
          title={tab === 'active' ? 'Chưa có lớp đang hoạt động' : 'Chưa có lớp lưu trữ'}
          action={
            tab === 'active' ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Thêm lớp
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleClasses.map((cls) => (
            <ClassCard
              key={cls.id}
              cls={cls}
              programs={programs}
              classes={classes}
              avgUnderstanding={
                FEATURE_KNOWLEDGE_FEEDBACK_ENABLED
                  ? averageUnderstanding(feedbacksByClass[cls.classCode] || [])
                  : null
              }
              sessionAvgUnderstanding={
                FEATURE_KNOWLEDGE_FEEDBACK_ENABLED
                  ? averageUnderstanding(
                      feedbacksByClass[cls.classCode] || [],
                      cls.curriculumCurrentSession,
                    )
                  : null
              }
              selected={cls.classCode === selectedClassCode}
              onSelect={() => setSelectedClassCode(cls.classCode)}
              onEdit={() => openEdit(cls)}
              onDelete={() => setDeleteTarget(cls)}
              onArchive={() => handleStatusChange(cls, 'completed')}
              onRestore={() => handleStatusChange(cls, 'active')}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ClassFormModal
          initial={editing}
          programs={programs}
          classes={classes}
          onClose={() => setShowForm(false)}
          onSaved={() => setShowForm(false)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xoá lớp học"
        message={`Bạn chắc chắn muốn xoá lớp "${deleteTarget?.className || deleteTarget?.classCode}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xoá lớp"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-200'
          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

function ClassProgressPanel({ cls, program, programs, classes }) {
  const [upLevelOpen, setUpLevelOpen] = useState(false);
  const [upLevelEarly, setUpLevelEarly] = useState(false);
  const gate = upLevelGate(cls.curriculumCurrentSession, program?.totalSessionCount);
  const sessions = classRoadmapSessions(cls, program);
  const lessonKey = defaultLessonKey(cls, program);
  const reportHref = lessonKey
    ? `/admin/reports?class=${encodeURIComponent(cls.classCode)}&lesson=${encodeURIComponent(lessonKey)}`
    : `/admin/reports?class=${encodeURIComponent(cls.classCode)}`;
  const phaseLabel = cls.curriculumPhase === 'final' ? 'Sản phẩm' : 'Đang học kiến thức';

  return (
    <section className="card mb-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {cls.classCode} · {cls.className || 'Chưa có tên'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {program?.name || 'Chưa gắn chương trình'}
            {' · '}
            {sessions.length ? `${sessions.length} buổi` : 'Chưa có số buổi'}
            {' · hiện tại buổi '}
            {Number(cls.curriculumCurrentSession) || 0}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">{program?.name || 'Chương trình'}</Badge>
          <Badge tone={cls.curriculumPhase === 'final' ? 'blue' : 'green'}>{phaseLabel}</Badge>
        </div>
      </div>
      {sessions.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Lộ trình buổi">
          {sessions.map((session) => (
            <span
              key={session.lessonKey}
              className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm font-semibold tabular-nums ${
                session.state === 'current'
                  ? 'bg-brand-600 text-white'
                  : session.state === 'opened'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
              }`}
              title={
                session.state === 'current'
                  ? 'Buổi hiện tại'
                  : session.state === 'opened'
                    ? 'Đã mở'
                    : 'Chưa mở'
              }
            >
              {session.sessionNumber}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Chương trình này chưa có tổng số buổi.</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link to={reportHref}>
          <Button size="sm" variant="secondary">Kiểm tra bài nộp</Button>
        </Link>
        {cls.nextClassCode ? (
          <p className="text-sm text-slate-500">Đã chuyển sang {cls.nextClassCode}. Đường dẫn cũ vẫn là lớp này.</p>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              setUpLevelEarly(!gate.ready);
              setUpLevelOpen(true);
            }}
          >
            Up Level
          </Button>
        )}
      </div>
      {upLevelOpen ? (
        <UpLevelWizard
          cls={cls}
          program={program}
          programs={programs}
          classes={classes}
          requireOverride={upLevelEarly}
          onClose={() => setUpLevelOpen(false)}
        />
      ) : null}
    </section>
  );
}

function ClassCard({
  cls,
  programs,
  classes = [],
  avgUnderstanding,
  sessionAvgUnderstanding,
  selected = false,
  onSelect,
  onEdit,
  onDelete,
  onArchive,
  onRestore,
}) {
  const archived = cls.status !== 'active';
  const [upLevelOpen, setUpLevelOpen] = useState(false);
  const toast = useToast();
  const { understandingTone } = useSettings();
  const program = programs.find((p) => p.id === cls.curriculumProgramId);
  const gate = upLevelGate(cls.curriculumCurrentSession, program?.totalSessionCount);
  const studentLink = `${getPublicBaseUrl()}/c/${encodeURIComponent(cls.classCode)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(studentLink);
      toast.success('Đã sao chép link lớp cho học sinh.');
    } catch {
      toast.error('Không sao chép được. Vui lòng thử lại.');
    }
  };

  return (
    <div className={`card flex flex-col p-5 ${selected ? 'ring-2 ring-brand-500' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onSelect} className="min-w-0 text-left">
          <h3 className="truncate text-base font-semibold text-slate-800 dark:text-slate-100">
            {cls.classCode}
          </h3>
          <p className="truncate text-xs text-slate-400">{cls.className || 'Chưa có khóa học'}</p>
        </button>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={STATUS_TONES[cls.status]}>{CLASS_STATUS_LABELS[cls.status] || cls.status}</Badge>
          {cls.hidden && <Badge tone="amber">Đang ẩn</Badge>}
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-400">Giai đoạn</dt>
          <dd className="font-medium text-slate-700 dark:text-slate-200">
            {CURRICULUM_PHASE_LABELS[cls.curriculumPhase] || cls.curriculumPhase}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Buổi hiện tại</dt>
          <dd className="font-medium text-slate-700 dark:text-slate-200">{cls.curriculumCurrentSession}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Học sinh</dt>
          <dd className="font-medium text-slate-700 dark:text-slate-200">{cls.studentCount}</dd>
        </div>
        {FEATURE_KNOWLEDGE_FEEDBACK_ENABLED && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-400">Hiểu bài TB</dt>
            <dd className="flex flex-col items-end gap-1">
              {avgUnderstanding != null ? (
                <>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      (() => {
                        const tone = understandingTone(Math.round(avgUnderstanding));
                        if (tone === 'green') return 'text-emerald-600 dark:text-emerald-400';
                        if (tone === 'amber') return 'text-amber-600 dark:text-amber-400';
                        if (tone === 'red') return 'text-red-600 dark:text-red-400';
                        return 'text-slate-700 dark:text-slate-200';
                      })()
                    }`}
                  >
                    {avgUnderstanding}/5
                  </span>
                  <UnderstandingDots level={Math.round(avgUnderstanding)} />
                </>
              ) : (
                <span className="font-medium text-slate-400">—</span>
              )}
            </dd>
          </div>
        )}
        {FEATURE_KNOWLEDGE_FEEDBACK_ENABLED
          && Number(cls.curriculumCurrentSession) > 0
          && sessionAvgUnderstanding != null && (
          <div className="flex justify-between">
            <dt className="text-slate-400">Buổi {cls.curriculumCurrentSession}</dt>
            <dd className="font-medium text-slate-700 dark:text-slate-200">
              {sessionAvgUnderstanding}/5
            </dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-slate-400">Cuối khóa</dt>
          <dd className="font-medium text-slate-700 dark:text-slate-200">
            {CURRICULUM_FINAL_MODE_LABELS[cls.finalMode] || CURRICULUM_FINAL_MODE_LABELS.project}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Chương trình</dt>
          <dd className="truncate pl-2 text-right font-medium text-slate-700 dark:text-slate-200">
            {program?.name || cls.curriculumProgramId || '—'}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        {!cls.nextClassCode ? (
          <Button size="sm" onClick={() => setUpLevelOpen(true)}>
            Up Level
          </Button>
        ) : (
          <span className="inline-flex min-h-8 items-center text-xs text-slate-500">Đã sang {cls.nextClassCode}</span>
        )}
        <Button size="sm" variant="secondary" onClick={onEdit}>
          Sửa
        </Button>
        <Button size="sm" variant="ghost" onClick={copyLink}>
          Copy link
        </Button>
        <Link to={`/c/${encodeURIComponent(cls.classCode)}`} target="_blank" rel="noreferrer">
          <Button size="sm" variant="ghost">
            Xem
          </Button>
        </Link>
        {archived ? (
          <Button size="sm" variant="ghost" className="ml-auto text-green-600" onClick={onRestore}>
            Khôi phục
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="ml-auto text-amber-600" onClick={onArchive}>
            Hoàn thành
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-red-600" onClick={onDelete}>
          Xoá
        </Button>
      </div>
      {upLevelOpen ? (
        <UpLevelWizard
          cls={cls}
          program={program}
          programs={programs}
          classes={classes}
          requireOverride={!gate.ready}
          onClose={() => setUpLevelOpen(false)}
        />
      ) : null}
    </div>
  );
}

function ClassFormModal({ initial, programs, classes = [], onClose, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(() => {
    const suggestion = suggestStudentAccessCode(initial?.classCode || '');
    return {
      ...EMPTY_FORM,
      ...(initial || {}),
      finalMode: initial?.finalMode === 'exam' ? 'exam' : 'project',
      pinRequired: initial ? Boolean(initial.pinRequired) : true,
      studentAccessCode: initial?.studentAccessCode || suggestion.code,
    };
  });
  const [accessCodeTouched, setAccessCodeTouched] = useState(Boolean(initial?.studentAccessCode));
  const [saving, setSaving] = useState(false);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const updateClassCode = (value) => {
    setForm((prev) => {
      const suggestion = suggestStudentAccessCode(value);
      return {
        ...prev,
        classCode: value,
        studentAccessCode: accessCodeTouched ? prev.studentAccessCode : suggestion.code,
      };
    });
  };

  const suggestion = suggestStudentAccessCode(form.classCode);
  const aliasConflicts = findActiveAliasConflicts(form.studentAccessCode, classes, form.classCode);

  const handleProgramChange = (programId) => {
    const prog = programs.find((p) => p.id === programId);
    setForm((prev) => ({
      ...prev,
      curriculumProgramId: programId,
      ...(!isEdit && prog ? { finalMode: prog.finalMode } : {}),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.classCode.trim()) {
      toast.error('Vui lòng nhập mã lớp.');
      return;
    }
    if (suggestion.needsChoice && !form.studentAccessCode.trim()) {
      toast.error('Mã lớp có nhiều mã ngắn. Hãy chọn một mã để học sinh nhập.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        curriculumCurrentSession: Number(form.curriculumCurrentSession) || 0,
      };
      if (isEdit) {
        await updateClass(initial.classCode, payload);
        invalidateAdminSnapshots();
        toast.success('Đã cập nhật lớp.');
      } else {
        await createClass(form.classCode, payload);
        invalidateAdminSnapshots();
        toast.success('Đã tạo lớp mới.');
      }
      if (payload.studentAccessCode) {
        auditClassAccessCode({
          classCode: isEdit ? initial.classCode : form.classCode.trim(),
          studentAccessCode: payload.studentAccessCode,
        }).catch(() => {});
      }
      await onSaved();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Sửa lớp học' : 'Thêm lớp học'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button form="class-form" type="submit" loading={saving}>
            {isEdit ? 'Lưu thay đổi' : 'Tạo lớp'}
          </Button>
        </>
      }
    >
      <form id="class-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mã lớp" required>
            <Input
              value={form.classCode}
              onChange={(e) => updateClassCode(e.target.value)}
              disabled={isEdit}
              required
            />
          </Field>
          <Field label="Khóa học" required>
            <Input value={form.className} onChange={(e) => update('className', e.target.value)} required />
          </Field>
        </div>

        <Field label="Ngày bắt đầu">
          <Input type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Trạng thái">
            <Select value={form.status} onChange={(e) => update('status', e.target.value)}>
              {CLASS_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Giai đoạn học">
            <Select value={form.curriculumPhase} onChange={(e) => update('curriculumPhase', e.target.value)}>
              {CURRICULUM_PHASES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Chương trình học">
            <GroupedProgramSelect
              programs={programs}
              value={form.curriculumProgramId}
              onChange={handleProgramChange}
              includeEmpty
            />
          </Field>
          <Field label="Hình thức cuối khóa">
            <Select value={form.finalMode} onChange={(e) => update('finalMode', e.target.value)}>
              {CURRICULUM_FINAL_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Buổi hiện tại">
            <Input
              type="number"
              min="0"
              max="50"
              value={form.curriculumCurrentSession}
              onChange={(e) => update('curriculumCurrentSession', e.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Mã học sinh nhập"
          hint={suggestion.needsChoice ? `Chọn một mã: ${suggestion.options.join(', ')}` : 'Ví dụ GB25 hoặc JSB05'}
        >
          <Input
            value={form.studentAccessCode}
            onChange={(e) => {
              setAccessCodeTouched(true);
              update('studentAccessCode', e.target.value);
            }}
          />
        </Field>
        {aliasConflicts.length ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Mã ngắn này đang trùng lớp {aliasConflicts.map((item) => item.classCode).join(', ')}. Học sinh sẽ phải nhập mã đầy đủ.
          </p>
        ) : null}
        <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-3 dark:border-slate-700">
          <input
            type="checkbox"
            checked={Boolean(form.pinRequired)}
            onChange={(e) => update('pinRequired', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">
            Yêu cầu PIN. Lớp đang chạy để tắt nếu học sinh vẫn vào bằng chọn tên.
          </span>
        </label>

        <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-3 dark:border-slate-700">
          <input
            type="checkbox"
            checked={form.hidden}
            onChange={(e) => update('hidden', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">
            Ẩn lớp (học sinh không truy cập được cổng lớp)
          </span>
        </label>
      </form>
    </Modal>
  );
}
