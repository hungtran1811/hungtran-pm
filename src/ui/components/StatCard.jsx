const TONES = {
  brand: 'text-brand-600 dark:text-brand-300',
  green: 'text-green-600 dark:text-green-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  slate: 'text-slate-600 dark:text-slate-300',
};

export function StatCard({ label, value, hint, tone = 'brand', icon }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        {icon && <span className={TONES[tone] || TONES.brand}>{icon}</span>}
      </div>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${TONES[tone] || TONES.brand}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
