import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  School,
  Users,
  Flag,
  Target,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  ClipboardList,
  ChevronRight,
  GraduationCap,
  CalendarDays,
} from 'lucide-react';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { StatCard } from '../../ui/components/StatCard.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { SkeletonCardGrid, SkeletonRows } from '../../ui/components/Skeleton.jsx';
import { Button } from '../../ui/components/Button.jsx';
import { Field, Input, Select } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { STATUS_TONES } from '../../constants/index.js';
import {
  isArchivedClassStatus,
  setClassCurrentSession,
} from '../../services/classes.service.js';
import { fetchAdminBaseData, invalidateAdminDataCache } from '../../lib/adminDataCache.js';
import { formatDateTime, getErrorMessage } from '../../lib/firestore.js';

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
  const [loading, setLoading] = useState(true);

  const loadDashboard = async (force = false) => {
    try {
      const base = await fetchAdminBaseData({ force });
      setClasses(base.classes);
      setStudents(base.students);
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

  const classSets = useMemo(() => {
    const activeClassCodes = new Set(
      classes.filter((c) => c.status === 'active').map((c) => c.classCode),
    );
    const archivedClassCodes = new Set(
      classes.filter((c) => isArchivedClassStatus(c.status)).map((c) => c.classCode),
    );
    return { activeClassCodes, archivedClassCodes };
  }, [classes]);

  const studentCountByClass = useMemo(() => {
    const map = {};
    students
      .filter((s) => s.active)
      .forEach((s) => {
        map[s.classCode] = (map[s.classCode] || 0) + 1;
      });
    return map;
  }, [students]);

  const stats = useMemo(() => {
    const { activeClassCodes, archivedClassCodes } = classSets;
    const inActiveClass = (s) => s.active && activeClassCodes.has(s.classCode);
    const inArchivedClass = (s) => s.active && archivedClassCodes.has(s.classCode);
    const activeStudents = students.filter(inActiveClass);

    return {
      activeClasses: activeClassCodes.size,
      totalClasses: classes.length,
      students: activeStudents.length,
      needSupport: activeStudents.filter((s) => s.currentStatus === 'Cần hỗ trợ').length,
      nearlyDone: activeStudents.filter((s) => s.currentStatus === 'Gần hoàn thành').length,
      completedCourse: students.filter(inArchivedClass).length,
    };
  }, [classes, students, classSets]);

  const attention = useMemo(
    () =>
      students
        .filter(
          (s) =>
            s.active &&
            s.currentStatus === 'Cần hỗ trợ' &&
            classSets.activeClassCodes.has(s.classCode),
        )
        .sort((a, b) => (b.lastReportedAt?.getTime() || 0) - (a.lastReportedAt?.getTime() || 0))
        .slice(0, 8),
    [students, classSets],
  );

  return (
    <AppShell title="Tổng quan">
      {loading ? (
        <div className="space-y-6">
          <SkeletonCardGrid count={5} />
          <SkeletonRows count={4} />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
              label="Cần hỗ trợ"
              value={stats.needSupport}
              tone="red"
              icon={<Flag className="h-5 w-5" />}
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

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Cần hỗ trợ</h2>
              <Link to="/admin/students" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
                Xem tất cả học sinh
              </Link>
            </div>
            {attention.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="h-7 w-7 text-green-500" />} title="Không có học sinh cần hỗ trợ" />
            ) : (
              <div className="card divide-y divide-slate-100 dark:divide-slate-800">
                {attention.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800 dark:text-slate-100">{s.fullName}</p>
                      <p className="truncate text-xs text-slate-400">
                        {s.classCode} · {s.currentDifficulties || 'Không ghi rõ khó khăn'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={STATUS_TONES[s.currentStatus] || 'slate'}>{s.currentStatus}</Badge>
                      <span className="hidden text-xs text-slate-400 sm:inline">
                        {s.lastReportedAt ? formatDateTime(s.lastReportedAt) : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Lớp học</h2>
              <Link to="/admin/classes" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
                Quản lý lớp
              </Link>
            </div>
            {classes.length === 0 ? (
              <EmptyState icon={<School className="h-7 w-7" />} title="Chưa có lớp học" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {classes
                  .filter((c) => c.status === 'active')
                  .slice(0, 6)
                  .map((c) => (
                  <Link key={c.id} to="/admin/classes" className="card p-4 transition hover:shadow-md">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate font-semibold text-slate-800 dark:text-slate-100">
                        {c.classCode}
                      </h3>
                      <Badge tone={c.status === 'active' ? 'green' : 'slate'}>
                        {c.status === 'active' ? 'Hoạt động' : c.status}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-400">{c.className || 'Chưa có khóa học'}</p>
                    <p className="mt-2 text-sm text-slate-500">
                      {studentCountByClass[c.classCode] ?? c.studentCount ?? 0} học sinh · buổi{' '}
                      {c.curriculumCurrentSession}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
