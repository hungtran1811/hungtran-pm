import { useMemo } from 'react';

const SPECIAL_COLORS = {
  lose_turn: '#dc2626',
  free_letter: '#8B2AF6',
  spin_again: '#13D4E6',
  reveal_vowel: '#f59e0b',
};

export function FortuneWheel({
  segments = [],
  rotation = 0,
  spinning = false,
  size = 300,
  className = '',
}) {
  const count = segments.length;
  const slice = count > 0 ? 360 / count : 360;

  const colors = useMemo(() => {
    const letterPalette = [
      '#13D4E6',
      '#1596FF',
      '#5142FF',
      '#8B2AF6',
      '#2563eb',
      '#0891b2',
      '#7c3aed',
      '#db2777',
    ];
    return segments.map((seg, i) => {
      if (seg.type === 'special') {
        return SPECIAL_COLORS[seg.effect] || '#64748b';
      }
      return letterPalette[i % letterPalette.length];
    });
  }, [segments]);

  if (count === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-full border-2 border-dashed border-white/30 bg-slate-900/50 ${className}`}
        style={{ width: size, height: size }}
      >
        <p className="game-stage-label px-4 text-center text-sm">Không còn chữ để quay</p>
      </div>
    );
  }

  const gradient = segments
    .map((_, i) => {
      const start = i * slice;
      const end = (i + 1) * slice;
      return `${colors[i]} ${start}deg ${end}deg`;
    })
    .join(', ');

  const inner = size - 16;

  return (
    <div className={`game-wheel-wrap relative ${className}`} style={{ width: size, height: size }}>
      <div
        className="game-wheel-pointer absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-0.5"
        style={{
          width: 0,
          height: 0,
          borderLeft: '18px solid transparent',
          borderRight: '18px solid transparent',
          borderTop: '36px solid #fbbf24',
          filter: 'drop-shadow(0 4px 12px rgb(0 0 0 / 0.6))',
        }}
      />
      <div
        className="absolute inset-2 rounded-full border-[5px] border-white/30 bg-slate-950 shadow-2xl"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning
            ? 'transform 4.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
            : 'transform 0.3s ease-out',
          background: `conic-gradient(from -90deg, ${gradient})`,
        }}
      >
        {segments.map((seg, i) => {
          const angle = i * slice + slice / 2 - 90;
          const rad = (angle * Math.PI) / 180;
          const r = inner * 0.3;
          const cx = inner / 2;
          const cy = inner / 2;
          const x = cx + r * Math.cos(rad);
          const y = cy + r * Math.sin(rad);
          const label =
            seg.type === 'letter'
              ? seg.label
              : seg.label.length > 8
                ? `${seg.label.slice(0, 7)}…`
                : seg.label;
          return (
            <span
              key={seg.id}
              className="pointer-events-none absolute max-w-[4.5rem] truncate text-center text-xs font-black text-white sm:text-sm"
              style={{
                left: x,
                top: y,
                transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`,
                textShadow: '0 1px 4px rgb(0 0 0 / 0.8)',
              }}
              title={seg.label}
            >
              {label}
            </span>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-3 rounded-full ring-2 ring-white/15" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white/25 bg-slate-950 text-xs font-bold text-white/70"
      >
        QUAY
      </div>
    </div>
  );
}
