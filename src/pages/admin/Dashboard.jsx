import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  School,
  AlertTriangle,
  BarChart3,
  ClipboardList,
  CalendarDays,
  Gamepad2,
  RefreshCw,
  BookOpen,
  UserRound,
  Upload,
  FileWarning,
} from 'lucide-react';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { SkeletonCardGrid, SkeletonRows } from '../../ui/components/Skeleton.jsx';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { Field, Input, Select } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { ClassOpsBoard, OpsAttentionList } from '../../ui/components/ClassOpsBoard.jsx';
import { CURRICULUM_PHASES, CURRICULUM_PHASE_LABELS } from '../../constants/index.js';
import { setClassCurriculumQuick } from '../../services/classes.service.js';
import { invalidateAdminSnapshots, loadDashboardOpsSnapshot } from '../../lib/adminPanelData.js';
import {
  buildClassOpsRows,
  buildOpsAttentionItems,
  computeDashboardStats,
  computeOpsKpis,
} from '../../lib/dashboardStats.js';
import { getErrorMessage } from '../../lib/firestore.js';
import {
  FEATURE_DRIVE_SUBMISSION_ENABLED,
  FEATURE_PROGRESS_REPORTS_ENABLED,
} from '../../config/features.js';

function formatLoadedAt(date) {
  if (!date) return '';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function CompactKpi({ label, value, hint, tone = 'slate', icon }) {
  const tones = {
    brand: 'text-brand-600 dark:text-brand-300',
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
    green: 'text-emerald-600 dark:text-emerald-400',
    slate: 'text-slate-800 dark:text-slate-100',
  };
  return (
    <div className="card px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        {icon ? <span className={tones[tone] || tones.slate}>{icon}</span> : null}
      </div>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tones[tone] || tones.slate}`}>{value}</p>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

function CompactShortcut({ to, icon, title }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/50 dark:hover:text-brand-300"
    >
      {icon}
      {title}
    </Link>
  );
}

function ShortcutBar() {
  return (
    <nav aria-label="Thao tác nhanh" className="flex flex-wrap gap-2">
      {FEATURE_PROGRESS_REPORTS_ENABLED && (
        <CompactShortcut
          to="/admin/reports"
          icon={<ClipboardList className="h-4 w-4" />}
          title={FEATURE_DRIVE_SUBMISSION_ENABLED ? 'Báo cáo' : 'Báo cáo học sinh'}
        />
      )}
      {FEATURE_DRIVE_SUBMISSION_ENABLED && !FEATURE_PROGRESS_REPORTS_ENABLED && (
        <CompactShortcut
          to="/admin/submissions"
          icon={<Upload className="h-4 w-4" />}
          title="Bài nộp Drive"
        />
      )}
      <CompactShortcut to="/admin/games" icon={<Gamepad2 className="h-4 w-4" />} title="Mini game" />
      <CompactShortcut to="/admin/students" icon={<UserRound className="h-4 w-4" />} title="Học sinh" />
      <CompactShortcut to="/admin/classes" icon={<School className="h-4 w-4" />} title="Lớp học" />
      <CompactShortcut to="/admin/lessons" icon={<BookOpen className="h-4 w-4" />} title="Bài giảng" />
      <CompactShortcut to="/admin/analytics" icon={<BarChart3 className="h-4 w-4" />} title="Thống kê" />
    </nav>
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
  const [phase, setPhase] = useState('learning');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeClasses.length) {
      setClassCode('');
      setSession('0');
      setPhase('learning');
      return;
    }
    const current = activeClasses.find((c) => c.classCode === classCode);
    if (!current) {
      const first = activeClasses[0];
      setClassCode(first.classCode);
      setSession(String(first.curriculumCurrentSession ?? 0));
      setPhase(first.curriculumPhase === 'final' ? 'final' : 'learning');
    }
  }, [activeClasses, classCode]);

  const selected = activeClasses.find((c) => c.classCode === classCode);

  const handleClassChange = (code) => {
    setClassCode(code);
    const cls = activeClasses.find((c) => c.classCode === code);
    setSession(String(cls?.curriculumCurrentSession ?? 0));
    setPhase(cls?.curriculumPhase === 'final' ? 'final' : 'learning');
  };

  const handleSave = async () => {
    if (!classCode) return;
    setSaving(true);
    try {
      const num = Number(session);
      await setClassCurriculumQuick(classCode, {
        sessionNumber: num,
        curriculumPhase: phase,
      });
      onUpdated(classCode, { session: num, phase });
      toast.success(`Đã cập nhật lớp ${classCode}: buổi ${num}, ${CURRICULUM_PHASE_LABELS[phase]}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (!activeClasses.length) return null;

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-brand-600 dark:text-brand-300" />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Đổi buổi</h2>
        {selected && (
          <Badge tone="brand" className="ml-auto">
            B{selected.curriculumCurrentSession ?? 0}
          </Badge>
        )}
      </div>
      <div className="space-y-3">
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
        <div className="flex items-end gap-2">
          <Field label="Buổi số" className="min-w-0 flex-1">
            <Input
              type="number"
              min="0"
              max="50"
              value={session}
              onChange={(e) => setSession(e.target.value)}
            />
          </Field>
          <Button onClick={handleSave} loading={saving} className="shrink-0">
            Lưu
          </Button>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500">Giai đoạn</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Giai đoạn lớp">
            {CURRICULUM_PHASES.map((item) => {
              const active = phase === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPhase(item.value)}
                  className={`inline-flex min-h-10 flex-1 items-center justify-center rounded-xl px-3 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                    active
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800'
                  }`}
                >
                  {item.value === 'final' ? 'Sản phẩm' : 'Học'}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function DashboardPage() {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [submissionsByClass, setSubmissionsByClass] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedAt, setLoadedAt] = useState(null);

  const loadDashboard = useCallback(async (force = false) => {
    try {
      const ops = await loadDashboardOpsSnapshot({ force });
      setClasses(ops.classes);
      setStudents(ops.students);
      setSubmissionsByClass(ops.submissionsByClass || {});
      setLoadedAt(new Date());
      if (!ops.fromCache && ops.failedClassCodes?.length) {
        toast.error(
          `Không tải được sản phẩm Drive của lớp ${ops.failedClassCodes.join(', ')}. Cột sản phẩm hiển thị —.`,
        );
      }
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

  const stats = useMemo(
    () => computeDashboardStats(classes, students),
    [classes, students],
  );

  const opsRows = useMemo(
    () =>
      buildClassOpsRows(classes, students, submissionsByClass, {
        driveEnabled: FEATURE_DRIVE_SUBMISSION_ENABLED,
      }),
    [classes, students, submissionsByClass],
  );

  const attentionItems = useMemo(() => buildOpsAttentionItems(opsRows), [opsRows]);
  const opsKpis = useMemo(() => computeOpsKpis(opsRows), [opsRows]);

  const handleRefresh = () => {
    setRefreshing(true);
    invalidateAdminSnapshots();
    loadDashboard(true);
  };

  const kpiGridClass = FEATURE_DRIVE_SUBMISSION_ENABLED
    ? 'grid grid-cols-2 gap-2 lg:grid-cols-4'
    : 'grid grid-cols-2 gap-2 lg:grid-cols-3';

  const handleSessionUpdated = (code, { session, phase }) => {
    invalidateAdminSnapshots();
    setClasses((prev) =>
      prev.map((c) =>
        c.classCode === code
          ? { ...c, curriculumCurrentSession: session, curriculumPhase: phase }
          : c,
      ),
    );
  };

  return (
    <AppShell
      title="Tổng quan"
      actions={(
        <div className="flex items-center gap-2">
          {loadedAt && !loading ? (
            <p className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">
              {formatLoadedAt(loadedAt)}
            </p>
          ) : null}
          <Button variant="secondary" size="sm" onClick={handleRefresh} loading={refreshing}>
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </Button>
        </div>
      )}
    >
      {loading ? (
        <div className="space-y-5">
          <SkeletonCardGrid count={4} />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <SkeletonRows count={5} />
            <SkeletonRows count={4} />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-3">
            <div className={kpiGridClass}>
              <CompactKpi
                label="Lớp mở"
                value={stats.activeClasses}
                hint={`${stats.archivedClasses} lớp đã kết thúc`}
                tone="brand"
                icon={<School className="h-4 w-4" />}
              />
              <CompactKpi
                label="Cần hỗ trợ"
                value={stats.needsHelp}
                hint="Học sinh đang mở"
                tone={stats.needsHelp > 0 ? 'red' : 'slate'}
                icon={<AlertTriangle className="h-4 w-4" />}
              />
              <CompactKpi
                label="Thiếu báo cáo"
                value={opsKpis.missingReports}
                hint="Lớp làm sản phẩm"
                tone={opsKpis.missingReports > 0 ? 'amber' : 'slate'}
                icon={<ClipboardList className="h-4 w-4" />}
              />
              {FEATURE_DRIVE_SUBMISSION_ENABLED && (
                <CompactKpi
                  label="Thiếu file"
                  value={opsKpis.missingFiles}
                  hint="Buổi hiện tại"
                  tone={opsKpis.missingFiles > 0 ? 'amber' : 'slate'}
                  icon={<FileWarning className="h-4 w-4" />}
                />
              )}
            </div>
            <ShortcutBar />
          </div>

          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
            <section className="order-2 min-w-0 lg:order-none lg:col-start-1">
              <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
                Tình hình lớp
                <span className="ml-2 text-sm font-normal text-slate-500">{opsRows.length} lớp đang mở</span>
              </h2>
              <ClassOpsBoard rows={opsRows} driveEnabled={FEATURE_DRIVE_SUBMISSION_ENABLED} />
            </section>

            <div className="contents lg:col-start-2 lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-20">
              <section className="order-1 lg:order-none">
                <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
                  Cần xử lý
                  {attentionItems.length > 0 ? (
                    <span className="ml-2 text-sm font-normal text-slate-400">{attentionItems.length} mục</span>
                  ) : null}
                </h2>
                <OpsAttentionList items={attentionItems} hasOpenClasses={opsRows.length > 0} />
              </section>
              <div className="order-3 lg:order-none">
                <SessionQuickSet classes={classes} onUpdated={handleSessionUpdated} />
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
