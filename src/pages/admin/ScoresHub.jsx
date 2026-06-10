import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { QuizPanel } from './Quiz.jsx';
import { PracticePanel } from './PracticePanel.jsx';

const TABS = [
  { id: 'quiz', label: 'Quiz kiểm tra' },
  { id: 'practice', label: 'Ôn tập' },
];

export function ScoresHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'quiz';

  const setTab = (id) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', id);
      return next;
    });
  };

  return (
    <AppShell title="Điểm số">
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

        {tab === 'quiz' && <QuizPanel activeOnly />}
        {tab === 'practice' && <PracticePanel activeOnly />}
      </div>
    </AppShell>
  );
}
