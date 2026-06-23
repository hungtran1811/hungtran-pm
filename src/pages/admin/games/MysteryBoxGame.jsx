import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dices, Gift, Minus, Plus, RotateCcw, Shuffle, Users } from 'lucide-react';
import { Button } from '../../../ui/components/Button.jsx';
import { EmptyState } from '../../../ui/components/EmptyState.jsx';
import { Field, Input, Select } from '../../../ui/components/Field.jsx';
import { SelectClassPrompt, LoadingCatState } from '../../../ui/components/WaitingCatIllustration.jsx';
import { GameResultBurst } from '../../../ui/components/games/GameResultBurst.jsx';
import { GameSoundToggle } from '../../../ui/components/games/GameSoundToggle.jsx';
import { GameSpotlightTitle } from '../../../ui/components/games/GameSpotlightTitle.jsx';
import { GameSoundGate } from '../../../ui/components/games/GameSoundGate.jsx';
import { MysteryBoxRevealOverlay } from '../../../ui/components/games/MysteryBoxRevealOverlay.jsx';
import {
  MAX_BOX_COUNT,
  MIN_BOX_COUNT,
  buildDefaultBoxes,
  MysteryBoxGrid,
} from '../../../ui/components/games/MysteryBoxGrid.jsx';
import { useGameSound } from '../../../hooks/useGameSound.js';
import { buildShuffledBoxes, reshuffleRemainingBoxes } from '../../../lib/mysteryBoxShuffle.js';
import { GamePresentationShell, useGamePresentation } from './GamePresentationShell.jsx';

const TYPE_OPTIONS = [
  { value: 'reward', label: 'Thưởng' },
  { value: 'penalty', label: 'Phạt' },
  { value: 'neutral', label: 'An toàn' },
];

const OPEN_MS = {
  shake: 2200,
  pop: 1500,
  reveal: 700,
};

function runPickAnimation(pool, onTick, onDone) {
  if (!pool.length) return () => {};
  const winnerIndex = Math.floor(Math.random() * pool.length);
  const totalSteps = 18 + Math.floor(Math.random() * 12);
  let step = 0;
  let cancelled = false;
  let timeoutId;

  const tick = () => {
    if (cancelled) return;
    const idx = step < totalSteps - 1 ? Math.floor(Math.random() * pool.length) : winnerIndex;
    onTick(pool[idx]);
    step += 1;
    if (step >= totalSteps) {
      onDone(pool[winnerIndex]);
      return;
    }
    const progress = step / totalSteps;
    timeoutId = setTimeout(tick, 40 + progress * progress * 280);
  };

  tick();
  return () => {
    cancelled = true;
    clearTimeout(timeoutId);
  };
}

export function MysteryBoxGame({
  classes = [],
  selectedClass = '',
  students = [],
  presentStudents = [],
  loadingStudents = false,
  loadError = '',
}) {
  const [boxCountInput, setBoxCountInput] = useState('6');
  const [boxes, setBoxes] = useState(() => buildDefaultBoxes(6));
  const [configured, setConfigured] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [picking, setPicking] = useState(false);
  const [openingPhase, setOpeningPhase] = useState(null);
  const [lastOpened, setLastOpened] = useState(null);
  const [shuffling, setShuffling] = useState(false);
  const [shufflePhase, setShufflePhase] = useState('idle');
  const [pickedStudentIds, setPickedStudentIds] = useState(() => new Set());
  const [pickHistory, setPickHistory] = useState([]);
  const [revealOverlay, setRevealOverlay] = useState(null);
  const { shellRef, presenting, togglePresentation } = useGamePresentation();

  const interactSound = useCallback(async () => {
    await sound.unlock();
  }, [sound]);

  const activeClasses = useMemo(
    () => classes.filter((c) => c.status === 'active'),
    [classes],
  );

  const activeStudent = useMemo(
    () => presentStudents.find((s) => s.id === activeStudentId) || null,
    [presentStudents, activeStudentId],
  );

  const availableStudents = useMemo(
    () => presentStudents.filter((s) => !pickedStudentIds.has(s.id)),
    [presentStudents, pickedStudentIds],
  );

  const remainingCount = useMemo(() => boxes.length, [boxes]);

  const clearOpenTimers = () => {
    openTimersRef.current.forEach(clearTimeout);
    openTimersRef.current = [];
  };

  const scheduleOpen = (fn, ms) => {
    const id = setTimeout(fn, ms);
    openTimersRef.current.push(id);
  };

  useEffect(() => {
    setPickedStudentIds(new Set());
    setPickHistory([]);
    setActiveStudentId('');
    setDisplayName('');
  }, [selectedClass, presentStudents]);

  useEffect(() => {
    return () => {
      cancelSpinRef.current?.();
      clearOpenTimers();
    };
  }, []);

  const parsedBoxCount = useMemo(() => {
    const n = Number.parseInt(boxCountInput, 10);
    if (!Number.isFinite(n)) return boxes.length;
    return Math.max(MIN_BOX_COUNT, Math.min(MAX_BOX_COUNT, n));
  }, [boxCountInput, boxes.length]);

  const applyBoxCount = (count) => {
    const n = Math.max(MIN_BOX_COUNT, Math.min(MAX_BOX_COUNT, count));
    setBoxCountInput(String(n));
    setBoxes(buildDefaultBoxes(n));
    setConfigured(false);
    setLastOpened(null);
    setOpeningPhase(null);
    setPickHistory([]);
    setPickedStudentIds(new Set());
  };

  const shuffleBoxes = async () => {
    await interactSound();
    sound.playLoop('spin');
    setShuffling(true);
    setShufflePhase('deal');
    setConfigured(false);
    setLastOpened(null);
    setOpeningPhase(null);
    setPickHistory([]);
    setPickedStudentIds(new Set());
    setActiveStudentId('');
    setDisplayName('');

    const shuffled = buildShuffledBoxes(
      boxes.map(({ type, label }) => ({ type, label })),
    );

    scheduleOpen(() => setShufflePhase('swap'), 500);
    scheduleOpen(() => setShufflePhase('swap'), 950);
    scheduleOpen(() => setShufflePhase('swap'), 1400);
    scheduleOpen(() => setShufflePhase('swap'), 1850);
    scheduleOpen(() => {
      setBoxes(shuffled);
      setShufflePhase('settle');
    }, 2300);
    scheduleOpen(async () => {
      sound.stop('spin');
      await sound.play('spin-stop');
      await sound.play('cheer');
      setShuffling(false);
      setShufflePhase('idle');
      setConfigured(true);
    }, 2800);
  };

  const runReshuffleRemaining = useCallback(
    (remaining) => {
      if (!remaining.length) {
        setBoxes([]);
        return;
      }
      if (remaining.length === 1) {
        setBoxes([{ ...remaining[0], displayNumber: 1, opened: false }]);
        return;
      }

      sound.playLoop('spin');
      setShuffling(true);
      setShufflePhase('deal');

      const shuffled = reshuffleRemainingBoxes(remaining);

      scheduleOpen(() => setShufflePhase('swap'), 400);
      scheduleOpen(() => setShufflePhase('swap'), 800);
      scheduleOpen(() => {
        setBoxes(shuffled);
        setShufflePhase('settle');
      }, 1200);
      scheduleOpen(async () => {
        sound.stop('spin');
        await sound.play('spin-stop');
        setShuffling(false);
        setShufflePhase('idle');
      }, 1600);
    },
    [sound],
  );

  const updateBox = (index, patch) => {
    setBoxes((prev) =>
      prev.map((box, i) => (i === index ? { ...box, ...patch } : box)),
    );
    setConfigured(false);
  };

  const quickPickStudent = async () => {
    if (!availableStudents.length || picking) return;
    await interactSound();
    sound.play('tap');
    setPicking(true);
    setDisplayName('');
    cancelSpinRef.current?.();
    cancelSpinRef.current = runPickAnimation(
      availableStudents,
      (student) => setDisplayName(student.fullName),
      (student) => {
        setActiveStudentId(student.id);
        setDisplayName(student.fullName);
        setPicking(false);
      },
    );
  };

  const openBox = useCallback(
    async (boxId) => {
      if (!activeStudent || openingPhase || shuffling) return;
      if (pickedStudentIds.has(activeStudent.id)) return;
      const box = boxes.find((b) => b.id === boxId);
      if (!box) return;

      await interactSound();
      sound.playLoop('tick');
      const boxNumber = box.displayNumber ?? boxes.indexOf(box) + 1;
      setRevealOverlay({
        studentName: activeStudent.fullName,
        boxNumber,
        label: box.label,
        type: box.type,
        phase: 'shake',
      });
      setOpeningPhase({ boxId, phase: 'shake' });
      setLastOpened(null);

      scheduleOpen(async () => {
        setOpeningPhase({ boxId, phase: 'pop' });
        setRevealOverlay((prev) => (prev ? { ...prev, phase: 'pop' } : null));
        await sound.play('suspense');
      }, OPEN_MS.shake);

      scheduleOpen(async () => {
        sound.stop('tick');
        setOpeningPhase({ boxId, phase: 'reveal' });
        setRevealOverlay((prev) => (prev ? { ...prev, phase: 'reveal' } : null));
        await sound.play('reveal');
      }, OPEN_MS.shake + OPEN_MS.pop);

      scheduleOpen(async () => {
        setLastOpened(box);

        const entry = {
          id: `${activeStudent.id}-${boxId}-${Date.now()}`,
          studentId: activeStudent.id,
          studentName: activeStudent.fullName,
          boxNumber,
          boxLabel: box.label,
          boxType: box.type,
          at: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        };
        setPickHistory((prev) => [entry, ...prev]);
        setPickedStudentIds((prev) => new Set([...prev, activeStudent.id]));

        if (box.type === 'reward') {
          await sound.play('win');
          await sound.play('cheer');
        } else if (box.type === 'penalty') {
          await sound.play('buzz');
        } else {
          await sound.play('tap');
        }

        setOpeningPhase(null);
        setActiveStudentId('');
        setDisplayName('');
      }, OPEN_MS.shake + OPEN_MS.pop + OPEN_MS.reveal);

      scheduleOpen(() => setRevealOverlay(null), OPEN_MS.shake + OPEN_MS.pop + OPEN_MS.reveal + 1800);

      scheduleOpen(() => {
        const remaining = boxes.filter((b) => b.id !== boxId);
        runReshuffleRemaining(remaining);
      }, OPEN_MS.shake + OPEN_MS.pop + OPEN_MS.reveal + 2000);
    },
    [activeStudent, boxes, openingPhase, shuffling, pickedStudentIds, interactSound, sound, runReshuffleRemaining],
  );

  const resetGame = async () => {
    cancelSpinRef.current?.();
    clearOpenTimers();
    sound.stop('spin');
    sound.stop('tick');
    applyBoxCount(parsedBoxCount);
    setConfigured(false);
    setShuffling(false);
    setShufflePhase('idle');
    setActiveStudentId('');
    setDisplayName('');
    setPicking(false);
    setOpeningPhase(null);
    setLastOpened(null);
    setRevealOverlay(null);
  };

  const showBurst = lastOpened?.type === 'reward' && configured && !openingPhase;

  const presentationToolbar = (
    <>
      <GameSoundToggle
        muted={sound.muted}
        onToggle={sound.toggleMuted}
        onUnlock={sound.unlock}
        onTestSound={() => sound.play('tap')}
        presenting={presenting}
      />
      {configured && availableStudents.length > 0 && !openingPhase && (
        <Button
          size={presenting ? 'lg' : 'sm'}
          variant="secondary"
          onClick={quickPickStudent}
          disabled={picking || Boolean(activeStudentId)}
        >
          <Dices className="h-4 w-4" />
          Quay tên
        </Button>
      )}
      <Button
        size={presenting ? 'lg' : 'sm'}
        variant="ghost"
        onClick={() => {
          interactSound();
          resetGame();
        }}
      >
        <RotateCcw className="h-4 w-4" />
        Reset
      </Button>
    </>
  );

  const historyPanel = pickHistory.length > 0 && (
    <div className="card max-h-96 overflow-auto p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Lịch sử lựa chọn ({pickHistory.length})
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {pickHistory.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <span className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {entry.studentName}
              </span>
              <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">
                Hộp #{entry.boxNumber} · {entry.at}
              </span>
            </div>
            <span
              className={`text-sm font-medium leading-snug ${
                entry.boxType === 'reward'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : entry.boxType === 'penalty'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-brand-600 dark:text-brand-400'
              }`}
            >
              {entry.boxLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-4" onPointerDown={() => interactSound()}>
      <div className="card overflow-visible p-3">
        {!presenting && (
          <div className="flex flex-wrap items-end gap-3">
            <Field label={`Số hộp (${MIN_BOX_COUNT}–${MAX_BOX_COUNT})`} className="w-40">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => applyBoxCount(parsedBoxCount - 1)}
                  disabled={parsedBoxCount <= MIN_BOX_COUNT}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={MIN_BOX_COUNT}
                  max={MAX_BOX_COUNT}
                  value={boxCountInput}
                  onChange={(e) => setBoxCountInput(e.target.value)}
                  onBlur={() => applyBoxCount(parsedBoxCount)}
                  className="text-center"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => applyBoxCount(parsedBoxCount + 1)}
                  disabled={parsedBoxCount >= MAX_BOX_COUNT}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </Field>
            <Button
              onClick={() => {
                applyBoxCount(parsedBoxCount);
                shuffleBoxes();
              }}
              disabled={!presentStudents.length}
            >
              <Shuffle className="h-4 w-4" />
              Xáo trộn & bắt đầu
            </Button>
            {presentStudents.length > 0 && configured && (
              <>
                <Field label="Học sinh lượt này" className="min-w-[180px] flex-1">
                  <Select
                    value={activeStudentId}
                    onChange={(e) => {
                      setActiveStudentId(e.target.value);
                      const s = presentStudents.find((st) => st.id === e.target.value);
                      setDisplayName(s?.fullName || '');
                    }}
                    disabled={!configured || Boolean(openingPhase)}
                  >
                    <option value="">— Chọn —</option>
                    {availableStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button
                  variant="secondary"
                  onClick={quickPickStudent}
                  disabled={picking || !configured || !availableStudents.length || Boolean(activeStudentId)}
                >
                  <Dices className="h-4 w-4" />
                  Quay nhanh
                </Button>
              </>
            )}
            {configured && (
              <p className="w-full text-xs text-slate-500">
                Mỗi học sinh chỉ chọn 1 hộp · còn {availableStudents.length}/{presentStudents.length} em chưa chọn
              </p>
            )}
          </div>
        )}
        {loadError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{loadError}</p>
        )}
      </div>

      {loadingStudents ? (
        <LoadingCatState message="Đang tải học sinh..." />
      ) : !selectedClass ? (
        activeClasses.length === 0 ? (
          <EmptyState icon={<Users className="h-7 w-7" />} title="Chưa có lớp đang hoạt động" />
        ) : (
          <SelectClassPrompt title="Chọn lớp để chơi hộp bí ẩn" />
        )
      ) : students.length === 0 ? (
        <EmptyState icon={<Users className="h-7 w-7" />} title="Lớp chưa có học sinh" />
      ) : presentStudents.length === 0 ? (
        <EmptyState icon={<Users className="h-7 w-7" />} title="Chưa chọn học sinh có mặt" />
      ) : (
        <>
          {!presenting && !configured && (
            <div className="card space-y-3 p-4">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Cấu hình nội dung từng hộp ({boxes.length} hộp)
              </p>
              <div className="max-h-[420px] space-y-2 overflow-y-auto">
                {boxes.map((box, index) => (
                  <div
                    key={box.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700"
                  >
                    <span className="w-8 text-center text-sm font-bold text-slate-400">
                      {index + 1}
                    </span>
                    <Select
                      className="w-32"
                      value={box.type}
                      onChange={(e) => updateBox(index, { type: e.target.value })}
                    >
                      {TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      className="min-w-[200px] flex-1"
                      value={box.label}
                      onChange={(e) => updateBox(index, { label: e.target.value })}
                      placeholder="Nhãn phần thưởng / phạt"
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Sau khi chỉnh nội dung, bấm <strong className="text-slate-700 dark:text-slate-200">Xáo trộn & bắt đầu</strong> ở trên để xáo vị trí và bắt đầu chơi.
              </p>
            </div>
          )}

          {!presenting && pickHistory.length > 0 && historyPanel}

          <GamePresentationShell
            shellRef={shellRef}
            presenting={presenting}
            onTogglePresentation={async () => {
              await interactSound();
              togglePresentation();
            }}
            stageBorder="border-violet-500/40"
            stageMinHeight="min-h-[300px] sm:min-h-[340px]"
            toolbar={presentationToolbar}
          >
            <GameSoundGate
              visible={!sound.ready}
              onEnable={() => sound.enableSound()}
            />

            <MysteryBoxRevealOverlay
              visible={Boolean(revealOverlay)}
              studentName={revealOverlay?.studentName}
              boxNumber={revealOverlay?.boxNumber}
              label={revealOverlay?.label}
              type={revealOverlay?.type}
              phase={revealOverlay?.phase}
            />

            <div
              className={`relative flex w-full flex-1 flex-col ${
                presenting ? 'min-h-0 gap-3' : 'gap-4'
              }`}
            >
              {presenting && configured && !shuffling && (activeStudent || displayName) && (
                <div className="game-presenting-name-banner shrink-0 overflow-visible px-6 py-5 text-center">
                  <p className="break-words text-[clamp(1.75rem,5vw,3.25rem)] font-black leading-snug tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)]">
                    {picking ? displayName : activeStudent?.fullName || displayName}
                  </p>
                  {!picking && activeStudent && (
                    <p className="game-stage-label mt-2 text-lg sm:text-xl">Chọn 1 hộp duy nhất</p>
                  )}
                </div>
              )}
              {shuffling ? (
                <div
                  className={`flex w-full flex-1 flex-col ${
                    presenting ? 'min-h-0 items-center justify-center gap-3' : 'gap-4'
                  }`}
                >
                  <GameSpotlightTitle presenting={presenting}>Đang xáo trộn…</GameSpotlightTitle>
                  <p className="game-stage-label shrink-0 text-sm">Các hộp quà đang được sắp xếp ngẫu nhiên</p>
                  <MysteryBoxGrid
                    boxes={boxes}
                    onPick={() => {}}
                    disabled
                    presenting={presenting}
                    shuffling
                    shufflePhase={shufflePhase}
                    showStats
                  />
                </div>
              ) : !configured ? (
                <>
                  <Gift className={`text-white/40 ${presenting ? 'h-20 w-20' : 'h-14 w-14'}`} />
                  <p className="game-stage-label text-center text-sm">
                    Cấu hình hộp rồi bấm &quot;Xáo trộn &amp; bắt đầu&quot; để chơi
                  </p>
                </>
              ) : (
                <>
                  {!presenting && (activeStudent || displayName) && (
                    <GameSpotlightTitle presenting={presenting}>
                      {picking ? displayName : activeStudent?.fullName || displayName}
                      {!picking && activeStudent && ' — chọn 1 hộp'}
                    </GameSpotlightTitle>
                  )}
                  {!presenting && !activeStudent && !picking && availableStudents.length > 0 && (
                    <p className="game-stage-label text-sm">Quay tên để chọn học sinh lượt này</p>
                  )}
                  {!presenting && !availableStudents.length && remainingCount > 0 && (
                    <p className="game-stage-text text-sm">Tất cả học sinh đã chọn — còn hộp chưa mở</p>
                  )}

                  <div
                    className={`relative w-full flex-1 ${
                      presenting ? 'flex min-h-0 items-center justify-center' : ''
                    }`}
                  >
                    <GameResultBurst
                      showConfetti={showBurst}
                      intense={presenting}
                      className={`${
                        presenting ? 'flex h-full w-full items-center justify-center' : ''
                      } ${lastOpened?.type === 'penalty' && !openingPhase ? 'game-reveal-shake' : ''}`}
                    >
                      <MysteryBoxGrid
                        boxes={boxes}
                        onPick={openBox}
                        disabled={!activeStudent || picking || pickedStudentIds.has(activeStudent?.id)}
                        presenting={presenting}
                        openingPhase={openingPhase}
                        showStats
                      />
                    </GameResultBurst>
                  </div>

                  {remainingCount === 0 && (
                    <p className="shrink-0 text-lg font-semibold text-amber-300">Đã mở hết hộp</p>
                  )}
                </>
              )}
            </div>
          </GamePresentationShell>
        </>
      )}
    </div>
  );
}
