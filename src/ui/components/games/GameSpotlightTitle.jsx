export function GameSpotlightTitle({ children, className = '', presenting = false }) {
  return (
    <h2
      className={`game-spotlight-text bg-gradient-to-r from-cyan-300 via-brand-300 to-violet-400 bg-clip-text font-black tracking-tight text-transparent ${
        presenting ? 'text-4xl sm:text-5xl' : 'text-2xl sm:text-3xl'
      } ${className}`}
      style={{ WebkitTextStroke: presenting ? '0.5px rgb(255 255 255 / 0.15)' : undefined }}
    >
      {children}
    </h2>
  );
}
