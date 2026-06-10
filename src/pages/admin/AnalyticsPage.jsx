import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  BarChart3,
  Users,
  CheckCircle2,
  Gauge,
  Layers,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { StatCard } from '../../ui/components/StatCard.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { SkeletonCardGrid, SkeletonRows } from '../../ui/components/Skeleton.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { filterClassesForAnalytics } from '../../services/classes.service.js';
import { listStudentsByClassCodes } from '../../services/students.service.js';
import { fetchAdminBaseData, invalidateAdminDataCache } from '../../lib/adminDataCache.js';
import { loadAnalyticsByClass } from '../../lib/analyticsData.js';
import {
  aggregateWeeklyProgress,
  classComparisonRows,
  sessionUnderstandingHeatmap,
} from '../../lib/classAnalytics.js';
import { getErrorMessage } from '../../lib/firestore.js';
import { ClassOverviewTable } from '../../ui/components/ClassOverviewTable.jsx';

const TABS = [
  { id: 'active', label: 'Đang hoạt động' },
  { id: 'all', label: 'Tất cả lớp' },
];

const CHART_GRID = 'var(--color-slate-200, #e2e8f0)';
const CHART_TEXT = 'var(--color-slate-500, #64748b)';

export function AnalyticsPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'active';
  const setTab = (id) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', id);
      return next;
    });
  };

  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [feedbacksByClass, setFeedbacksByClass] = useState({});
  const [reportsByClass, setReportsByClass] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const analyticsClasses = useMemo(
    () => filterClassesForAnalytics(classes, showArchived),
    [classes, showArchived],
  );

  const activeClasses = useMemo(
    () => classes.filter((c) => c.status === 'active'),
    [classes],
  );

  const scopeClasses = tab === 'active' ? activeClasses : analyticsClasses;

  const loadAnalytics = async ({ force = false, initial = false } = {}) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const base = await fetchAdminBaseData({ force });
      setClasses(base.classes);

      const codes = filterClassesForAnalytics(base.classes, showArchived).map((c) => c.classCode);
      const scopedStudents = await listStudentsByClassCodes(codes, { activeOnly: true });
      setStudents(scopedStudents);

      const { feedbacksByClass: fb, reportsByClass: rp } = await loadAnalyticsByClass(codes);
      setFeedbacksByClass(fb);
      setReportsByClass(rp);
      setLastLoadedAt(Date.now());
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics({ initial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const handleRefresh = () => {
    invalidateAdminDataCache();
    loadAnalytics({ force: true });
  };

  const scopeClassCodes = useMemo(
    () => new Set(scopeClasses.map((c) => c.classCode)),
    [scopeClasses],
  );

  const scopedStudents = useMemo(
    () => students.filter((s) => s.active && scopeClassCodes.has(s.classCode)),
    [students, scopeClassCodes],
  );

  const scopedFeedbacks = useMemo(
    () => scopeClasses.flatMap((c) => feedbacksByClass[c.classCode] || []),
    [scopeClasses, feedbacksByClass],
  );

  const scopedReports = useMemo(
    () => scopeClasses.flatMap((c) => reportsByClass[c.classCode] || []),
    [scopeClasses, reportsByClass],
  );

  const classOverview = useMemo(
    () => classComparisonRows(scopeClasses, students, feedbacksByClass),
    [scopeClasses, students, feedbacksByClass],
  );

  const summaryStats = useMemo(() => {
    const total = scopedStudents.length;
    const done = scopedStudents.filter((s) => s.currentStatus === 'Hoàn thành').length;
    const needSupport = scopedStudents.filter((s) => s.currentStatus === 'Cần hỗ trợ').length;
    const avgProgress = total
      ? Math.round(
          scopedStudents.reduce((sum, s) => sum + Number(s.currentProgressPercent || 0), 0) / total,
        )
      : 0;
    return {
      classCount: scopeClasses.length,
      total,
      completionRate: total ? Math.round((done / total) * 100) : 0,
      needSupport,
      avgProgress,
    };
  }, [scopedStudents, scopeClasses.length]);

  const weeklyTrend = useMemo(() => aggregateWeeklyProgress(scopedReports), [scopedReports]);
  const heatmap = useMemo(() => sessionUnderstandingHeatmap(scopedFeedbacks), [scopedFeedbacks]);

  return (
    <AppShell title="Thống kê">
      {loading ? (
        <div className="space-y-6">
          <SkeletonCardGrid count={4} />
          <SkeletonRows count={4} />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    tab === t.id
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'all' && (
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Lớp lưu trữ
              </label>
            )}
            <Button
              variant="subtle"
              size="sm"
              onClick={handleRefresh}
              loading={refreshing}
              className="ml-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Làm mới
            </Button>
          </div>

          {lastLoadedAt && <SnapshotBadge loadedAt={lastLoadedAt} />}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={tab === 'active' ? 'Lớp đang hoạt động' : 'Lớp trong phạm vi'}
              value={summaryStats.classCount}
              tone="brand"
              icon={<Activity className="h-5 w-5" />}
            />
            <StatCard label="Tổng học sinh" value={summaryStats.total} icon={<Users className="h-5 w-5" />} />
            <StatCard
              label="Tỉ lệ hoàn thành TB"
              value={`${summaryStats.completionRate}%`}
              tone="green"
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <StatCard
              label="Tiến độ TB"
              value={`${summaryStats.avgProgress}%`}
              tone="amber"
              icon={<Gauge className="h-5 w-5" />}
            />
          </div>

          {classOverview.length === 0 ? (
            <EmptyState
              icon={<Layers className="h-7 w-7" />}
              title={tab === 'active' ? 'Chưa có lớp đang hoạt động' : 'Chưa có lớp trong phạm vi'}
            />
          ) : (
            <ChartCard title="Tổng quan theo lớp">
              <ClassOverviewTable
                rows={classOverview}
                scopeClasses={scopeClasses}
                showStatus={tab === 'all'}
              />
            </ChartCard>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard
              title={
                tab === 'active'
                  ? 'Xu hướng tiến độ theo tuần (lớp đang hoạt động)'
                  : 'Xu hướng tiến độ theo tuần (tất cả lớp)'
              }
            >
              {weeklyTrend.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Chưa có báo cáo tiến độ.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={weeklyTrend}>
                    <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" />
                    <XAxis dataKey="week" tick={{ fill: CHART_TEXT, fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: CHART_TEXT, fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="avg" name="Tiến độ TB %" stroke="#4f46e5" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard
              title={
                tab === 'active'
                  ? 'Mức hiểu bài theo buổi (lớp đang hoạt động)'
                  : 'Mức hiểu bài theo buổi (tất cả lớp)'
              }
            >
              {heatmap.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Chưa có phản hồi buổi học.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={heatmap}>
                    <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" />
                    <XAxis dataKey="session" tick={{ fill: CHART_TEXT, fontSize: 12 }} />
                    <YAxis domain={[0, 5]} tick={{ fill: CHART_TEXT, fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="avg" name="Mức hiểu TB" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SnapshotBadge({ loadedAt }) {
  const time = new Date(loadedAt).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <p className="text-sm text-slate-500">
      Dữ liệu tải lúc {time}. Bấm «Làm mới» để cập nhật.
    </p>
  );
}

function ChartCard({ title, children }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
      {children}
    </section>
  );
}
