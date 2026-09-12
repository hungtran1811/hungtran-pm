import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { projectNameDisplay } from '../../lib/classFinalMode.js';

export function projectSummaryParts(student) {
  return {
    name: projectNameDisplay(student) || String(student?.projectName || '').trim(),
    topic: String(student?.projectTopic || '').trim(),
    stage: String(student?.currentStage || student?.stage || '').trim(),
    problem: String(student?.projectProblemSolution || '').trim(),
    features: String(student?.projectPlannedFeatures || '').trim(),
  };
}

export function ProjectSummaryDisclosure({ student, className = '' }) {
  const [open, setOpen] = useState(false);
  const { name, topic, stage, problem, features } = projectSummaryParts(student);
  const line = [name, topic, stage].filter(Boolean).join(' · ');
  if (!line) return null;

  const details = [
    problem ? ['Vấn đề', problem] : null,
    features ? ['Tính năng dự kiến', features] : null,
  ].filter(Boolean);

  if (!details.length) {
    return <p className={`text-sm font-medium text-slate-800 dark:text-slate-100 ${className}`}>{line}</p>;
  }

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-start gap-2 rounded-xl px-0 text-left hover:text-brand-700 dark:hover:text-brand-300"
      >
        <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 dark:text-slate-100">{line}</span>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div className="mt-2 space-y-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          {details.map(([label, value]) => (
            <p key={label}>
              <span className="font-semibold text-slate-500 dark:text-slate-400">{label}:</span> {value}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
