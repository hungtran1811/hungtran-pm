import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers, RotateCcw, Shuffle, Sparkles, Users, Wand2 } from 'lucide-react';
import { Button } from '../../../ui/components/Button.jsx';
import { EmptyState } from '../../../ui/components/EmptyState.jsx';
import { SkeletonRows } from '../../../ui/components/Skeleton.jsx';
import { ClassFilterBar } from '../../../ui/components/ClassFilterBar.jsx';
import { listActiveStudentsByClass } from '../../../services/students.service.js';
import { getErrorMessage } from '../../../lib/firestore.js';
import { GameConfetti } from './GameConfetti.jsx';
import { GamePresentationShell, useGamePresentation } from './GamePresentationShell.jsx';

function shuffleArray(items) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildDeck(students) {
  return shuffleArray(
    students.map((student) => ({
      key: student.id,
      studentId: student.id,
      fullName: student.fullName,
      flipped: false,
      flippedAt: null,
      dealOrder: 0,
    })),
  ).map((card, index) => ({ ...card, dealOrder: index }));
}

/** Số cột khi trình chiếu — chia đều full màn hình, không dồn trái. */
function getPresentationGridColumns(count) {
  if (count <= 0) return 1;
  if (count <= 4) return count;

  let bestCols = Math.ceil(Math.sqrt(count * 1.35));
  let bestScore = Infinity;

  const minCols = Math.max(2, Math.floor(Math.sqrt(count)));
  const maxCols = Math.min(count, Math.ceil(Math.sqrt(count) * 2));

  for (let cols = minCols; cols <= maxCols; cols += 1) {
    const rows = Math.ceil(count / cols);
    const waste = cols * rows - count;
    const landscapeBias = Math.abs(cols / rows - 1.5);
    const score = waste * 3 + landscapeBias;
    if (score < bestScore) {
      bestScore = score;
      bestCols = cols;
    }
  }

  return Math.min(count, Math.max(2, bestCols));
}

function runFlipPickAnimation(indices, onHighlight, onDone) {
  if (!indices.length) return () => {};
  const winnerPos = Math.floor(Math.random() * indices.length);
  const winnerIndex = indices[winnerPos];
  const totalSteps = 14 + Math.floor(Math.random() * 10);
  let step = 0;
  let cancelled = false;
  let timeoutId;

  const tick = () => {
    if (cancelled) return;
    const idx = step < totalSteps - 1
      ? indices[Math.floor(Math.random() * indices.length)]
      : winnerIndex;
    onHighlight(idx);
    step += 1;
    if (step >= totalSteps) {
      onDone(winnerIndex);
      return;
    }
    const progress = step / totalSteps;
    const delay = 55 + progress * progress * 280;
    timeoutId = setTimeout(tick, delay);
  };

  tick();
  return () => {
    cancelled = true;
    clearTimeout(timeoutId);
  };
}

function StudentFlipCard({
  card,
  highlighted,
  lastRevealed,
  presenting,
  disabled,
  onFlip,
}) {
  const { flipped, fullName, dealOrder } = card;

  return (
    <button
      type="button"
      disabled={disabled || flipped}
      onClick={() => onFlip(card.key)}
      className={`game-card group w-full ${flipped ? 'game-card--flipped' : ''} ${
        highlighted ? 'game-card--highlight' : ''
      } ${lastRevealed ? 'game-card--revealed' : ''} ${
        presenting ? 'game-card--presenting' : ''
      }`}
      style={{ animationDelay: `${dealOrder * 35}ms` }}
      aria-label={flipped ? fullName : 'Lật lá bài'}
    >
      <div className="game-card-inner">
        <div className="game-card-face game-card-back">
          <div className="game-card-back-pattern" />
          <Layers
            className={`relative z-10 text-white/40 ${
              presenting ? '' : 'h-6 w-6 sm:h-7 sm:w-7'
            }`}
          />
        </div>
        <div className="game-card-face game-card-front">
          <span className="game-card-name">{fullName}</span>
        </div>
      </div>
    </button>
  );
}

export function CardFlipGame({ classes, programs = [] }) {
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [deck, setDeck] = useState([]);
  const [highlightKey, setHighlightKey] = useState(null);
  const [lastRevealedKey, setLastRevealedKey] = useState(null);
  const [phase, setPhase] = useState('idle');
  const cancelPickRef = useRef(null);
  const { shellRef, presenting, togglePresentation } = useGamePresentation();

  const activeClasses = useMemo(
    () => classes.filter((c) => c.status === 'active'),
    [classes],
  );

  useEffect(() => {
    if (!activeClasses.length) {
      setSelectedClass('');
      return;
    }
    setSelectedClass((prev) => {
      if (prev && activeClasses.some((c) => c.classCode === prev)) return prev;
      return '';
    });
  }, [activeClasses]);

  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      return undefined;
    }

    let cancelled = false;
    setLoadingStudents(true);
    setLoadError('');

    listActiveStudentsByClass(selectedClass)
      .then((list) => {
        if (cancelled) return;
        setStudents(list);
        setDeck(buildDeck(list));
        setHighlightKey(null);
        setLastRevealedKey(null);
        setPhase('idle');
        setLoadingStudents(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(getErrorMessage(error));
        setStudents([]);
        setDeck([]);
        setLoadingStudents(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClass]);

  useEffect(() => () => cancelPickRef.current?.(), []);

  const remaining = useMemo(() => deck.filter((c) => !c.flipped), [deck]);
  const flippedCount = deck.length - remaining.length;

  const flipHistory = useMemo(
    () =>
      deck
        .filter((c) => c.flipped && c.flippedAt)
        .sort((a, b) => b.flippedAt - a.flippedAt),
    [deck],
  );

  const presentationGrid = useMemo(() => {
    if (!presenting || !deck.length) return null;
    const cols = getPresentationGridColumns(deck.length);
    return { cols, rows: Math.ceil(deck.length / cols) };
  }, [presenting, deck.length]);

  const flipCard = useCallback((key, { force = false } = {}) => {
    if (!force && phase === 'picking') return;
    const flippedAt = Date.now();
    setDeck((prev) => {
      const card = prev.find((c) => c.key === key);
      if (!card || card.flipped) return prev;
      return prev.map((c) =>
        c.key === key ? { ...c, flipped: true, flippedAt } : c,
      );
    });
    setLastRevealedKey(key);
    setHighlightKey(null);
  }, [phase]);

  const shuffleDeck = () => {
    if (phase === 'picking') return;
    cancelPickRef.current?.();
    setDeck((prev) => {
      const hidden = prev.filter((c) => !c.flipped);
      const shown = prev.filter((c) => c.flipped);
      return [...shuffleArray(hidden), ...shown].map((c, i) => ({ ...c, dealOrder: i }));
    });
    setHighlightKey(null);
  };

  const resetDeck = () => {
    cancelPickRef.current?.();
    cancelPickRef.current = null;
    setDeck(buildDeck(students));
    setHighlightKey(null);
    setLastRevealedKey(null);
    setPhase('idle');
  };

  const flipRandom = () => {
    if (phase === 'picking' || !remaining.length) return;
    cancelPickRef.current?.();

    const pool = remaining.map((c) => c.key);
    setPhase('picking');
    setLastRevealedKey(null);

    cancelPickRef.current = runFlipPickAnimation(
      pool,
      (key) => setHighlightKey(key),
      (winnerKey) => {
        setHighlightKey(winnerKey);
        setTimeout(() => {
          flipCard(winnerKey, { force: true });
          setPhase('idle');
          cancelPickRef.current = null;
        }, 420);
      },
    );
  };

  const stageBorder = lastRevealedKey
    ? 'border-amber-400/80 shadow-[0_0_40px_rgba(251,191,36,0.35)]'
    : phase === 'picking'
      ? 'border-brand-400/60 shadow-[0_0_30px_rgba(49,111,253,0.4)]'
      : 'border-slate-700/80';

  return (
    <div className="space-y-4">
      <div className="card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <ClassFilterBar
              classes={activeClasses}
              programs={programs}
              value={selectedClass}
              onChange={setSelectedClass}
              compact
              showStudentCount
              autoSelectFirst={false}
            />
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            <strong>{remaining.length}</strong>
            /
            {students.length}
            {' '}
            lá còn lại
          </div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
          {loadError}
        </div>
      )}

      {loadingStudents ? (
        <SkeletonRows count={4} />
      ) : !selectedClass ? (
        activeClasses.length === 0 ? (
          <EmptyState icon={<Users className="h-7 w-7" />} title="Chưa có lớp đang hoạt động" />
        ) : null
      ) : students.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title="Lớp chưa có học sinh"
          description="Thêm học sinh trong mục Học sinh trước khi chơi."
        />
      ) : (
        <>
          <GamePresentationShell
            shellRef={shellRef}
            presenting={presenting}
            onTogglePresentation={togglePresentation}
            stageBorder={stageBorder}
            stageMinHeight="min-h-[360px]"
            toolbar={(
              <>
                <Button
                  size={presenting ? 'lg' : 'default'}
                  onClick={flipRandom}
                  disabled={phase === 'picking' || !remaining.length}
                  loading={phase === 'picking'}
                >
                  <Wand2 className="h-4 w-4" />
                  {presenting ? (phase === 'picking' ? '…' : 'Ngẫu nhiên') : 'Lật ngẫu nhiên'}
                </Button>
                <Button
                  variant="secondary"
                  size={presenting ? 'lg' : 'default'}
                  onClick={shuffleDeck}
                  disabled={phase === 'picking' || remaining.length < 2}
                  title="Xáo bài"
                >
                  <Shuffle className="h-4 w-4" />
                  {!presenting && 'Xáo bài'}
                </Button>
                <Button
                  variant="secondary"
                  size={presenting ? 'lg' : 'default'}
                  onClick={resetDeck}
                  disabled={phase === 'picking'}
                  title="Làm mới"
                >
                  <RotateCcw className="h-4 w-4" />
                  {!presenting && 'Làm mới'}
                </Button>
              </>
            )}
          >
            <div
              className={
                presenting ? 'relative flex h-full min-h-0 w-full flex-1 flex-col' : 'relative'
              }
            >
              {lastRevealedKey && phase === 'idle' && (
                <GameConfetti intense={presenting} count={presenting ? 20 : 8} />
              )}

              {phase === 'picking' && (
                <div className="game-marquee absolute inset-x-0 top-0 z-10 h-1" />
              )}

              <div
                className={`game-card-grid w-full ${
                  presenting ? 'game-card-grid--presenting' : 'mx-auto max-w-6xl'
                }`}
                style={
                  presentationGrid
                    ? {
                        gridTemplateColumns: `repeat(${presentationGrid.cols}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${presentationGrid.rows}, minmax(0, 1fr))`,
                      }
                    : undefined
                }
              >
                {deck.map((card) => (
                  <StudentFlipCard
                    key={card.key}
                    card={card}
                    highlighted={highlightKey === card.key}
                    lastRevealed={lastRevealedKey === card.key && card.flipped}
                    presenting={presenting}
                    disabled={phase === 'picking'}
                    onFlip={flipCard}
                  />
                ))}
              </div>

              {!presenting && remaining.length === 0 && (
                <p className="mt-6 text-center text-sm font-medium text-amber-400">
                  Đã lật hết —
                  {' '}
                  <button type="button" className="underline hover:no-underline" onClick={resetDeck}>
                    chơi lại
                  </button>
                </p>
              )}
            </div>
          </GamePresentationShell>

          {flipHistory.length > 0 && (
            <div className="card p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Đã lật (
                {flippedCount}
                )
              </p>
              <div className="flex flex-wrap gap-2">
                {flipHistory.map((card, index) => (
                  <span
                    key={card.key}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <span className="text-xs font-bold text-brand-600 dark:text-brand-300">
                      #
                      {flipHistory.length - index}
                    </span>
                    {card.fullName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
