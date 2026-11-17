import { useState } from 'react';
import { Check } from 'lucide-react';
import { completionSignal, signalLabel } from '../../lib/reportSignals.js';
import { projectNameDisplay } from '../../lib/classFinalMode.js';
import { StudentReviewModal } from './StudentReviewModal.jsx';

const LAMPS = [
  { id: 'red', on: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.65)]', off: 'bg-slate-200 dark:bg-slate-700' },
  { id: 'yellow', on: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]', off: 'bg-slate-200 dark:bg-slate-700' },
  { id: 'green', on: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.65)]', off: 'bg-slate-200 dark:bg-slate-700' },
];

const CARD_TONE = {
  red: 'border-red-200 bg-red-50/70 hover:border-red-400 dark:border-red-500/25 dark:hover:border-red-400/70 dark:bg-red-500/[0.07]',
  yellow: 'border-amber-200 bg-amber-50/80 hover:border-amber-400 dark:border-amber-500/25 dark:hover:border-amber-400/70 dark:bg-amber-500/[0.08]',
  green: 'border-emerald-200 bg-white hover:border-emerald-400 dark:border-emerald-500/25 dark:hover:border-emerald-400/70 dark:bg-slate-900',
};

function TrafficLight({ signal, label }) {
  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={label}>
      {LAMPS.map((lamp) => (
        <span
          key={lamp.id}
          className={`h-3 w-3 rounded-full ${signal === lamp.id ? lamp.on : lamp.off}`}
        />
      ))}
    </div>
  );
}

function StatusTick({ on, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${
        on
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
      }`}
    >
      <span
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${
          on ? 'bg-emerald-500 text-white' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
      {label}
    </span>
  );
}

export function ClassCompletionRoster({
  items = [],
  showDrive = false,
  showReport = true,
  lessonKey = '',
  canDelete = false,
  onDeleteFile,
  onDeleteReport,
  onDeleteLesson,
}) {
  const [openId, setOpenId] = useState('');
  if (!items.length) return null;

  const flags = { showReport, showDrive };
  const openItem = items.find((item) => item.student.id === openId) || null;

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const signal = completionSignal(item, flags);
          const label = signalLabel(signal, flags);
          const projectName = projectNameDisplay(item.student) || item.student.projectName;

          return (
            <li key={item.student.id}>
              <button
                type="button"
                onClick={() => setOpenId(item.student.id)}
                className={`flex min-h-28 w-full cursor-pointer flex-col items-start rounded-2xl border p-3 text-left shadow-sm transition duration-200 hover:shadow-md motion-safe:hover:-translate-y-0.5 ${CARD_TONE[signal]}`}
              >
                <TrafficLight signal={signal} label={label} />
                <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-slate-800 dark:text-slate-100">
                  {item.student.fullName}
                </p>
                {item.showClass ? (
                  <p className="mt-0.5 text-[11px] text-slate-400">{item.student.classCode}</p>
                ) : null}
                {projectName ? (
                  <p className="mt-1 line-clamp-1 text-xs text-slate-600 dark:text-slate-300">{projectName}</p>
                ) : null}
                <div className="mt-auto flex w-full flex-wrap gap-1.5 pt-3">
                  {showReport ? <StatusTick on={item.hasReport} label="Báo cáo" /> : null}
                  {showDrive ? <StatusTick on={item.hasFile} label="File" /> : null}
                </div>
                <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">{label}</p>
              </button>
            </li>
          );
        })}
      </ul>

      <StudentReviewModal
        key={openItem?.student.id || 'closed'}
        item={openItem}
        showDrive={showDrive}
        showReport={showReport}
        lessonKey={lessonKey}
        canDelete={canDelete}
        onClose={() => setOpenId('')}
        onDeleteFile={onDeleteFile}
        onDeleteReport={onDeleteReport}
        onDeleteLesson={onDeleteLesson}
      />
    </>
  );
}
