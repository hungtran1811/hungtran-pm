import { Search, Swords } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';

const VARIANTS = {
  spy: {
    icon: Search,
    wrap: 'border-violet-400/60 bg-violet-50 text-violet-950 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-100',
    iconClass: 'text-violet-600 dark:text-violet-300',
    title: 'Truy tìm gián điệp đang diễn ra',
    titleCrew: 'Phi hành đoàn đang diễn ra',
    body: 'Giáo viên đã mở phòng — tham gia để nhận từ khóa và tìm gián điệp.',
    bodyCrew: 'Giáo viên đã mở phòng — tham gia để làm nhiệm vụ, Report hoặc phá hệ thống.',
    action: 'Tham gia',
  },
  showdown: {
    icon: Swords,
    wrap: 'border-cyan-400/60 bg-cyan-50 text-cyan-950 dark:border-cyan-500/40 dark:bg-cyan-500/15 dark:text-cyan-100',
    iconClass: 'text-cyan-600 dark:text-cyan-300',
    title: 'Coding Showdown đang diễn ra',
    body: 'Giáo viên đã mở phòng thi đấu — tham gia để ghi điểm cùng lớp.',
    action: 'Tham gia',
  },
};

export function StudentGameJoinNotice({ variant, crew = false, onJoin }) {
  const config = VARIANTS[variant];
  if (!config) return null;
  const Icon = config.icon;
  const title = crew && config.titleCrew ? config.titleCrew : config.title;
  const body = crew && config.bodyCrew ? config.bodyCrew : config.body;

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 shadow-lg sm:px-4 ${config.wrap}`}
      role="status"
    >
      <Icon className={`h-5 w-5 shrink-0 ${config.iconClass}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{title}</p>
        <p className="mt-0.5 hidden truncate text-sm opacity-90 sm:block">{body}</p>
      </div>
      <Button onClick={onJoin} className="min-h-11 shrink-0 px-4">
        {config.action}
      </Button>
    </div>
  );
}
