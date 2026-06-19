import { BrandMarkIllustration } from '../WaitingCatIllustration.jsx';

export function ShowdownSyncOverlay({
  show,
  message = 'Đang đồng bộ với lớp…',
  compact = false,
}) {
  if (!show) return null;

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={`flex flex-col items-center text-center ${compact ? 'px-4' : 'px-8'}`}>
        <BrandMarkIllustration
          variant="loading"
          className={compact ? 'brand-mark--compact' : 'brand-mark--prompt'}
        />
        <p
          className={`mt-3 font-semibold text-white/95 ${
            compact ? 'text-sm' : 'text-base sm:text-lg'
          }`}
        >
          {message}
        </p>
        <p className="mt-1 text-xs text-white/50">Vui lòng chờ hệ thống sẵn sàng…</p>
      </div>
    </div>
  );
}
