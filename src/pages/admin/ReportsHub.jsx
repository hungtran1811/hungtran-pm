import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { ReportsPanel } from './Reports.jsx';
import { FeedbackPanel } from './Feedback.jsx';

const TABS = [
  { id: 'progress', label: 'Báo cáo tiến độ' },
  { id: 'feedback', label: 'Phản hồi buổi học' },
];

export function ReportsHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'progress';

  const setTab = (id) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', id);
      return next;
    });
  };

  return (
    <AppShell title="Báo cáo học sinh">
      <div className="space-y-6">
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

        {tab === 'progress' && <ReportsPanel />}
        {tab === 'feedback' && <FeedbackPanel />}
      </div>
    </AppShell>
  );
}
