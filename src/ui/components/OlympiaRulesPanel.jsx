import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { DEFAULT_STEP_THRESHOLD } from '../../lib/olympiaConstants.js';
import {
  OLYMPIA_RULES_SUMMARY,
  buildMountainMilestones,
  getRoundRulesSummary,
} from '../../lib/olympiaRules.js';

export function OlympiaRulesPanel({ stepThreshold = DEFAULT_STEP_THRESHOLD, compact = false }) {
  const [open, setOpen] = useState(!compact);
  const milestones = buildMountainMilestones(stepThreshold);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Info className="h-4 w-4 text-brand-500" />
          {OLYMPIA_RULES_SUMMARY.title}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <p>{OLYMPIA_RULES_SUMMARY.intro}</p>
          <ul className="space-y-1">
            {OLYMPIA_RULES_SUMMARY.rounds.map((r) => (
              <li key={r.id}>
                <strong>{r.label}:</strong> {r.detail}
              </li>
            ))}
          </ul>
          <p>{OLYMPIA_RULES_SUMMARY.finishNote}</p>
          <p>
            Mỗi {stepThreshold} điểm leo thêm 1 bậc, tối đa 10 bậc = đỉnh Olympia. Xếp hạng theo tổng
            điểm; hòa thì ai lên đỉnh trước thắng.
          </p>
          {!compact && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {milestones.filter((m) => m.step > 0 && m.step % 2 === 0).map((m) => (
                <span
                  key={m.step}
                  className="rounded-full bg-white px-2 py-0.5 text-xs dark:bg-slate-800"
                >
                  Bậc {m.step}: {m.minScore}đ+
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OlympiaRoundBanner({ roundId, speedBonusEnabled = false, large = false }) {
  const text = getRoundRulesSummary(roundId, speedBonusEnabled);
  return (
    <div
      className={`rounded-xl border border-amber-400/40 bg-amber-500/10 text-center ${
        large
          ? 'px-6 py-4 text-lg font-semibold text-amber-100'
          : 'px-3 py-2 text-sm text-amber-800 dark:text-amber-200'
      }`}
    >
      {text}
    </div>
  );
}
