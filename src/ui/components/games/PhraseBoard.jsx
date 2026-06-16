export function PhraseBoard({ board, presenting = false, newlyRevealedIds = [] }) {
  if (!board?.rows?.length) {
    return (
      <p className="game-stage-label text-center text-sm">Nhập đoạn code để bắt đầu</p>
    );
  }

  const tileClass = presenting
    ? 'min-h-[3.5rem] min-w-[2.75rem] text-2xl sm:min-h-[4rem] sm:min-w-[3rem] sm:text-3xl'
    : 'min-h-[2.5rem] min-w-[2rem] text-lg sm:min-w-[2.25rem] sm:text-xl';

  return (
    <div className="mx-auto w-full max-w-5xl space-y-2 overflow-x-auto px-1">
      {board.rows.map((row, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex flex-wrap justify-center gap-1 sm:gap-1.5">
          {row.map((cell) => {
            if (cell.char === ' ') {
              return <span key={cell.id} className={`inline-block ${presenting ? 'w-4' : 'w-3'}`} />;
            }
            if (cell.char === '\t') {
              return <span key={cell.id} className={`inline-block ${presenting ? 'w-8' : 'w-6'}`} />;
            }

            const isNew = newlyRevealedIds.includes(cell.id);
            const showChar = cell.revealed || !cell.hidden;

            if (!cell.hidden) {
              return (
                <span
                  key={cell.id}
                  className={`inline-flex items-center justify-center font-mono font-semibold text-cyan-200/90 ${tileClass}`}
                >
                  {cell.char === '\t' ? '' : cell.char}
                </span>
              );
            }

            return (
              <span
                key={cell.id}
                className={`inline-flex items-center justify-center rounded-lg border-2 font-mono font-black ${tileClass} ${
                  showChar
                    ? `border-emerald-400/80 bg-white text-slate-900 shadow-lg shadow-emerald-500/20 ${
                        isNew ? 'game-phrase-tile-reveal' : ''
                      }`
                    : 'border-brand-400/50 bg-gradient-to-b from-brand-900/80 to-violet-950/80 text-brand-200/30 shadow-inner'
                }`}
              >
                {showChar ? cell.char : '\u00A0'}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
