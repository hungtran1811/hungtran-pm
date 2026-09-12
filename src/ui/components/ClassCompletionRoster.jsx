import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import {
  completionSignal,
  formatActivityLabel,
  isFreshActivity,
  lastActivityTime,
  signalLabel,
} from '../../lib/reportSignals.js';
import { projectNameDisplay } from '../../lib/classFinalMode.js';
import { ProjectLinksReadonly } from '../../pages/student/ProjectProductLinks.jsx';
import { copyToClipboard, formatProgressReport } from '../../utils/exportText.js';
import { productLinksOf } from './StudentReportDetail.jsx';
import { StudentReviewModal } from './StudentReviewModal.jsx';
import { useToast } from './Toast.jsx';

function canCopyReport(item) {
  return Boolean(item?.hasReport && item.report && !item.report.snapshotOnly);
}

const LAMPS = [
  { id: 'red', on: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.65)]', off: 'bg-slate-200 dark:bg-slate-700' },
  { id: 'yellow', on: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]', off: 'bg-slate-200 dark:bg-slate-700' },
  { id: 'green', on: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.65)]', off: 'bg-slate-200 dark:bg-slate-700' },
];

const CARD_TONE = {
  red: 'border-red-200 bg-red-50/70 hover:border-red-400 hover:bg-red-50 dark:border-red-500/25 dark:hover:border-red-400/70 dark:bg-red-500/[0.07]',
  yellow: 'border-amber-200 bg-amber-50/80 hover:border-amber-400 hover:bg-amber-50 dark:border-amber-500/25 dark:hover:border-amber-400/70 dark:bg-amber-500/[0.08]',
  green: 'border-emerald-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/60 dark:border-emerald-500/25 dark:hover:border-emerald-400/70 dark:bg-slate-900 dark:hover:bg-slate-800',
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
  const toast = useToast();
  if (!items.length) return null;

  const flags = { showReport, showDrive };
  const openItem = items.find((item) => item.student.id === openId) || null;

  const copyStudentReport = async (item, event) => {
    event?.stopPropagation?.();
    if (!canCopyReport(item)) return;
    try {
      await copyToClipboard(
        formatProgressReport(item.report, { displayName: item.student.fullName }),
      );
      toast.success?.(`Đã sao chép báo cáo của ${item.student.fullName}.`);
    } catch {
      toast.error?.('Không sao chép được.');
    }
  };

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const signal = completionSignal(item, flags);
          const label = signalLabel(signal, flags);
          const activity = lastActivityTime(item);
          const timeLabel = activity ? formatActivityLabel(activity) : '';
          const fresh = isFreshActivity(item);
          const links = productLinksOf(item.report, item.student);
          const showCopy = showReport && canCopyReport(item);

          return (
            <li key={item.student.id}>
              <div
                className={`flex min-h-[8.5rem] w-full flex-col rounded-2xl border shadow-sm transition duration-200 hover:shadow-lg motion-safe:hover:-translate-y-1 ${CARD_TONE[signal]}`}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(item.student.id)}
                  className="flex flex-1 cursor-pointer flex-col items-start p-3 text-left"
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <TrafficLight signal={signal} label={label} />
                    {fresh ? (
                      <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Mới
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-slate-800 dark:text-slate-100">
                    {item.student.fullName}
                  </p>
                  {item.showClass ? (
                    <p className="mt-0.5 text-[11px] text-slate-400">{item.student.classCode}</p>
                  ) : null}
                  {projectNameDisplay(item.student) || item.student.projectName ? (
                    <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                      {projectNameDisplay(item.student) || item.student.projectName}
                    </p>
                  ) : null}
                  {item.student.projectTopic ? (
                    <p className="line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {item.student.projectTopic}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">{label}</p>
                  <div className="mt-auto flex w-full flex-col gap-2 pt-3">
                    <div className="flex flex-wrap gap-1.5">
                      {showReport ? <StatusTick on={item.hasReport} label="Báo cáo" /> : null}
                      {showDrive ? <StatusTick on={item.hasFile} label="File" /> : null}
                    </div>
                    {timeLabel ? (
                      <span className="text-xs text-slate-400">{timeLabel}</span>
                    ) : null}
                  </div>
                </button>
                {showCopy || links.githubUrl || links.canvaUrl ? (
                  <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
                    {showCopy ? (
                      <button
                        type="button"
                        aria-label={`Copy báo cáo của ${item.student.fullName}`}
                        onClick={(event) => copyStudentReport(item, event)}
                        className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/50 dark:hover:text-brand-300"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </button>
                    ) : null}
                    <ProjectLinksReadonly githubUrl={links.githubUrl} canvaUrl={links.canvaUrl} />
                  </div>
                ) : null}
              </div>
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
