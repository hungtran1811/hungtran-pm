import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  School,
  Users,
  AlertTriangle,
  Target,
  BarChart3,
  ClipboardList,
  ChevronRight,
  GraduationCap,
  CalendarDays,
  Gamepad2,
  RefreshCw,
  BookOpen,
  UserRound,
} from 'lucide-react';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { StatCard } from '../../ui/components/StatCard.jsx';
import { SkeletonCardGrid, SkeletonRows } from '../../ui/components/Skeleton.jsx';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { Field, Input, Select } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { setClassCurrentSession } from '../../services/classes.service.js';
import { invalidateAdminDataCache } from '../../lib/adminDataCache.js';
import { loadDashboardOpsSnapshot } from '../../lib/adminPanelData.js';
import { buildDashboardTodayItems } from '../../lib/adminDashboardOps.js';
import { computeDashboardStats } from '../../lib/dashboardStats.js';
import { QuizClassReport } from '../../ui/components/QuizClassReport.jsx';
import { getErrorMessage } from '../../lib/firestore.js';

const TONE_BADGE = {
  amber: 'amber',
  red: 'red',
  brand: 'brand',
};

function formatLoadedAt(date) {
  if (!date) return '';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function QuickAction({ to, icon, title, description, emphasis = false }) {
  return (
    <Link
      to={to}
      className={`group flex h-full flex-col gap-3 rounded-2xl border p-4 transition hover:shadow-md sm:p-5 ${
        emphasis
          ? 'border-brand-300 bg-gradient-to-br from-brand-50 to-white hover:border-brand-400 dark:border-brand-500/40 dark:from-brand-500/10 dark:to-slate-900'
          : 'card hover:border-brand-300 dark:hover:border-brand-500/40'
      }`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
          emphasis
            ? 'bg-brand-600 text-white shadow-sm'
            : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900 dark:text-slate-50">{title}</p>
        <p className="mt-1 text-sm leading-snug text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-300">
        Mở
        <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </span>
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
    <section className="card border-brand-200 bg-gradient-to-br from-brand-50/80 to-white p-5 dark:border-brand-500/30 dark:from-brand-500/5 dark:to-slate-900">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Mở buổi học</h2>
            <p className="text-sm text-slate-500">Cập nhật buổi hiện tại để HS thấy bài & quiz đúng phiên.</p>
          </div>
        </div>
        {selected && (
          <Badge tone="brand">
            Đang mở: buổi {selected.curriculumCurrentSession ?? 0}
          </Badge>
        )}
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
            className="w-28"
          />
        </Field>
        <Button onClick={handleSave} loading={saving} className="sm:mb-0.5">
          Lưu buổi
        </Button>
      </div>
    </section>
  );
}

export function DashboardPage() {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [quizSubmissions, setQuizSubmissions] = useState([]);
  const [feedbackByClass, setFeedbackByClass] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedAt, setLoadedAt] = useState(null);
  const [quizReportClass, setQuizReportClass] = useState('');

  const loadDashboard = useCallback(async (force = false) => {
    try {
      const ops = await loadDashboardOpsSnapshot({ force });
      setClasses(ops.classes);
      setStudents(ops.students);
      setQuizSubmissions(ops.quizSubmissions);
      setFeedbackByClass(ops.feedbackByClass || {});
      setLoadedAt(new Date());
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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

  const stats = useMemo(
    () => computeDashboardStats(classes, students),
    [classes, students],
  );

  const todayItems = useMemo(
    () => buildDashboardTodayItems({ classes, students, feedbackByClass, quizSubmissions }),
    [classes, students, feedbackByClass, quizSubmissions],
  );

  const activeClasses = useMemo(
    () => classes.filter((c) => c.status === 'active'),
    [classes],
  );

  const studentHint = stats.enrolledOnClassDocs !== stats.activeStudents
    ? `${stats.enrolledOnClassDocs} trên hồ sơ lớp`
    : `${stats.activeClasses} lớp đang mở`;

  const handleRefresh = () => {
    setRefreshing(true);
    invalidateAdminDataCache();
    loadDashboard(true);
  };

  return (
    <AppShell title="Tổng quan">
      {loading ? (
        <div className="space-y-6">
          <SkeletonCardGrid count={4} />
          <SkeletonRows count={4} />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Số liệu theo lớp đang vận hành
                {loadedAt ? ` · Cập nhật ${formatLoadedAt(loadedAt)}` : ''}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleRefresh} loading={refreshing}>
              <RefreshCw className="h-4 w-4" />
              Làm mới
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Lớp đang vận hành"
              value={stats.activeClasses}
              hint={`${stats.totalClasses} lớp tổng · ${stats.archivedClasses} đã kết thúc`}
              icon={<School className="h-5 w-5" />}
            />
            <StatCard
              label="Học sinh đang học"
              value={stats.activeStudents}
              hint={studentHint}
              tone="brand"
              icon={<Users className="h-5 w-5" />}
            />
            <StatCard
              label="Cần hỗ trợ"
              value={stats.needsHelp}
              hint="Trong lớp đang mở"
              tone="red"
              icon={<AlertTriangle className="h-5 w-5" />}
            />
            <StatCard
              label="Gần hoàn thành"
              value={stats.nearlyDone}
              hint={`${stats.completedInActive} đã hoàn thành SP · ${stats.alumniStudents} HS lớp cũ`}
              tone="amber"
              icon={<Target className="h-5 w-5" />}
            />
          </div>

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

          <div className="grid gap-6 lg:grid-cols-5">
            <section className="lg:col-span-2">
              <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
                Việc cần chú ý
              </h2>
              <div className="card divide-y divide-slate-100 dark:divide-slate-800">
                {todayItems.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">
                    Không có việc gấp — phản hồi buổi học và quiz đều ổn.
                  </p>
                ) : (
                  todayItems.map((item) => (
                    <Link
                      key={item.id}
                      to={item.to}
                      className="flex items-center gap-3 p-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <Badge tone={TONE_BADGE[item.tone] || 'slate'} className="shrink-0">
                        {item.tone === 'red' ? '!' : item.tone === 'amber' ? '?' : '✓'}
                      </Badge>
                      <span className="min-w-0 flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                        {item.label}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </Link>
                  ))
                )}
              </div>
            </section>

            <section className="lg:col-span-3">
              <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
                Thao tác nhanh
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <QuickAction
                  to="/admin/classes"
                  icon={<School className="h-6 w-6" />}
                  title="Quản lý lớp"
                  description="Danh sách lớp, chương trình, trạng thái buổi học."
                  emphasis
                />
                <QuickAction
                  to="/admin/reports"
                  icon={<ClipboardList className="h-6 w-6" />}
                  title="Báo cáo học sinh"
                  description="Phản hồi buổi học, tiến độ cuối khóa, HS chưa nộp."
                />
                <QuickAction
                  to="/admin/scores"
                  icon={<GraduationCap className="h-6 w-6" />}
                  title="Chấm điểm"
                  description="Quiz, ôn tập, Olympia — xem điểm theo lớp & buổi."
                />
                <QuickAction
                  to="/admin/games"
                  icon={<Gamepad2 className="h-6 w-6" />}
                  title="Mini game"
                  description="Điểm danh có mặt, đoán số, gián điệp, showdown."
                />
                <QuickAction
                  to="/admin/students"
                  icon={<UserRound className="h-6 w-6" />}
                  title="Học sinh"
                  description="Thêm, sửa hồ sơ và trạng thái dự án."
                />
                <QuickAction
                  to="/admin/lessons"
                  icon={<BookOpen className="h-6 w-6" />}
                  title="Bài giảng"
                  description="Nội dung buổi, quiz và bài tập thực hành."
                />
                <QuickAction
                  to="/admin/analytics"
                  icon={<BarChart3 className="h-6 w-6" />}
                  title="Thống kê"
                  description="Biểu đồ tiến độ, hiểu bài và so sánh lớp."
                />
              </div>
            </section>
          </div>

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
