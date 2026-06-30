import { useState } from 'react';
import { Activity, Database, Download, Music, Play, Trash2, Volume2 } from 'lucide-react';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { Button } from '../../ui/components/Button.jsx';
import { Field } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { useGameSound } from '../../hooks/useGameSound.js';
import { FEEDBACK_CACHE_TTL_MS, invalidateAdminSnapshots } from '../../lib/adminPanelData.js';
import { clearLocalDrafts } from '../../lib/localDraftCleanup.js';
import { useSettings } from '../../state/settings.store.jsx';
import { buildInfo } from '../../config/buildInfo.js';
import { listClasses } from '../../services/classes.service.js';
import { getCurriculumProgram, listCurriculumPrograms } from '../../services/curriculum.service.js';
import { listAllStudents } from '../../services/students.service.js';
import { downloadTextFile } from '../../utils/downloadFile.js';
import { getErrorMessage } from '../../lib/firestore.js';

const SOUND_LIBRARY = [
  { id: 'tap', label: 'Chạm / chọn', description: 'Khi bấm nút, chọn ô.' },
  { id: 'tick', label: 'Đếm giờ', description: 'Tiếng tích tắc khi đang đếm ngược.' },
  { id: 'stop', label: 'Dừng lại', description: 'Khi kết thúc lượt hoặc dừng.' },
  { id: 'reveal', label: 'Hé lộ kết quả', description: 'Khi mở đáp án, lật thẻ.' },
  { id: 'win', label: 'Chiến thắng', description: 'Khi có người thắng.' },
  { id: 'cheer', label: 'Reo hò', description: 'Hiệu ứng cổ vũ rộn ràng.' },
  { id: 'buzz', label: 'Trả lời sai', description: 'Báo hiệu sai hoặc hết giờ.' },
  { id: 'spin', label: 'Quay vòng', description: 'Khi vòng quay đang chạy.' },
  { id: 'spin-stop', label: 'Dừng vòng quay', description: 'Khi vòng quay dừng tại kết quả.' },
  { id: 'suspense', label: 'Hồi hộp', description: 'Tạo cảm giác chờ đợi căng thẳng.' },
];

function SettingsSection({ icon: Icon, title, description, children }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function SoundSettings() {
  const { muted, volume, setMuted, setVolume } = useSettings();

  return (
    <SettingsSection
      icon={Volume2}
      title="Âm thanh mini game"
      description="Áp dụng cho Mystery Box, Vòng quay may mắn và các game có hiệu ứng âm thanh."
    >
      <div className="space-y-4">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Bật âm thanh</span>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            checked={!muted}
            onChange={(e) => setMuted(!e.target.checked)}
          />
        </label>

        <Field label={`Âm lượng (${Math.round(volume * 100)}%)`}>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            disabled={muted}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            className="w-full accent-brand-600 disabled:opacity-40"
          />
        </Field>
      </div>
    </SettingsSection>
  );
}

function SoundLibrary() {
  const { muted } = useSettings();
  const { play, enableSound } = useGameSound();

  const handlePlay = async (id) => {
    await enableSound();
    play(id);
  };

  return (
    <SettingsSection
      icon={Music}
      title="Thư viện âm thanh hệ thống"
      description="Nghe thử từng hiệu ứng âm thanh dùng trong các mini game."
    >
      {muted && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          Âm thanh đang tắt. Bật âm thanh ở mục trên để nghe thử.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {SOUND_LIBRARY.map((sound) => (
          <div
            key={sound.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40"
          >
            <div className="min-w-0">
              <p className="font-medium text-slate-800 dark:text-slate-100">{sound.label}</p>
              <p className="truncate text-xs text-slate-500">{sound.description}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={muted}
              onClick={() => handlePlay(sound.id)}
            >
              <Play className="h-4 w-4" />
              Nghe
            </Button>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

function HealthItem({ label, value, ok = Boolean(value), hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p>
          <p className="mt-1 break-words text-sm text-slate-500 dark:text-slate-400">
            {value || 'Chưa cấu hình'}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
            ok
              ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
          }`}
        >
          {ok ? 'OK' : 'Thiếu'}
        </span>
      </div>
      {hint && <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

function AdminHealthSettings() {
  return (
    <SettingsSection
      icon={Activity}
      title="Health vận hành"
      description="Các tín hiệu cấu hình tối thiểu trước khi smoke test hoặc deploy production."
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <HealthItem label="App version" value={buildInfo.appVersion} />
        <HealthItem label="Build mode" value={buildInfo.mode} />
        <HealthItem label="Firebase project" value={buildInfo.firebaseProjectId} />
        <HealthItem
          label="Public base URL"
          value={buildInfo.publicBaseUrl || 'Tự dùng origin hiện tại'}
          ok
          hint="Dùng để tạo link cổng học sinh và màn trình chiếu."
        />
        <HealthItem label="Cloudinary cloud" value={buildInfo.cloudinaryCloudName} />
        <HealthItem
          label="Cloudinary upload preset"
          value={buildInfo.cloudinaryUploadPresetConfigured ? 'Đã cấu hình' : ''}
          ok={buildInfo.cloudinaryUploadPresetConfigured}
        />
        <HealthItem
          label="Thư mục ảnh bài giảng"
          value={buildInfo.cloudinaryCurriculumFolder || 'Không đặt thư mục riêng'}
          ok
        />
        <HealthItem
          label="Lần deploy Firestore rules"
          value={buildInfo.firestoreRulesDeployedAt}
          ok={Boolean(buildInfo.firestoreRulesDeployedAt)}
          hint="Đặt VITE_FIREBASE_RULES_DEPLOYED_AT khi deploy để admin biết rules/indexes đã được cập nhật."
        />
      </div>
    </SettingsSection>
  );
}

function DataSettings() {
  const toast = useToast();
  const cacheSeconds = Math.round(FEEDBACK_CACHE_TTL_MS / 1000);
  const [exporting, setExporting] = useState(false);

  const handleClearCache = () => {
    invalidateAdminSnapshots();
    toast.success('Đã xóa bộ nhớ đệm báo cáo và điểm số.');
  };

  const handleClearDrafts = () => {
    const removed = clearLocalDrafts();
    toast.success(
      removed > 0
        ? `Đã xóa ${removed} bản nháp đã lưu trên trình duyệt này.`
        : 'Không có bản nháp nào cần xóa.',
    );
  };

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const [classes, students, programMetas] = await Promise.all([
        listClasses(500),
        listAllStudents(2000),
        listCurriculumPrograms(),
      ]);
      const curriculumPrograms = await Promise.all(
        programMetas.map((program) =>
          getCurriculumProgram(program.id, { full: true }).catch(() => program),
        ),
      );
      const exportedAt = new Date().toISOString();
      const payload = {
        schema: 'hungtran-pm-admin-backup-v1',
        exportedAt,
        source: {
          appVersion: buildInfo.appVersion,
          firebaseProjectId: buildInfo.firebaseProjectId,
        },
        classes,
        students,
        curriculumPrograms,
      };
      const dateKey = exportedAt.slice(0, 10);
      downloadTextFile(
        JSON.stringify(payload, null, 2),
        `hungtran-pm-backup-${dateKey}.json`,
        'application/json',
      );
      toast.success('Đã tạo file backup JSON.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <SettingsSection
      icon={Database}
      title="Dữ liệu & bộ nhớ đệm"
      description={`Báo cáo và điểm số được cache tạm ${cacheSeconds} giây để tải nhanh hơn.`}
    >
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={handleExportBackup} loading={exporting}>
          <Download className="h-4 w-4" />
          Tải backup JSON
        </Button>
        <Button type="button" variant="secondary" onClick={handleClearCache}>
          <Trash2 className="h-4 w-4" />
          Xóa cache báo cáo/điểm
        </Button>
        <Button type="button" variant="secondary" onClick={handleClearDrafts}>
          <Trash2 className="h-4 w-4" />
          Xóa bản nháp đã lưu
        </Button>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Backup gồm lớp, học sinh và chương trình/bài giảng. Bản nháp gồm bài quiz đang làm dở và câu trả lời tạm của mini game trên trình duyệt này.
      </p>
    </SettingsSection>
  );
}

export function SettingsPage() {
  return (
    <AppShell title="Cài đặt">
      <div className="space-y-6">
        <AdminHealthSettings />
        <SoundSettings />
        <SoundLibrary />
        <DataSettings />
      </div>
    </AppShell>
  );
}
