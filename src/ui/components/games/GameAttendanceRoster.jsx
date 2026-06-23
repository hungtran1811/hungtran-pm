import { UserCheck, Users } from 'lucide-react';
import { Button } from '../Button.jsx';
import { Badge } from '../Badge.jsx';

export function GameAttendanceRoster({
  students = [],
  presentStudentIds,
  onPresentChange,
  minPresent = 2,
  minPresentHint,
  disabled = false,
}) {
  const presentCount = presentStudentIds?.size ?? 0;
  const allSelected = students.length > 0 && presentCount === students.length;

  const toggle = (studentId) => {
    if (disabled) return;
    const next = new Set(presentStudentIds);
    if (next.has(studentId)) next.delete(studentId);
    else next.add(studentId);
    onPresentChange(next);
  };

  const selectAll = () => {
    if (disabled) return;
    onPresentChange(new Set(students.map((s) => s.id)));
  };

  const selectNone = () => {
    if (disabled) return;
    onPresentChange(new Set());
  };

  if (!students.length) return null;

  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <UserCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Điểm danh có mặt</p>
            <p className="text-xs text-slate-500">Chỉ học sinh được chọn mới tham gia mini game</p>
          </div>
        </div>
        <Badge tone={presentCount >= minPresent ? 'green' : 'amber'}>
          <Users className="mr-1 inline h-3 w-3" />
          {presentCount} / {students.length} có mặt
        </Badge>
      </div>

      {presentCount < minPresent && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {minPresentHint || `Cần ít nhất ${minPresent} học sinh có mặt để chơi.`}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={disabled || allSelected} onClick={selectAll}>
          Chọn tất cả
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={disabled || presentCount === 0} onClick={selectNone}>
          Bỏ chọn tất cả
        </Button>
      </div>

      <ul className="grid max-h-48 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {students.map((student) => {
          const checked = presentStudentIds?.has(student.id);
          return (
            <li key={student.id}>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition ${
                  checked
                    ? 'border-brand-300 bg-brand-50/80 dark:border-brand-500/40 dark:bg-brand-500/10'
                    : 'border-slate-200 bg-white opacity-70 dark:border-slate-700 dark:bg-slate-900'
                } ${disabled ? 'pointer-events-none opacity-50' : 'hover:border-brand-200'}`}
              >
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={Boolean(checked)}
                  disabled={disabled}
                  onChange={() => toggle(student.id)}
                />
                <span className="truncate font-medium text-slate-800 dark:text-slate-100">{student.fullName}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
