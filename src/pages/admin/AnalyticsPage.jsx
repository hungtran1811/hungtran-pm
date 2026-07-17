import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  AlertTriangle,
  Users,
  Layers,
  Activity,
  RefreshCw,
  Download,
  Gauge,
  CheckCircle2,
  ArrowRight,
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
  classComparisonRows,
  studentStatusDistribution,
  progressBucketDistribution,
  buildAttentionItems,
  phaseSplit,
} from '../../lib/classAnalytics.js';
import { getErrorMessage } from '../../lib/firestore.js';
import { ClassOverviewTable } from '../../ui/components/ClassOverviewTable.jsx';
import {
  FEATURE_KNOWLEDGE_FEEDBACK_ENABLED,
  FEATURE_PROGRESS_REPORTS_ENABLED,
} from '../../config/features.js';

const TABS = [
  { id: 'active', label: 'Đang hoạt động' },
  { id: 'all', label: 'Tất cả lớp' },
];

const BAR_TONES = {
  brand: 'bg-brand-500',
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  slate: 'bg-slate-400',
};

const BADGE_TONES = {
  red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
};

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
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [filtersDirty, setFiltersDirty] = useState(false);

  const analyticsClasses = useMemo(
    () => filterClassesForAnalytics(classes, showArchived),
    [classes, showArchived],
  );

  const activeClasses = useMemo(
    () => classes.filter((c) => c.status === 'active'),
    [classes],
  );

  const scopeClasses = tab === 'active' ? activeClasses : analyticsClasses;

  const loadAnalytics = async ({ force = false } = {}) => {
    const isFirstLoad = !hasLoaded;
    if (isFirstLoad) setLoading(true);
    else setRefreshing(true);
    try {
      const base = await fetchAdminBaseData({ force });
      setClasses(base.classes);

      const codes = filterClassesForAnalytics(base.classes, showArchived).map((c) => c.classCode);
      const scopedStudents = await listStudentsByClassCodes(codes, { activeOnly: true });
      setStudents(scopedStudents);

      const { feedbacksByClass: fb } = await loadAnalyticsByClass(codes);
      setFeedbacksByClass(FEATURE_KNOWLEDGE_FEEDBACK_ENABLED ? fb : {});
      setHasLoaded(true);
      setLastLoadedAt(Date.now());
      setFiltersDirty(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLoad = () => loadAnalytics({ force: !hasLoaded });
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

  const classOverview = useMemo(
    () => classComparisonRows(scopeClasses, students, feedbacksByClass),
    [scopeClasses, students, feedbacksByClass],
  );

  const summaryStats = useMemo(() => {
    const total = scopedStudents.length;
    const needSupport = scopedStudents.filter((s) => s.currentStatus === 'Cần hỗ trợ').length;
    const completed = scopedStudents.filter((s) => s.currentStatus === 'Hoàn thành').length;
    const avgProgress = total
      ? Math.round(
          scopedStudents.reduce((sum, s) => sum + Number(s.currentProgressPercent || 0), 0) / total,
        )
      : 0;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    const openClasses = scopeClasses.filter((c) => c.status === 'active').length;
    return {
      openClasses: tab === 'active' ? scopeClasses.length : openClasses,
      totalStudents: total,
      needSupport,
      avgProgress,
      completionRate,
    };
  }, [scopedStudents, scopeClasses, tab]);

  const statusDist = useMemo(() => studentStatusDistribution(scopedStudents), [scopedStudents]);
  const progressDist = useMemo(() => progressBucketDistribution(scopedStudents), [scopedStudents]);
  const attention = useMemo(() => buildAttentionItems(classOverview), [classOverview]);
  const phases = useMemo(() => phaseSplit(scopeClasses), [scopeClasses]);

  const toolbar = (
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
            onChange={(e) => {
              setShowArchived(e.target.checked);
              if (hasLoaded) setFiltersDirty(true);
            }}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Lớp lưu trữ
        </label>
      )}
      {hasLoaded && (
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
      )}
    </div>
  );

  return (
    <AppShell title="Thống kê">
      {!hasLoaded && !loading ? (
        <div className="space-y-5">
          {toolbar}
          <EmptyState
            icon={<BarChart3 className="h-7 w-7" />}
            title="Chưa tải dữ liệu thống kê"
            description="Tải snapshot để xem tổng quan công việc theo lớp và học sinh."
            action={(
              <Button size="lg" onClick={handleLoad}>
                <Download className="h-5 w-5" />
                Tải thống kê
              </Button>
            )}
          />
        </div>
      ) : loading ? (
        <div className="space-y-6">
          {toolbar}
          <SkeletonCardGrid count={4} />
          <SkeletonRows count={5} />
        </div>
      ) : (
        <div className="space-y-6">
          {toolbar}

          {filtersDirty && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              <span>Đã đổi bộ lọc — bấm «Làm mới» để tải lại dữ liệu.</span>
              <Button size="sm" onClick={handleRefresh} loading={refreshing}>
                <RefreshCw className="h-4 w-4" />
                Làm mới
              </Button>
            </div>
          )}

          {lastLoadedAt && <SnapshotBadge loadedAt={lastLoadedAt} />}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={tab === 'active' ? 'Lớp đang mở' : 'Lớp đang hoạt động'}
              value={summaryStats.openClasses}
              hint={`${phases.learning} học · ${phases.finalPhase} cuối khóa`}
              tone="brand"
              icon={<Activity className="h-5 w-5" />}
            />
            <StatCard
              label="Học sinh"
              value={summaryStats.totalStudents}
              hint={`${summaryStats.completionRate}% hoàn thành`}
              icon={<Users className="h-5 w-5" />}
            />
            <StatCard
              label="Tiến độ TB"
              value={`${summaryStats.avgProgress}%`}
              tone="amber"
              icon={<Gauge className="h-5 w-5" />}
            />
            <StatCard
              label="Cần hỗ trợ"
              value={summaryStats.needSupport}
              tone={summaryStats.needSupport > 0 ? 'red' : 'green'}
              icon={<AlertTriangle className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Phân bố trạng thái HS
              </h2>
              <p className="mb-4 text-xs text-slate-400">Toàn bộ học sinh trong phạm vi đang xem</p>
              {scopedStudents.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Chưa có học sinh.</p>
              ) : (
                <DistributionBars items={statusDist} />
              )}
            </section>

            <section className="card p-5">
              <h2 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Phân bố tiến độ
              </h2>
              <p className="mb-4 text-xs text-slate-400">Theo % tiến độ hiện tại trên hồ sơ HS</p>
              {scopedStudents.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Chưa có học sinh.</p>
              ) : (
                <DistributionBars items={progressDist} />
              )}
            </section>
          </div>

          <section className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Cần chú ý hôm nay
                </h2>
                <p className="text-xs text-slate-400">
                  Lớp có HS cần hỗ trợ
                  {FEATURE_PROGRESS_REPORTS_ENABLED ? ' hoặc thiếu báo cáo cuối khóa' : ''}
                </p>
              </div>
              <Link
                to="/admin/students"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
              >
                Mở học sinh
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {attention.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Không có lớp nào đang ở trạng thái cần xử lý.
              </div>
            ) : (
              <ul className="space-y-2">
                {attention.map((item) => (
                  <li
                    key={item.classCode}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/admin/scores?class=${encodeURIComponent(item.classCode)}`}
                          className="font-semibold text-brand-600 hover:underline dark:text-brand-300"
                        >
                          {item.classCode}
                        </Link>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            BADGE_TONES[item.tone] || BADGE_TONES.amber
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                    </div>
                    <Link
                      to={`/admin/scores?class=${encodeURIComponent(item.classCode)}`}
                      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-slate-600 hover:text-brand-600 dark:text-slate-300"
                    >
                      Điểm số
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {classOverview.length === 0 ? (
            <EmptyState
              icon={<Layers className="h-7 w-7" />}
              title={tab === 'active' ? 'Chưa có lớp đang hoạt động' : 'Chưa có lớp trong phạm vi'}
            />
          ) : (
            <section className="card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    So sánh theo lớp
                  </h2>
                  <p className="text-xs text-slate-400">
                    Bấm mã lớp để mở điểm số theo lớp
                  </p>
                </div>
              </div>
              <ClassOverviewTable
                rows={classOverview}
                scopeClasses={scopeClasses}
                showStatus={tab === 'all'}
                showUnderstanding={FEATURE_KNOWLEDGE_FEEDBACK_ENABLED}
                linkToReports={FEATURE_PROGRESS_REPORTS_ENABLED}
                linkToScores={!FEATURE_PROGRESS_REPORTS_ENABLED}
              />
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}

function DistributionBars({ items }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
            <span className="tabular-nums text-slate-500">
              {item.count} · {item.percent}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full transition-all ${BAR_TONES[item.tone] || BAR_TONES.slate}`}
              style={{ width: `${Math.max(4, Math.round((item.count / max) * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SnapshotBadge({ loadedAt }) {
  const time = new Date(loadedAt).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <p className="text-sm text-slate-500">
      Snapshot lúc {time}. Bấm «Làm mới» để cập nhật.
    </p>
  );
}
