import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  School,
  Users,
  Target,
  TrendingUp,
  BarChart3,
  ClipboardList,
  ChevronRight,
  GraduationCap,
  CalendarDays,
  Gamepad2,
} from 'lucide-react';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { StatCard } from '../../ui/components/StatCard.jsx';
import { SkeletonCardGrid, SkeletonRows } from '../../ui/components/Skeleton.jsx';
import { Button } from '../../ui/components/Button.jsx';
import { Field, Input, Select } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { isArchivedClassStatus, setClassCurrentSession } from '../../services/classes.service.js';
import { invalidateAdminDataCache } from '../../lib/adminDataCache.js';
import { loadDashboardOpsSnapshot } from '../../lib/adminPanelData.js';
import { QuizClassReport } from '../../ui/components/QuizClassReport.jsx';
import { getErrorMessage } from '../../lib/firestore.js';

function QuickAction({ to, icon, title }) {
  return (
    <Link
      to={to}
      className="card group flex items-center gap-4 p-4 transition hover:border-brand-400 hover:shadow-md"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-brand-500" />
    </Link>
  );
}

function SessionQuickSet({ classes, onUpdated }) {
  const toast = useToast();
  const activeClasses = useMemo(
    () => classes.filter((c) => c.status === 'active'),
    [classes],
  );
  const [classCode, setClassCode] = useState('');
  const [session, setSession] = useState('0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeClasses.length) {
      setClassCode('');
      setSession('0');
      return;
    }
    const current = activeClasses.find((c) => c.classCode === classCode);
    if (!current) {
      const first = activeClasses[0];
      setClassCode(first.classCode);
      setSession(String(first.curriculumCurrentSession ?? 0));
    }
  }, [activeClasses, classCode]);

  const selected = activeClasses.find((c) => c.classCode === classCode);

  const handleClassChange = (code) => {
    setClassCode(code);
    const cls = activeClasses.find((c) => c.classCode === code);
    setSession(String(cls?.curriculumCurrentSession ?? 0));
  };

  const handleSave = async () => {
    if (!classCode) return;
    setSaving(true);
    try {
      const num = Number(session);
      await setClassCurrentSession(classCode, num);
      onUpdated(classCode, num);
      toast.success(`Đã mở buổi ${num} cho lớp ${classCode}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (!activeClasses.length) return null;

  return (
    <div className="card p-4 sm:col-span-2">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          <CalendarDays className="h-5 w-5" />
        </span>
        <p className="font-semibold text-slate-800 dark:text-slate-100">Mở buổi học</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <Field label="Lớp">
          <Select value={classCode} onChange={(e) => handleClassChange(e.target.value)}>
            {activeClasses.map((c) => (
              <option key={c.classCode} value={c.classCode}>
                {c.classCode}
                {c.className ? ` · ${c.className}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Buổi số">
          <Input
            type="number"
            min="0"
            max="50"
            value={session}
            onChange={(e) => setSession(e.target.value)}
            className="w-24"
          />
        </Field>
        <Button onClick={handleSave} loading={saving} className="sm:mb-0.5">
          Lưu
        </Button>
      </div>
      {selected && (
        <p className="mt-2 text-xs text-slate-400">
          Buổi hiện tại: {selected.curriculumCurrentSession ?? 0}
        </p>
      )}
    </div>
  );
}

export function DashboardPage() {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [quizSubmissions, setQuizSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quizReportClass, setQuizReportClass] = useState('');

  const loadDashboard = async (force = false) => {
    try {
      const ops = await loadDashboardOpsSnapshot({ force });
      setClasses(ops.classes);
      setStudents(ops.students);
      setQuizSubmissions(ops.quizSubmissions);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const active = classes.filter((c) => c.status === 'active');
    if (!active.length) {
      setQuizReportClass('');
      return;
    }
    setQuizReportClass((prev) =>
      prev && active.some((c) => c.classCode === prev) ? prev : active[0].classCode,
    );
  }, [classes]);

  const stats = useMemo(() => {
    const activeClassCodes = new Set(
      classes.filter((c) => c.status === 'active').map((c) => c.classCode),
    );
    const finishedClassCodes = new Set(
      classes.filter((c) => isArchivedClassStatus(c.status)).map((c) => c.classCode),
    );
    const inActiveClass = (s) => s.active && activeClassCodes.has(s.classCode);

    return {
      activeClasses: activeClassCodes.size,
      totalClasses: classes.length,
      students: students.filter(inActiveClass).length,
      nearlyDone: students.filter(
        (s) => inActiveClass(s) && s.currentStatus === 'Gần hoàn thành',
      ).length,
      completedCourse: students.filter(
        (s) =>
          s.active &&
          (s.currentStatus === 'Hoàn thành' || finishedClassCodes.has(s.classCode)),
      ).length,
    };
  }, [classes, students]);

  const activeClasses = useMemo(
    () => classes.filter((c) => c.status === 'active'),
    [classes],
  );

  return (
    <AppShell title="Tổng quan">
      {loading ? (
        <div className="space-y-6">
          <SkeletonCardGrid count={4} />
          <SkeletonRows count={4} />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Lớp đang vận hành"
              value={stats.activeClasses}
              hint={`${stats.totalClasses} lớp tổng`}
              icon={<School className="h-5 w-5" />}
            />
            <StatCard
              label="Học sinh đang học"
              value={stats.students}
              tone="brand"
              icon={<Users className="h-5 w-5" />}
            />
            <StatCard
              label="Gần hoàn thành"
              value={stats.nearlyDone}
              tone="amber"
              icon={<Target className="h-5 w-5" />}
            />
            <StatCard
              label="Đã hoàn thành khóa"
              value={stats.completedCourse}
              tone="green"
              icon={<GraduationCap className="h-5 w-5" />}
            />
          </div>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">Thao tác nhanh</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <QuickAction
                to="/admin/reports"
                icon={<TrendingUp className="h-5 w-5" />}
                title="Báo cáo học sinh"
              />
              <QuickAction
                to="/admin/scores"
                icon={<ClipboardList className="h-5 w-5" />}
                title="Điểm số"
              />
              <QuickAction
                to="/admin/analytics"
                icon={<BarChart3 className="h-5 w-5" />}
                title="Thống kê"
              />
              <QuickAction
                to="/admin/games"
                icon={<Gamepad2 className="h-5 w-5" />}
                title="Mini game — quay tên"
              />
              <SessionQuickSet
                classes={classes}
                onUpdated={(code, session) => {
                  invalidateAdminDataCache();
                  setClasses((prev) =>
                    prev.map((c) =>
                      c.classCode === code ? { ...c, curriculumCurrentSession: session } : c,
                    ),
                  );
                }}
              />
            </div>
          </section>

          {activeClasses.length > 0 && (
            <section>
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  Báo cáo quiz
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Điểm trung bình lớp, câu làm đúng nhiều và câu sai nhiều (buổi hiện tại).
                </p>
              </div>
              <div className="card p-4 sm:p-5">
                <QuizClassReport
                  submissions={quizSubmissions}
                  classes={activeClasses}
                  classCode={quizReportClass}
                  onClassChange={setQuizReportClass}
                />
              </div>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}
