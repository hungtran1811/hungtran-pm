import { Copy, History, RotateCcw } from 'lucide-react';
import { Badge } from './Badge.jsx';
import { Button } from './Button.jsx';
import { UNDERSTANDING_LEVELS } from '../../constants/index.js';

const UNDERSTANDING_LABELS = UNDERSTANDING_LEVELS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const LEVEL_TONES = { 1: 'red', 2: 'red', 3: 'amber', 4: 'green', 5: 'green' };

export function understandingTone(level) {
  return LEVEL_TONES[level] || 'slate';
}

export function PanelSummaryGrid({ children, className = '' }) {
  return (
    <div className={`mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {children}
    </div>
  );
}

export function PanelSummaryStat({ label, value, hint, tone = 'slate' }) {
  const tones = {
    brand: 'border-brand-200 bg-brand-50/80 dark:border-brand-500/20 dark:bg-brand-500/10',
    green: 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-500/10',
    amber: 'border-amber-200 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10',
    red: 'border-red-200 bg-red-50/80 dark:border-red-500/20 dark:bg-red-500/10',
    slate: 'border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/40',
  };
  const valueTones = {
    brand: 'text-brand-700 dark:text-brand-300',
    green: 'text-emerald-700 dark:text-emerald-300',
    amber: 'text-amber-700 dark:text-amber-300',
    red: 'text-red-700 dark:text-red-300',
    slate: 'text-slate-800 dark:text-slate-100',
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone] || tones.slate}`}>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xl font-bold tabular-nums ${valueTones[tone] || valueTones.slate}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function UnderstandingBadge({ level, compact = false }) {
  const tone = understandingTone(level);
  if (compact) {
    return (
      <Badge tone={tone}>
        {level}/5
      </Badge>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1.5">
      <Badge tone={tone}>Mức hiểu {level}/5</Badge>
      <UnderstandingDots level={level} />
    </div>
  );
}

export function UnderstandingDots({ level, className = '' }) {
  return (
    <div className={`flex gap-0.5 ${className}`} aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`h-1.5 w-3 rounded-full ${
            n <= level
              ? n >= 4
                ? 'bg-emerald-500'
                : n >= 3
                  ? 'bg-amber-400'
                  : 'bg-red-400'
              : 'bg-slate-200 dark:bg-slate-700'
          }`}
        />
      ))}
    </div>
  );
}

export function SubmissionField({ label, children, variant = 'default' }) {
  const variants = {
    default: 'border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/40',
    success: 'border-emerald-100 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/10',
    warning: 'border-amber-100 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/10',
    danger: 'border-red-100 bg-red-50/60 dark:border-red-500/20 dark:bg-red-500/10',
  };

  return (
    <div className={`card-prose rounded-lg border p-3 ${variants[variant] || variants.default}`}>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{children}</div>
    </div>
  );
}

export function SubmissionCardShell({
  title,
  meta,
  badges,
  right,
  onClick,
  children,
  actions,
  highlighted = false,
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
      className={`card card-prose overflow-hidden transition ${
        highlighted
          ? 'border-brand-400 bg-brand-50/50 shadow-md ring-2 ring-brand-400/25 dark:border-brand-500/50 dark:bg-brand-500/10 dark:ring-brand-400/20'
          : ''
      } ${onClick ? 'cursor-pointer hover:border-brand-400 hover:shadow-md' : ''}`}
    >
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
              {badges}
            </div>
            {meta && <p className="mt-0.5 text-xs text-slate-400">{meta}</p>}
          </div>
          {right}
        </div>
      </div>

      {children && <div className="px-4 py-4 sm:px-5">{children}</div>}

      {actions && (
        <div className="flex flex-wrap gap-1 border-t border-slate-100 bg-slate-50/50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40 sm:px-4">
          {actions}
        </div>
      )}
    </div>
  );
}

export function SubmissionCardActions({ onHistory, onCopy, onReset, resetClassName = 'text-amber-600' }) {
  return (
    <>
      {onHistory && (
        <Button size="sm" variant="ghost" onClick={onHistory}>
          <History className="h-4 w-4" />
          Lịch sử
        </Button>
      )}
      {onCopy && (
        <Button size="sm" variant="ghost" onClick={onCopy}>
          <Copy className="h-4 w-4" />
          Copy
        </Button>
      )}
      {onReset && (
        <Button size="sm" variant="ghost" className={resetClassName} onClick={onReset}>
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      )}
    </>
  );
}

export function ProgressMiniBar({ percent, className = '' }) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-1.5 min-w-[4rem] flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-brand-600 dark:text-brand-300">
        {value}%
      </span>
    </div>
  );
}

export { UNDERSTANDING_LABELS };
