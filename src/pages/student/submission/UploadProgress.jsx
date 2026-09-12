export function UploadProgress({ percent = 0 }) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));

  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div
        className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div
          className="h-full rounded-full bg-brand-600 motion-safe:transition-[width] motion-safe:duration-200 dark:bg-brand-500"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-sm tabular-nums text-slate-600 dark:text-slate-300">
        {value}%
      </span>
    </div>
  );
}
