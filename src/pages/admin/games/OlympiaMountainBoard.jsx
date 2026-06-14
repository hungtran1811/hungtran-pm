import { useMemo } from 'react';
import { Mountain } from 'lucide-react';
import { DEFAULT_STEP_THRESHOLD } from '../../../lib/olympiaConstants.js';
import { formatMountainProgress } from '../../../lib/olympiaRules.js';

const STEP_COUNT = 10;

function ClimberColumn({ participant, presenting, highlight }) {
  const step = Math.min(STEP_COUNT, Number(participant.mountainStep) || 0);
  const name = participant.studentName || participant.id;
  const shortName = name.length > 10 && presenting ? `${name.slice(0, 9)}…` : name;

  return (
    <div
      className={`flex min-w-[52px] flex-col items-center gap-1 sm:min-w-[64px] ${
        highlight ? 'olympia-climber-highlight' : ''
      }`}
    >
      <div
        className={`relative flex flex-col-reverse gap-0.5 ${
          presenting ? 'h-[min(42vh,320px)]' : 'h-36'
        } w-full rounded-t-lg bg-gradient-to-t from-emerald-950/40 via-slate-900/30 to-transparent px-1 pt-2`}
      >
        {Array.from({ length: STEP_COUNT }, (_, i) => {
          const level = i + 1;
          const active = level <= step;
          const isPeak = level === STEP_COUNT;
          return (
            <div
              key={level}
              className={`flex-1 min-h-[6px] rounded-sm border transition-all duration-500 ${
                active
                  ? isPeak
                    ? 'border-amber-400/80 bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                    : 'border-emerald-500/50 bg-emerald-500/70'
                  : 'border-slate-700/50 bg-slate-800/40'
              } ${highlight && active && level === step ? 'olympia-step-pop' : ''}`}
            />
          );
        })}
        <div
          className={`absolute left-1/2 -translate-x-1/2 transition-all duration-700 ${
            presenting ? 'text-lg' : 'text-sm'
          }`}
          style={{ bottom: `${(step / STEP_COUNT) * 100}%`, marginBottom: '4px' }}
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white shadow-lg ring-2 ring-white/30">
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
      <p
        className={`max-w-full truncate text-center font-semibold ${
          presenting ? 'text-xs text-white' : 'text-[10px] text-slate-300'
        }`}
        title={name}
      >
        {shortName}
      </p>
      <p className={`font-bold tabular-nums ${presenting ? 'text-sm text-amber-300' : 'text-xs text-amber-400'}`}>
        {participant.totalScore || 0}
      </p>
    </div>
  );
}

export function OlympiaMountainBoard({
  participants = [],
  stepThreshold = DEFAULT_STEP_THRESHOLD,
  presenting = false,
  highlightStudentId = null,
  compact = false,
}) {
  const ranked = useMemo(
    () => [...participants].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0)),
    [participants],
  );

  if (compact) {
    const p = ranked[0];
    if (!p) return null;
    const progress = formatMountainProgress(p.totalScore, stepThreshold);
    return (
      <div className="flex items-center gap-3 rounded-xl bg-slate-900/80 px-4 py-3">
        <Mountain className="h-8 w-8 text-emerald-400" />
        <div>
          <p className="text-sm text-slate-400">Bậc leo núi của bạn</p>
          <p className="text-2xl font-bold text-white">
            {progress.step}
            <span className="text-base font-normal text-slate-400"> / {STEP_COUNT}</span>
          </p>
          <p className="text-xs text-slate-400">{progress.text}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-sm text-slate-400">Điểm</p>
          <p className="text-xl font-bold text-amber-300">{p.totalScore || 0}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-center gap-2">
        <Mountain className={`${presenting ? 'h-8 w-8' : 'h-5 w-5'} text-emerald-400`} />
        <h3 className={`font-bold ${presenting ? 'text-2xl text-white' : 'text-lg text-slate-100'}`}>
          Đường lên đỉnh Olympia
        </h3>
        {presenting && (
          <span className="text-xs text-white/50">1 bậc / {stepThreshold}đ</span>
        )}
      </div>
      {ranked.length === 0 ? (
        <p className={`text-center ${presenting ? 'text-white/60' : 'text-slate-500'}`}>
          Chưa có thí sinh tham gia
        </p>
      ) : (
        <div
          className={`flex gap-2 overflow-x-auto pb-2 ${
            presenting ? 'justify-start px-2' : 'justify-center'
          }`}
        >
          {ranked.map((p) => (
            <ClimberColumn
              key={p.id}
              participant={p}
              presenting={presenting}
              highlight={highlightStudentId === p.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function OlympiaPodium({ participants = [], presenting = false }) {
  const top = useMemo(
    () => [...participants].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0)).slice(0, 3),
    [participants],
  );

  if (top.length === 0) return null;

  const medals = ['🥇', '🥈', '🥉'];
  const order = top.length >= 3 ? [top[1], top[0], top[2]] : top;

  return (
    <div className="flex items-end justify-center gap-4 py-6">
      {order.map((p, i) => {
        const rank = top.indexOf(p);
        const heights = presenting ? ['h-28', 'h-36', 'h-24'] : ['h-20', 'h-28', 'h-16'];
        const heightClass = top.length >= 3 ? heights[i] : heights[Math.min(i, 2)];
        return (
          <div key={p.id} className="flex flex-col items-center gap-2">
            <span className={presenting ? 'text-4xl' : 'text-2xl'}>{medals[rank]}</span>
            <p className={`max-w-[100px] truncate font-bold ${presenting ? 'text-white' : 'text-slate-100'}`}>
              {p.studentName}
            </p>
            <p className="text-amber-300 font-bold tabular-nums">{p.totalScore} đ</p>
            <div
              className={`w-24 rounded-t-xl bg-gradient-to-t from-brand-600 to-brand-400 ${heightClass}`}
            />
          </div>
        );
      })}
    </div>
  );
}
