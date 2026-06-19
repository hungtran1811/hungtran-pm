import { useMemo } from 'react';
import { Crown, Medal } from 'lucide-react';
import { assignParticipantRanks } from '../../../services/showdown.service.js';

function rankAccent(rank) {
  if (rank === 1) return 'border-amber-400/70 bg-amber-400/15 text-amber-100';
  if (rank === 2) return 'border-slate-300/60 bg-slate-300/10 text-slate-100';
  if (rank === 3) return 'border-orange-400/60 bg-orange-400/10 text-orange-100';
  return 'border-white/10 bg-white/5 text-white/90';
}

function RankIcon({ rank, presenting }) {
  if (rank === 1) {
    return <Crown className={presenting ? 'h-6 w-6 text-amber-300' : 'h-4 w-4 text-amber-300'} />;
  }
  if (rank <= 3) {
    return (
      <Medal
        className={`${presenting ? 'h-5 w-5' : 'h-4 w-4'} ${
          rank === 2 ? 'text-slate-200' : 'text-orange-300'
        }`}
      />
    );
  }
  return rank;
}

export function ShowdownLeaderboard({
  participants,
  activeStudentId = null,
  highlightId = null,
  presenting = false,
  title = 'Bảng xếp hạng',
}) {
  const ranked = useMemo(() => assignParticipantRanks(participants), [participants]);

  return (
    <aside
      className={`game-showdown-board flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-black/40 ${
        presenting ? 'p-4' : 'p-3'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className={`font-bold text-white ${presenting ? 'text-xl' : 'text-sm'}`}>{title}</h3>
        <span className={`text-white/50 ${presenting ? 'text-sm' : 'text-xs'}`}>{ranked.length} HS</span>
      </div>

      {ranked.length === 0 ? (
        <p className="text-center text-sm text-white/40">Chưa có học sinh tham gia</p>
      ) : (
        <ol className="game-showdown-board-list flex-1 space-y-1.5 overflow-y-auto pr-1">
          {ranked.map((p) => {
            const isActive = p.id === activeStudentId;
            const isHighlight = p.id === highlightId;
            return (
              <li
                key={p.id}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-all duration-300 ${rankAccent(
                  p.rank,
                )} ${isActive ? 'ring-2 ring-cyan-300/80' : ''} ${isHighlight ? 'scale-[1.02]' : ''}`}
              >
                <span
                  className={`flex shrink-0 items-center justify-center font-black tabular-nums ${
                    presenting ? 'h-8 w-8 text-lg' : 'h-6 w-6 text-sm'
                  }`}
                >
                  <RankIcon rank={p.rank} presenting={presenting} />
                </span>
                <span
                  className={`min-w-0 flex-1 truncate font-semibold ${
                    presenting ? 'text-base' : 'text-sm'
                  }`}
                >
                  {p.studentName}
                </span>
                <span
                  className={`shrink-0 font-black tabular-nums text-white ${
                    presenting ? 'text-lg' : 'text-sm'
                  }`}
                >
                  {p.totalScore}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
