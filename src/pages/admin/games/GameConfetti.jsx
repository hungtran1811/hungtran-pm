const COLORS = ['#316ffd', '#fbbf24', '#34d399', '#f472b6', '#a78bfa', '#fb923c'];

export function GameConfetti({ count = 10, intense = false }) {
  const total = intense ? Math.max(count, 28) : count;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: total }, (_, i) => {
        const left = 8 + ((i * 83) % 84);
        const delay = (i * 0.07) % 0.5;
        const color = COLORS[i % COLORS.length];
        return (
          <span
            key={i}
            className="game-confetti absolute top-[18%] block h-2.5 w-2.5 rounded-sm"
            style={{
              left: `${left}%`,
              backgroundColor: color,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}
