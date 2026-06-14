import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { ALL_CLASSES_VALUE } from '../../lib/classFilterScope.js';
import { ALL_SESSIONS_VALUE } from '../../lib/sessionScope.js';
import { QuizPanel } from './Quiz.jsx';
import { PracticePanel } from './PracticePanel.jsx';

const TABS = [
  { id: 'quiz', label: 'Quiz kiểm tra' },
  { id: 'practice', label: 'Ôn tập' },
];

function readClassFromParams(params) {
  const value = params.get('class') || '';
  if (value === ALL_CLASSES_VALUE) return ALL_CLASSES_VALUE;
  return value || ALL_CLASSES_VALUE;
}

export function ScoresHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'quiz';

  const [selectedClass, setSelectedClass] = useState(() => readClassFromParams(searchParams));
  const [sessionFilter, setSessionFilter] = useState(
    () => searchParams.get('session') || ALL_SESSIONS_VALUE,
  );

  const syncFiltersToUrl = useCallback(
    (classCode, session) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        if (classCode && classCode !== ALL_CLASSES_VALUE) next.set('class', classCode);
        else next.delete('class');
        if (session && session !== ALL_SESSIONS_VALUE) next.set('session', session);
        else next.delete('session');
        return next;
      });
    },
    [setSearchParams, tab],
  );

  useEffect(() => {
    const classFromUrl = readClassFromParams(searchParams);
    const sessionFromUrl = searchParams.get('session') || ALL_SESSIONS_VALUE;
    setSelectedClass((prev) => (prev === classFromUrl ? prev : classFromUrl));
    setSessionFilter((prev) => (prev === sessionFromUrl ? prev : sessionFromUrl));
  }, [searchParams]);

  const setTab = (id) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', id);
      return next;
    });
  };

  const handleClassChange = (code) => {
    setSelectedClass(code);
    setSessionFilter(ALL_SESSIONS_VALUE);
    syncFiltersToUrl(code, ALL_SESSIONS_VALUE);
  };

  const handleSessionChange = (value) => {
    setSessionFilter(value);
    syncFiltersToUrl(selectedClass, value);
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

        {tab === 'quiz' && (
          <QuizPanel
            activeOnly
            selectedClass={selectedClass}
            onSelectedClassChange={handleClassChange}
            sessionFilter={sessionFilter}
            onSessionFilterChange={handleSessionChange}
          />
        )}
        {tab === 'practice' && <PracticePanel activeOnly />}
      </div>
    </AppShell>
  );
}
