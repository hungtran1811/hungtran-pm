import { useEffect, useMemo, useState } from 'react';
import { Check, History, Plus, School, Users, X } from 'lucide-react';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { Modal } from '../../ui/components/Modal.jsx';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { SelectClassPrompt, LoadingCatState } from '../../ui/components/WaitingCatIllustration.jsx';
import { ClassFilterBar } from '../../ui/components/ClassFilterBar.jsx';
import { Field, Input, Select } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { StudentHistoryModal } from '../../ui/components/StudentHistoryModal.jsx';
import { STAGES, STATUSES, STATUS_TONES } from '../../constants/index.js';
import { subscribeClasses } from '../../services/classes.service.js';
import {
  createStudent,
  deleteStudent,
  reviewProjectName,
  subscribeStudentsByClass,
  updateStudent,
} from '../../services/students.service.js';
import { ALL_CLASSES_VALUE, buildClassesByCode, resolveScopedClasses } from '../../lib/classFilterScope.js';
import { subscribeManyByClass } from '../../lib/multiClassSubscribe.js';
import { formatDateTime, getErrorMessage } from '../../lib/firestore.js';
import {
  canReviewStudentProjectName,
  classUsesProjectNames,
  displayStudentStatus,
  displayStudentStatusTone,
} from '../../lib/classFinalMode.js';

const EMPTY_FORM = {
  fullName: '',
  active: true,
  currentStatus: 'Chưa bắt đầu',
  currentStage: STAGES[0],
  currentProgressPercent: 0,
  currentDifficulties: '',
};

export function StudentsPage() {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const scopedClasses = useMemo(
    () => resolveScopedClasses(classes, selectedClass, showArchived),
    [classes, selectedClass, showArchived],
  );
  const classCodes = useMemo(() => scopedClasses.map((c) => c.classCode), [scopedClasses]);
  const isAllClasses = selectedClass === ALL_CLASSES_VALUE;

  const toggleArchived = (checked) => {
    setShowArchived(checked);
    setSelectedClass('');
  };

  useEffect(() => {
    const unsubscribe = subscribeClasses(
      (list) => {
        setClasses(list);
        setLoadingClasses(false);
        setSelectedClass((prev) => {
          if (prev === ALL_CLASSES_VALUE) return prev;
          if (prev && list.some((c) => c.classCode === prev)) return prev;
          return '';
        });
      },
      (error) => {
        toast.error(getErrorMessage(error));
        setLoadingClasses(false);
      },
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!classCodes.length) {
      setStudents([]);
      return undefined;
    }
    setLoadingStudents(true);
    const onData = (list) => {
      setStudents(list);
      setLoadingStudents(false);
    };
    const onError = (error) => {
      toast.error(getErrorMessage(error));
      setLoadingStudents(false);
    };
    const unsubscribe = subscribeManyByClass(
      classCodes,
      subscribeStudentsByClass,
      onData,
      onError,
    );
    return unsubscribe;
  }, [classCodes.join('|'), toast]);

  const classesByCode = useMemo(() => buildClassesByCode(classes), [classes]);
  const pendingProjectCount = useMemo(
    () =>
      students.filter((s) =>
        canReviewStudentProjectName(s, classesByCode.get(s.classCode)),
      ).length,
    [students, classesByCode],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = students;
    if (q) {
      list = list.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q)
          || s.projectName.toLowerCase().includes(q)
          || s.projectNameSubmission.toLowerCase().includes(q)
          || s.classCode.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      if (isAllClasses && a.classCode !== b.classCode) {
        return a.classCode.localeCompare(b.classCode, 'vi');
      }
      return a.fullName.localeCompare(b.fullName, 'vi');
    });
  }, [students, search, isAllClasses]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteStudent(deleteTarget.id, deleteTarget.classCode);
      toast.success('Đã xoá học sinh.');
      setDeleteTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell
      title="Học sinh"
      actions={
        <Button
          size="sm"
          onClick={() => { setEditing(null); setShowForm(true); }}
          disabled={!selectedClass || isAllClasses}
        >
          <Plus className="h-4 w-4" />
          Thêm học sinh
        </Button>
      }
    >
      {loadingClasses ? (
        <LoadingCatState message="Đang tải danh sách lớp..." />
      ) : classes.length === 0 ? (
        <EmptyState icon={<School className="h-7 w-7" />} title="Chưa có lớp học" />
      ) : (
        <>
          {selectedClass && pendingProjectCount > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              <strong>{pendingProjectCount}</strong> học sinh đang chờ duyệt tên dự án.
            </div>
          )}

          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start">
            <ClassFilterBar
              className="lg:flex-1"
              classes={classes}
              value={selectedClass}
              onChange={setSelectedClass}
              showArchived={showArchived}
              onShowArchivedChange={toggleArchived}
              allowAll
              autoSelectFirst={false}
              allLabel={`Tất cả lớp${showArchived ? ' lưu trữ' : ' đang hoạt động'}`}
              showStudentCount
            />
            <div className="flex-1 lg:max-w-sm">
              <Input
                placeholder={
                  !selectedClass
                    ? 'Chọn lớp để tìm học sinh...'
                    : isAllClasses
                      ? 'Tìm trong tất cả học sinh lớp...'
                      : 'Tìm học sinh trong lớp...'
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={!selectedClass}
              />
            </div>
          </div>

          {!selectedClass ? (
            <SelectClassPrompt
              title="Chọn lớp để xem học sinh"
              description="Chọn lớp ở bộ lọc phía trên để quản lý danh sách học sinh."
            />
          ) : loadingStudents ? (
            <LoadingCatState message="Đang tải học sinh..." />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Users className="h-7 w-7" />}
              title="Chưa có học sinh"
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="hidden grid-cols-12 gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid dark:border-slate-800 dark:bg-slate-800/40">
                <span className={isAllClasses ? 'col-span-4' : 'col-span-3'}>Học sinh</span>
                <span className={isAllClasses ? 'col-span-2' : 'col-span-3'}>Dự án</span>
                <span className="col-span-2">Trạng thái</span>
                <span className="col-span-2">Tiến độ</span>
                <span className="col-span-2 text-right">Thao tác</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((s) => (
                  <StudentRow
                    key={s.id}
                    student={s}
                    showClass={isAllClasses}
                    studentClassDoc={classesByCode.get(s.classCode)}
                    onEdit={() => { setEditing(s); setShowForm(true); }}
                    onDelete={() => setDeleteTarget(s)}
                    onView={() => setHistoryTarget(s)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showForm && !isAllClasses && (
        <StudentFormModal
          initial={editing}
          classCode={selectedClass}
          onClose={() => setShowForm(false)}
          onSaved={() => setShowForm(false)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xoá học sinh"
        message={`Xoá học sinh "${deleteTarget?.fullName}"? Dữ liệu báo cáo cũ vẫn được giữ lại.`}
        confirmLabel="Xoá"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {historyTarget && (
        <StudentHistoryModal student={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}
    </AppShell>
  );
}

function StudentRow({ student, showClass, studentClassDoc, onEdit, onDelete, onView }) {
  const usesProjectNames = classUsesProjectNames(studentClassDoc);
  const toast = useToast();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const handleApprove = async () => {
    setReviewing(true);
    try {
      await reviewProjectName(student.id, { approved: true });
      toast.success(`Đã duyệt tên dự án của ${student.fullName}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setReviewing(false);
    }
  };

  const handleReject = async () => {
    setReviewing(true);
    try {
      await reviewProjectName(student.id, { approved: false, reviewNote: rejectNote });
      toast.success('Đã từ chối tên dự án.');
      setRejectOpen(false);
      setRejectNote('');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setReviewing(false);
    }
  };

  const projectCell = () => {
    if (!usesProjectNames) {
      return <span className="text-slate-400">—</span>;
    }
    if (student.projectNameStatus === 'approved' && student.projectName) {
      return (
        <div className="space-y-1">
          <p className="truncate text-slate-700 dark:text-slate-200">{student.projectName}</p>
          <Badge tone="green">Đã duyệt</Badge>
        </div>
      );
    }
    if (canReviewStudentProjectName(student, studentClassDoc)) {
      const name = student.projectNameSubmission || student.projectName || '—';
      return (
        <div className="space-y-1">
          <p className="truncate font-medium text-slate-700 dark:text-slate-200">{name}</p>
          <Badge tone="amber">Chờ duyệt</Badge>
        </div>
      );
    }
    if (student.projectNameStatus === 'rejected') {
      return (
        <div className="space-y-1">
          <p className="truncate text-slate-600 dark:text-slate-300">{student.projectNameSubmission || '—'}</p>
          <Badge tone="red">Đã từ chối</Badge>
        </div>
      );
    }
    return <span className="text-slate-400">Chưa gửi</span>;
  };

  return (
    <div className="grid grid-cols-1 gap-2 px-5 py-4 md:grid-cols-12 md:items-center md:gap-3">
      <div className={`min-w-0 ${showClass ? 'md:col-span-4' : 'md:col-span-3'}`}>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">
              {student.fullName}
            </p>
            {!student.active && <Badge tone="slate" className="shrink-0">Ẩn</Badge>}
          </div>
          {showClass && (
            <p
              className="mt-0.5 truncate font-mono text-[11px] text-slate-400"
              title={student.classCode}
            >
              {student.classCode}
            </p>
          )}
        </div>
        <div className="mt-1 text-xs text-slate-400 md:hidden">{projectCell()}</div>
      </div>
      <div className={`hidden min-w-0 text-sm md:block ${showClass ? 'md:col-span-2' : 'md:col-span-3'}`}>
        {projectCell()}
      </div>
      <div className="md:col-span-2">
        <Badge tone={displayStudentStatusTone(student, studentClassDoc)}>
          {displayStudentStatus(student, studentClassDoc)}
        </Badge>
      </div>
      <div className="md:col-span-2">
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${student.currentProgressPercent}%` }}
            />
          </div>
          <span className="text-xs font-medium text-slate-500">{student.currentProgressPercent}%</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          {student.lastReportedAt ? formatDateTime(student.lastReportedAt) : 'Chưa báo cáo'}
        </p>
      </div>
      <div className="flex flex-wrap gap-1 md:col-span-2 md:justify-end">
        {canReviewStudentProjectName(student, studentClassDoc) && (
          <>
            <Button size="sm" variant="subtle" onClick={handleApprove} loading={reviewing}>
              <Check className="h-4 w-4" />
              Duyệt
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="text-red-600"
              onClick={() => setRejectOpen(true)}
              disabled={reviewing}
            >
              <X className="h-4 w-4" />
              Từ chối
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={onView} title="Xem lịch sử">
          <History className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="secondary" onClick={onEdit}>
          Sửa
        </Button>
        <Button size="sm" variant="ghost" className="text-red-600" onClick={onDelete}>
          Xoá
        </Button>
      </div>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Từ chối tên dự án"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)} disabled={reviewing}>
              Huỷ
            </Button>
            <Button variant="danger" onClick={handleReject} loading={reviewing}>
              Từ chối
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          Học sinh <strong>{student.fullName}</strong> gửi:{' '}
          <em>{student.projectNameSubmission || student.projectName}</em>
        </p>
        <Field label="Ghi chú cho học sinh (tuỳ chọn)">
          <Input
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Ví dụ: Tên quá chung, hãy cụ thể hơn..."
          />
        </Field>
      </Modal>
    </div>
  );
}

function StudentFormModal({ initial, classCode, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ...(initial || {}) }));
  const [saving, setSaving] = useState(false);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      toast.error('Vui lòng nhập họ tên học sinh.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        classCode,
        currentProgressPercent: Number(form.currentProgressPercent) || 0,
      };
      if (isEdit) {
        await updateStudent(initial.id, payload);
        toast.success('Đã cập nhật học sinh.');
      } else {
        await createStudent(payload);
        toast.success('Đã thêm học sinh.');
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
      title={isEdit ? 'Sửa học sinh' : 'Thêm học sinh'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button form="student-form" type="submit" loading={saving}>
            {isEdit ? 'Lưu thay đổi' : 'Thêm'}
          </Button>
        </>
      }
    >
      <form id="student-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Họ và tên" required>
          <Input value={form.fullName} onChange={(e) => update('fullName', e.target.value)} required />
        </Field>
        {!isEdit && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
            Học sinh sẽ tự đặt tên dự án khi vào cổng lớp (lớp báo cáo sản phẩm).
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Trạng thái">
            <Select value={form.currentStatus} onChange={(e) => update('currentStatus', e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Giai đoạn">
            <Select value={form.currentStage} onChange={(e) => update('currentStage', e.target.value)}>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label={`Tiến độ: ${form.currentProgressPercent}%`}>
          <input
            type="range"
            min="0"
            max="100"
            value={form.currentProgressPercent}
            onChange={(e) => update('currentProgressPercent', e.target.value)}
            className="w-full accent-brand-600"
          />
        </Field>

        <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-3 dark:border-slate-700">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => update('active', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">
            Đang hoạt động (học sinh có thể chọn tên mình ở cổng lớp)
          </span>
        </label>
      </form>
    </Modal>
  );
}
