import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { ALL_CLASSES_VALUE } from '../../lib/classFilterScope.js';
import { ALL_SESSIONS_VALUE } from '../../lib/sessionScope.js';
import { ReportsPanel } from './Reports.jsx';
import { FeedbackPanel } from './Feedback.jsx';

const TABS = [
  { id: 'progress', label: 'Báo cáo tiến độ' },
  { id: 'feedback', label: 'Phản hồi buổi học' },
];

function readClassFromParams(params) {
  const value = params.get('class') || '';
  if (value === ALL_CLASSES_VALUE) return ALL_CLASSES_VALUE;
  return value;
}

export function ReportsHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'progress';

  const [selectedClass, setSelectedClass] = useState(() => readClassFromParams(searchParams));
  const [showArchived, setShowArchived] = useState(() => searchParams.get('archived') === '1');
  const [sessionFilter, setSessionFilter] = useState(
    () => searchParams.get('session') || ALL_SESSIONS_VALUE,
  );

  const syncFiltersToUrl = useCallback(
    (classCode, archived, session) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (classCode) next.set('class', classCode);
        else next.delete('class');
        if (archived) next.set('archived', '1');
        else next.delete('archived');
        if (session && session !== ALL_SESSIONS_VALUE) next.set('session', session);
        else next.delete('session');
        return next;
      });
    },
    [setSearchParams],
  );

  useEffect(() => {
    const classFromUrl = readClassFromParams(searchParams);
    const archivedFromUrl = searchParams.get('archived') === '1';
    const sessionFromUrl = searchParams.get('session') || ALL_SESSIONS_VALUE;
    setSelectedClass((prev) => (prev === classFromUrl ? prev : classFromUrl));
    setShowArchived((prev) => (prev === archivedFromUrl ? prev : archivedFromUrl));
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
    syncFiltersToUrl(code, showArchived, ALL_SESSIONS_VALUE);
  };

  const handleArchivedChange = (checked) => {
    setShowArchived(checked);
    const nextClass = checked ? '' : selectedClass;
    if (checked) setSelectedClass('');
    syncFiltersToUrl(nextClass, checked, sessionFilter);
  };

  const handleSessionChange = (value) => {
    setSessionFilter(value);
    syncFiltersToUrl(selectedClass, showArchived, value);
  };

  const sharedFilterProps = {
    selectedClass,
    onSelectedClassChange: handleClassChange,
    showArchived,
    onShowArchivedChange: handleArchivedChange,
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

        {tab === 'progress' && <ReportsPanel {...sharedFilterProps} />}
        {tab === 'feedback' && (
          <FeedbackPanel
            {...sharedFilterProps}
            sessionFilter={sessionFilter}
            onSessionFilterChange={handleSessionChange}
          />
        )}
      </div>
    </AppShell>
  );
}
