import { BrandMarkIllustration } from './WaitingCatIllustration.jsx';

export function Spinner({ className = 'h-6 w-6' }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-brand-500 border-t-transparent ${className}`}
    />
  );
}

export function FullPageLoader({ label = 'Đang tải...' }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <BrandMarkIllustration variant="loading" className="brand-mark--prompt" />
      <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
