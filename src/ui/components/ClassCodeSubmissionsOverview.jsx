import { FileCode2 } from 'lucide-react';
import { Badge } from './Badge.jsx';

export function ClassCodeSubmissionsOverview({ codeByStudent, students, onSelectStudent }) {
  const rows = students
    .map((student) => {
      const stats = codeByStudent.get(student.id);
      if (!stats) return null;
      return { student, stats };
    })
    .filter(Boolean)
    .sort((a, b) => b.stats.latestSession - a.stats.latestSession || b.stats.fileCount - a.stats.fileCount);

  if (!rows.length) {
    return (
      <div className="mb-4 rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
          <FileCode2 className="h-4 w-4" />
          File code theo buổi
        </div>
        <p className="mt-1">Chưa có học sinh nào nộp file code trong lớp này.</p>
      </div>
    );
  }

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <FileCode2 className="h-4 w-4 text-slate-500" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">File code theo buổi</p>
          <Badge tone="brand">{rows.length} học sinh</Badge>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">Nhấn tên học sinh để xem chi tiết, xem trước hoặc tải file.</p>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map(({ student, stats }) => (
          <button
            key={student.id}
            type="button"
            onClick={() => onSelectStudent(student)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{student.fullName}</p>
              <p className="text-xs text-slate-500">
                Buổi gần nhất: {stats.latestSession} · {stats.sessionCount} buổi đã nộp
              </p>
            </div>
            <Badge tone="slate">{stats.fileCount} file</Badge>
          </button>
        ))}
      </div>
    </div>
  );
}
