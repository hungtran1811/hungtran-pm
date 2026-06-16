import { useMemo } from 'react';

const CELL_CAP = '7.5rem';
const CELL_GAP = 10;
const CELL_MIN = '3rem';

function dealOffsetForIndex(index) {
  const angle = (index * 2.399) % (Math.PI * 2);
  const dist = 80 + (index % 7) * 22;
  return {
    x: `${Math.round(Math.cos(angle) * dist)}px`,
    y: `${Math.round(Math.sin(angle) * dist - 50)}px`,
  };
}

function boxCellStyle(count, presenting) {
  if (count <= 0) return null;
  const gaps = (count - 1) * CELL_GAP;

  if (presenting) {
    return {
      width: `clamp(${CELL_MIN}, calc((min(100vw, 96vw) - 5rem - ${gaps}px) / ${count}), ${CELL_CAP})`,
    };
  }

  return {
    width: `clamp(${CELL_MIN}, calc((100% - ${gaps}px) / ${count}), ${CELL_CAP})`,
  };
}

export function MysteryBoxRemainStats({ boxes, presenting = false }) {
  const { reward, penalty } = useMemo(
    () => ({
      reward: boxes.filter((b) => b.type === 'reward').length,
      penalty: boxes.filter((b) => b.type === 'penalty').length,
    }),
    [boxes],
  );

  if (!boxes.length) return null;

  return (
    <div
      className={`flex shrink-0 flex-wrap items-center justify-center gap-4 sm:gap-8 ${
        presenting ? 'text-base sm:text-lg' : 'text-sm'
      }`}
    >
      <span className="font-semibold text-emerald-400">Còn {reward} thưởng</span>
      <span className="font-semibold text-red-400">Còn {penalty} phạt</span>
    </div>
  );
}

export function MysteryBoxGrid({
  boxes,
  onPick,
  disabled = false,
  presenting = false,
  openingPhase = null,
  shuffling = false,
  shufflePhase = 'idle',
  showStats = true,
}) {
  const cellLayout = useMemo(
    () => (boxes.length > 0 ? boxCellStyle(boxes.length, presenting) : null),
    [presenting, boxes.length],
  );

  const gridContent = boxes.map((box, index) => {
    const displayNum = box.displayNumber ?? index + 1;
    const deal = dealOffsetForIndex(index);
    const isDealing = shuffling && shufflePhase === 'deal';
    const isSwapping = shuffling && shufflePhase === 'swap';

    const isOpeningBox = openingPhase?.boxId === box.id;
    const phase = isOpeningBox ? openingPhase.phase : null;

    let animClass = '';
    if (phase === 'shake') {
      animClass = 'game-box-suspense-shake game-box-suspense-glow';
    } else if (phase === 'pop') {
      animClass = 'game-box-lid-pop game-box-suspense-glow game-box-shake';
    } else if (isSwapping) {
      animClass = 'game-box-shuffle-swap';
    } else if (isDealing) {
      animClass = 'game-box-deal-in';
    }

    const sizeStyle = cellLayout
      ? {
          width: cellLayout.width,
          height: cellLayout.width,
          flex: '0 0 auto',
        }
      : undefined;

    return (
      <button
        key={box.id}
        type="button"
        disabled={disabled || shuffling || Boolean(openingPhase)}
        onClick={() => onPick(box.id)}
        className={`game-mystery-box game-mystery-box--presenting relative flex shrink-0 flex-col items-center justify-center rounded-2xl border-2 p-1 text-center transition border-white/50 bg-gradient-to-br from-slate-600/95 to-slate-900/95 hover:border-amber-300/80 hover:shadow-2xl hover:shadow-amber-400/25 ${animClass} ${
          isOpeningBox ? 'z-20 ring-4 ring-amber-400/60' : ''
        }`}
        style={{
          ...sizeStyle,
          animationDelay: isDealing ? `${index * 0.06}s` : undefined,
          '--deal-x': deal.x,
          '--deal-y': deal.y,
          '--swap-x': `${(index % 5) * 24 - 48}px`,
          '--swap-y': `${-20 - (index % 3) * 12}px`,
          '--swap-x2': `${-((index % 4) * 20 - 30)}px`,
          '--swap-y2': `${16 + (index % 3) * 10}px`,
          '--swap-x3': `${(index % 6) * 14 - 35}px`,
          '--swap-y3': `${-10}px`,
        }}
      >
        <span className="text-[clamp(1.25rem,3.5vmin,3rem)] font-black tabular-nums leading-none text-white drop-shadow-lg">
          {displayNum}
        </span>
      </button>
    );
  });

  return (
    <div
      className={`game-mystery-grid-root flex w-full flex-col items-center justify-center gap-3 ${
        presenting
          ? 'game-mystery-presenting-wrap h-full flex-1 px-2 py-3'
          : 'game-mystery-stage-full px-2 py-4'
      }`}
    >
      <div className="game-mystery-row flex w-full max-w-full flex-nowrap items-center justify-center gap-2.5 sm:gap-3">
        {gridContent}
      </div>
      {showStats && boxes.length > 0 && (
        <MysteryBoxRemainStats boxes={boxes} presenting={presenting} />
      )}
    </div>
  );
}

const DEFAULT_LABELS = [
  { type: 'reward', label: 'Miễn bài tập về nhà' },
  { type: 'penalty', label: 'Hát 1 bài trước lớp' },
  { type: 'neutral', label: 'May mắn lần sau' },
  { type: 'reward', label: '+2 điểm cộng' },
  { type: 'penalty', label: 'Làm thêm 3 câu' },
  { type: 'reward', label: 'Chọn chỗ ngồi' },
  { type: 'penalty', label: 'Kể chuyện cười' },
  { type: 'neutral', label: 'Đổi lượt với bạn' },
  { type: 'reward', label: 'Sticker / quà nhỏ' },
  { type: 'penalty', label: 'Giúp dọn lớp' },
  { type: 'reward', label: 'Được hỏi 1 câu' },
  { type: 'neutral', label: 'Không có gì' },
];

export function buildDefaultBoxes(count) {
  const n = Math.max(1, Math.min(48, Number(count) || 1));
  return Array.from({ length: n }, (_, i) => {
    const preset = DEFAULT_LABELS[i % DEFAULT_LABELS.length];
    const cycle = Math.floor(i / DEFAULT_LABELS.length);
    return {
      id: `box-${i}-${Date.now()}`,
      displayNumber: i + 1,
      type: preset.type,
      label: cycle > 0 ? `${preset.label} (${cycle + 1})` : preset.label,
      opened: false,
    };
  });
}

export const MIN_BOX_COUNT = 1;
export const MAX_BOX_COUNT = 48;
