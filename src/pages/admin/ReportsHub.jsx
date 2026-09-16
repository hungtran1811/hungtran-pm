import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { Spinner } from '../../ui/components/Spinner.jsx';
import { ALL_CLASSES_VALUE } from '../../lib/classFilterScope.js';
import { ALL_SESSIONS_VALUE } from '../../lib/sessionScope.js';
import { FEATURE_DRIVE_SUBMISSION_ENABLED, FEATURE_KNOWLEDGE_FEEDBACK_ENABLED } from '../../config/features.js';
import { ReportsPanel } from './Reports.jsx';

const FeedbackPanel = FEATURE_KNOWLEDGE_FEEDBACK_ENABLED
  ? lazy(() => import('./Feedback.jsx').then((m) => ({ default: m.FeedbackPanel })))
  : null;

const TABS = FEATURE_KNOWLEDGE_FEEDBACK_ENABLED
  ? [
      { id: 'progress', label: 'Báo cáo tiến độ' },
      { id: 'feedback', label: 'Phản hồi buổi học' },
    ]
  : [{ id: 'progress', label: 'Báo cáo tiến độ' }];

function readClassFromParams(params) {
  const value = params.get('class') || '';
  if (value === ALL_CLASSES_VALUE) return ALL_CLASSES_VALUE;
  return value;
}

function readCompletionFilter(params) {
  const value = params.get('filter');
  return value === 'missing' || value === 'done' ? value : 'all';
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
  const [completionFilter, setCompletionFilter] = useState(() => readCompletionFilter(searchParams));
  const selectedClassRef = useRef(selectedClass);
  selectedClassRef.current = selectedClass;

  const syncFiltersToUrl = useCallback(
    (classCode, archived, session, filter) => {
      setSearchParams(() => {
        const next = new URLSearchParams(window.location.search);
        if (classCode) next.set('class', classCode);
        else next.delete('class');
        if (archived) next.set('archived', '1');
        else next.delete('archived');
        if (session && session !== ALL_SESSIONS_VALUE) next.set('session', session);
        else next.delete('session');
        if (filter === 'missing' || filter === 'done') next.set('filter', filter);
        else if (filter === 'all') next.delete('filter');
        if (!next.get('tab')) next.set('tab', tab);
        return next;
      }, { replace: true });
    },
    [setSearchParams, tab],
  );

  useEffect(() => {
    const classFromUrl = readClassFromParams(searchParams);
    const archivedFromUrl = searchParams.get('archived') === '1';
    const sessionFromUrl = searchParams.get('session') || ALL_SESSIONS_VALUE;
    const filterFromUrl = readCompletionFilter(searchParams);
    setSelectedClass((prev) => (prev === classFromUrl ? prev : classFromUrl));
    setShowArchived((prev) => (prev === archivedFromUrl ? prev : archivedFromUrl));
    setSessionFilter((prev) => (prev === sessionFromUrl ? prev : sessionFromUrl));
    setCompletionFilter((prev) => (prev === filterFromUrl ? prev : filterFromUrl));
  }, [searchParams]);

  const setTab = (id) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', id);
      return next;
    }, { replace: true });
  };

  const handleClassChange = useCallback(
    (code) => {
      if (code === selectedClassRef.current) return;
      setSelectedClass(code);
      setSessionFilter(ALL_SESSIONS_VALUE);
      syncFiltersToUrl(code, showArchived, ALL_SESSIONS_VALUE);
    },
    [showArchived, syncFiltersToUrl],
  );

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

  const handleCompletionFilterChange = useCallback(
    (value) => {
      setCompletionFilter(value);
      syncFiltersToUrl(selectedClass, showArchived, sessionFilter, value);
    },
    [selectedClass, sessionFilter, showArchived, syncFiltersToUrl],
  );

  const sharedFilterProps = {
    selectedClass,
    onSelectedClassChange: handleClassChange,
    showArchived,
    onShowArchivedChange: handleArchivedChange,
    completionFilter,
    onCompletionFilterChange: handleCompletionFilterChange,
  };

  return (
    <AppShell title={FEATURE_DRIVE_SUBMISSION_ENABLED ? 'Báo cáo & nộp bài' : 'Báo cáo học sinh'}>
      <div className="space-y-6">
        {FEATURE_KNOWLEDGE_FEEDBACK_ENABLED && (
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
        )}

        {tab === 'progress' && <ReportsPanel {...sharedFilterProps} />}
        {FEATURE_KNOWLEDGE_FEEDBACK_ENABLED && tab === 'feedback' && FeedbackPanel && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
                <Spinner className="h-8 w-8" />
                <p className="text-sm">Đang tải phản hồi...</p>
              </div>
            }
          >
            <FeedbackPanel
              {...sharedFilterProps}
              sessionFilter={sessionFilter}
              onSessionFilterChange={handleSessionChange}
            />
          </Suspense>
        )}
      </div>
    </AppShell>
  );
}
