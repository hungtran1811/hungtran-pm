import { Gift, Skull, Sparkles } from 'lucide-react';
import { GameConfetti } from '../../../pages/admin/games/GameConfetti.jsx';

const TYPE_META = {
  reward: {
    icon: Sparkles,
    titleClass: 'text-emerald-300',
    bannerClass: 'border-emerald-400/60 bg-gradient-to-br from-emerald-600/90 to-amber-500/80',
    flashClass: 'game-screen-flash-reward',
  },
  penalty: {
    icon: Skull,
    titleClass: 'text-red-300',
    bannerClass: 'border-red-400/60 bg-gradient-to-br from-red-600/90 to-slate-800/90',
    flashClass: 'game-screen-flash-penalty',
  },
  neutral: {
    icon: Gift,
    titleClass: 'text-brand-200',
    bannerClass: 'border-brand-400/60 bg-gradient-to-br from-brand-600/90 to-violet-600/85',
    flashClass: 'game-screen-flash-neutral',
  },
};

export function MysteryBoxRevealOverlay({
  visible,
  studentName,
  boxNumber,
  label,
  type = 'neutral',
  phase = 'reveal',
}) {
  if (!visible) return null;

  const meta = TYPE_META[type] || TYPE_META.neutral;
  const Icon = meta.icon;
  const isSuspense = phase === 'shake' || phase === 'pop';

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-40 flex items-center justify-center ${
        phase === 'reveal' ? meta.flashClass : ''
      }`}
    >
      {type === 'reward' && phase === 'reveal' && (
        <GameConfetti intense count={48} />
      )}

      <div
        className={`relative mx-4 w-full max-w-3xl rounded-3xl border-4 px-6 py-8 text-center shadow-2xl sm:px-10 sm:py-12 ${
          isSuspense
            ? 'game-box-reveal-suspense border-amber-400/70 bg-slate-950/95'
            : `${meta.bannerClass} game-box-reveal-pop`
        }`}
      >
        {studentName && (
          <p className="text-lg font-semibold uppercase tracking-widest text-white/80 sm:text-xl">
            {studentName}
          </p>
        )}

        {isSuspense ? (
          <>
            <p className="mt-4 text-2xl font-black text-amber-300 sm:text-4xl">
              Hộp #{boxNumber}
            </p>
            <p className="mt-3 animate-pulse text-xl font-bold text-white sm:text-2xl">
              {phase === 'shake' ? 'Đang mở…' : 'Sắp lộ diện…'}
            </p>
          </>
        ) : (
          <>
            <Icon className="mx-auto h-14 w-14 text-white sm:h-20 sm:w-20" />
            <p className={`mt-4 text-sm font-bold uppercase tracking-wider sm:text-base ${meta.titleClass}`}>
              Hộp #{boxNumber}
            </p>
            <p className="mt-4 text-3xl font-black leading-tight text-white sm:text-5xl md:text-6xl">
              {label}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
