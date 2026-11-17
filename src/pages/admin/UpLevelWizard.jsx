import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../ui/components/Button.jsx';
import { Modal } from '../../ui/components/Modal.jsx';
import { Field, Input, Select } from '../../ui/components/Field.jsx';
import { GroupedProgramSelect } from '../../ui/components/GroupedProgramSelect.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { getErrorMessage } from '../../lib/firestore.js';
import {
  findActiveAliasConflicts,
  normalizeClassLookupInput,
  suggestStudentAccessCode,
} from '../../lib/classAccessCode.js';
import { nextMindxProgram } from '../../lib/subjectGroups.js';
import { upLevelGate } from '../../lib/upLevel.js';
import { listActiveStudentsByClass } from '../../services/students.service.js';
import { commitUpLevel } from '../../services/studentGate.service.js';

export function UpLevelWizard({ cls, program, programs = [], classes = [], requireOverride = false, onClose }) {
  const toast = useToast();
  const [targetCode, setTargetCode] = useState('');
  const [className, setClassName] = useState('');
  const [programId, setProgramId] = useState(() => nextMindxProgram(program, programs).program?.id || '');
  const [accessCode, setAccessCode] = useState('');
  const [accessTouched, setAccessTouched] = useState(false);
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState({});
  const [confirmCode, setConfirmCode] = useState('');
  const [override, setOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const gate = upLevelGate(cls.curriculumCurrentSession, program?.totalSessionCount);
  const nextProgram = useMemo(() => nextMindxProgram(program, programs), [program, programs]);
  const suggestion = useMemo(() => suggestStudentAccessCode(targetCode), [targetCode]);
  const conflicts = useMemo(
    () => findActiveAliasConflicts(accessCode, classes, targetCode),
    [accessCode, classes, targetCode],
  );
  const chosenProgram = programs.find((item) => item.id === programId);

  useEffect(() => {
    let cancelled = false;
    listActiveStudentsByClass(cls.classCode)
      .then((rows) => {
        if (cancelled) return;
        setStudents(rows);
        setSelected(Object.fromEntries(rows.map((row) => [row.id, true])));
      })
      .catch((error) => toast.error(getErrorMessage(error)));
    return () => {
      cancelled = true;
    };
  }, [cls.classCode, toast]);

  const updateTarget = (value) => {
    setTargetCode(value);
    if (accessTouched) return;
    const next = suggestStudentAccessCode(value);
    setAccessCode(next.needsChoice ? '' : next.code);
  };

  const toggle = (id) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const submit = async () => {
    const selectedIds = students.filter((student) => selected[student.id]).map((student) => student.id);
    if (requireOverride && !override) {
      toast.error('Hãy xác nhận mở sớm trước buổi cuối.');
      return;
    }
    if (normalizeClassLookupInput(confirmCode) !== normalizeClassLookupInput(targetCode)) {
      toast.error('Hãy gõ lại đúng mã lớp đích.');
      return;
    }
    setSaving(true);
    try {
      const result = await commitUpLevel({
        sourceClassCode: cls.classCode,
        targetClassCode: targetCode,
        className,
        programId,
        studentAccessCode: accessCode,
        selectedIds,
        confirmCode,
        override: requireOverride,
      });
      toast.success(
        result.already
          ? `Lớp này đã chuyển sang ${result.targetClassCode}.`
          : `Đã tạo lớp ${result.targetClassCode}.`,
      );
      onClose();
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
      title="Up Level"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button loading={saving} onClick={submit}>Tạo lớp mới</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Lớp {cls.classCode} giữ nguyên bài và file. Học sinh được chọn sang lớp mới với cùng mã PIN.
          {program ? ` Mốc chương trình hiện tại là buổi ${Number(program.totalSessionCount) || 0}.` : ''}
        </p>
        <Field label="Mã lớp đích" required>
          <Input value={targetCode} onChange={(event) => updateTarget(event.target.value)} autoComplete="off" />
        </Field>
        <Field label="Tên lớp" required>
          <Input value={className} onChange={(event) => setClassName(event.target.value)} />
        </Field>
        <Field label="Chương trình đã có" required hint={chosenProgram ? `${chosenProgram.totalSessionCount || 0} buổi` : 'Không tạo chương trình mới.'}>
          <GroupedProgramSelect programs={programs} value={programId} onChange={setProgramId} includeEmpty emptyLabel="Chọn chương trình" />
        </Field>
        {nextProgram.terminal ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {nextProgram.fromLabel} là bậc cuối của MindX K12. Hãy chọn một chương trình ngoài MindX nếu muốn đi tiếp.
          </p>
        ) : nextProgram.program ? (
          <p className="text-sm text-slate-500">
            Lộ trình MindX: {nextProgram.fromLabel} → {nextProgram.toLabel}. Có thể chọn chương trình khác.
          </p>
        ) : nextProgram.fromLabel ? (
          <p className="text-sm text-slate-500">Không thấy bậc kế của {nextProgram.fromLabel} trong thư viện.</p>
        ) : (
          <p className="text-sm text-slate-500">
            Chương trình này nằm ngoài lộ trình MindX. Hãy tự chọn chương trình đích.
          </p>
        )}
        {suggestion.needsChoice ? (
          <Field label="Mã ngắn" required hint="Có hai đoạn cùng dạng mã ngắn. Hãy chọn một.">
            <Select
              value={accessCode}
              onChange={(event) => {
                setAccessTouched(true);
                setAccessCode(event.target.value);
              }}
            >
              <option value="">Chọn mã ngắn</option>
              {suggestion.options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Mã ngắn" hint="Học sinh có thể nhập mã này. Trùng mã ngắn với lớp đang mở vẫn lưu được.">
            <Input
              value={accessCode}
              onChange={(event) => {
                setAccessTouched(true);
                setAccessCode(event.target.value);
              }}
            />
          </Field>
        )}
        {conflicts.length ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Mã ngắn này đang dùng ở {conflicts.map((item) => item.classCode).join(', ')}. Học sinh sẽ phải nhập mã lớp đầy đủ.
          </p>
        ) : null}
        <fieldset>
          <legend className="label-base">Học sinh chuyển sang lớp mới</legend>
          <div className="mt-2 max-h-48 space-y-2 overflow-auto">
            {students.map((student) => (
              <label key={student.id} className="flex min-h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(selected[student.id])}
                  onChange={() => toggle(student.id)}
                />
                <span>{student.fullName}</span>
              </label>
            ))}
            {students.length === 0 ? <p className="text-sm text-slate-500">Lớp chưa có học sinh đang học.</p> : null}
          </div>
        </fieldset>
        {requireOverride || !gate.ready ? (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={override} onChange={(event) => setOverride(event.target.checked)} />
            <span>Mở sớm trước buổi cuối. Lần này được ghi vào nhật ký.</span>
          </label>
        ) : null}
        <Field label="Gõ lại mã lớp đích" required>
          <Input value={confirmCode} onChange={(event) => setConfirmCode(event.target.value)} autoComplete="off" />
        </Field>
      </div>
    </Modal>
  );
}
