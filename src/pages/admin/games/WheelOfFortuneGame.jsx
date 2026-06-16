import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleDot,
  Dices,
  Plus,
  RotateCcw,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { Button } from '../../../ui/components/Button.jsx';
import { EmptyState } from '../../../ui/components/EmptyState.jsx';
import { Field, Input, Select, Textarea } from '../../../ui/components/Field.jsx';
import { SelectClassPrompt, LoadingCatState } from '../../../ui/components/WaitingCatIllustration.jsx';
import { ClassFilterBar } from '../../../ui/components/ClassFilterBar.jsx';
import { FortuneWheel } from '../../../ui/components/games/FortuneWheel.jsx';
import { GameResultBurst } from '../../../ui/components/games/GameResultBurst.jsx';
import { GameSoundToggle } from '../../../ui/components/games/GameSoundToggle.jsx';
import { GameSpotlightTitle } from '../../../ui/components/games/GameSpotlightTitle.jsx';
import { PhraseBoard } from '../../../ui/components/games/PhraseBoard.jsx';
import { useGameSound } from '../../../hooks/useGameSound.js';
import { listActiveStudentsByClass } from '../../../services/students.service.js';
import { getErrorMessage } from '../../../lib/firestore.js';
import {
  DEFAULT_SPECIALS,
  SPECIAL_EFFECTS,
  applySpecialEffect,
  buildPuzzleBoard,
  buildWheelSegments,
  cloneBoard,
  formatRevealMessage,
  getHiddenLettersSet,
  isPuzzleComplete,
  revealLetter,
  spinWheel,
} from '../../../lib/wheelOfFortune.js';
import { GamePresentationShell, useGamePresentation } from './GamePresentationShell.jsx';

const DEFAULT_CODE = `print("hello world")
name = input("Ten: ")
if name == "admin":
    print("OK")`;

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

export function WheelOfFortuneGame({ classes, programs = [] }) {
  const sound = useGameSound();
  const cancelSpinRef = useRef(null);
  const spinTimerRef = useRef(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [codeText, setCodeText] = useState(DEFAULT_CODE);
  const [specials, setSpecials] = useState(DEFAULT_SPECIALS);
  const [board, setBoard] = useState(() => buildPuzzleBoard(DEFAULT_CODE));
  const [gameStarted, setGameStarted] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [picking, setPicking] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [newlyRevealedIds, setNewlyRevealedIds] = useState([]);
  const [needsLetterPick, setNeedsLetterPick] = useState(false);
  const [won, setWon] = useState(false);
  const { shellRef, presenting, togglePresentation } = useGamePresentation();

  const activeClasses = useMemo(
    () => classes.filter((c) => c.status === 'active'),
    [classes],
  );

  const activeStudent = useMemo(
    () => students.find((s) => s.id === activeStudentId) || null,
    [students, activeStudentId],
  );

  const wheelSegments = useMemo(
    () => (gameStarted ? buildWheelSegments(board, specials) : []),
    [board, specials, gameStarted],
  );

  const hiddenLetters = useMemo(() => [...getHiddenLettersSet(board)].sort(), [board]);

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
        setLoadingStudents(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(getErrorMessage(err));
        setLoadingStudents(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClass]);

  useEffect(() => {
    return () => {
      cancelSpinRef.current?.();
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    };
  }, []);

  const interactSound = useCallback(() => {
    sound.unlock();
  }, [sound]);

  const startGame = () => {
    interactSound();
    sound.play('tap');
    const nextBoard = buildPuzzleBoard(codeText);
    setBoard(nextBoard);
    setGameStarted(true);
    setWon(false);
    setStatusMessage('Chọn học sinh lượt đầu rồi bấm Quay');
    setNewlyRevealedIds([]);
    setNeedsLetterPick(false);
    setRotation(0);
  };

  const resetGame = () => {
    cancelSpinRef.current?.();
    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    sound.stop('spin');
    setBoard(buildPuzzleBoard(codeText));
    setGameStarted(false);
    setActiveStudentId('');
    setDisplayName('');
    setPicking(false);
    setSpinning(false);
    setStatusMessage('');
    setNewlyRevealedIds([]);
    setNeedsLetterPick(false);
    setWon(false);
    setRotation(0);
  };

  const nextStudent = () => {
    interactSound();
    if (!students.length) return;
    const idx = students.findIndex((s) => s.id === activeStudentId);
    const next = students[(idx + 1) % students.length];
    setActiveStudentId(next.id);
    setDisplayName(next.fullName);
    setNeedsLetterPick(false);
    setStatusMessage(`Lượt: ${next.fullName}`);
  };

  const quickPickStudent = () => {
    if (!students.length || picking) return;
    interactSound();
    sound.play('tap');
    setPicking(true);
    setDisplayName('');
    cancelSpinRef.current?.();
    cancelSpinRef.current = runPickAnimation(
      students,
      (student) => setDisplayName(student.fullName),
      (student) => {
        setActiveStudentId(student.id);
        setDisplayName(student.fullName);
        setPicking(false);
        setStatusMessage(`Lượt: ${student.fullName}`);
      },
    );
  };

  const markRevealedCells = (prevBoard, nextBoard) => {
    const ids = [];
    nextBoard.rows.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        const prev = prevBoard.rows[ri]?.[ci];
        if (prev && !prev.revealed && cell.revealed) {
          ids.push(cell.id);
        }
      });
    });
    setNewlyRevealedIds(ids);
    setTimeout(() => setNewlyRevealedIds([]), 800);
  };

  const handleLetterResult = (letter, keepTurn) => {
    const prevBoard = board;
    const nextBoard = cloneBoard(board);
    const count = revealLetter(nextBoard, letter);
    if (count > 0) markRevealedCells(prevBoard, nextBoard);
    setBoard(nextBoard);
    const msg = formatRevealMessage(letter, count);
    setStatusMessage(msg);

    if (count > 0) {
      sound.play('reveal');
      if (isPuzzleComplete(nextBoard)) {
        setWon(true);
        sound.play('win');
        setStatusMessage('Hoàn thành đoạn code!');
      } else if (keepTurn) {
      } else {
      }
    } else {
      sound.play('buzz');
    }
    return count;
  };

  const spin = () => {
    if (!gameStarted || spinning || !activeStudent || won) return;
    if (!wheelSegments.length) {
      setStatusMessage('Không còn chữ trên vòng — đoán cả câu hoặc Reset');
      return;
    }
    interactSound();
    sound.playLoop('spin');
    setSpinning(true);
    setNeedsLetterPick(false);
    const { segment, rotation: nextRot } = spinWheel(wheelSegments, rotation);
    setRotation(nextRot);

    spinTimerRef.current = setTimeout(() => {
      setSpinning(false);
      sound.stop('spin');
      sound.play('spin-stop');

      if (!segment) return;

      if (segment.type === 'letter') {
        const count = handleLetterResult(segment.letter, true);
        if (count <= 0) {
          setTimeout(nextStudent, 1200);
        }
      } else {
        const nextBoard = cloneBoard(board);
        const result = applySpecialEffect(segment.effect, nextBoard);
        if (result.count > 0) {
          markRevealedCells(board, nextBoard);
        }
        setBoard(nextBoard);
        setStatusMessage(`${segment.label}: ${result.message}`);
        sound.play(result.keepTurn || result.spinAgain ? 'reveal' : 'buzz');

        if (result.needsLetterPick) {
          setNeedsLetterPick(true);
        } else if (result.spinAgain) {
        } else if (isPuzzleComplete(nextBoard)) {
          setWon(true);
          sound.play('win');
        } else if (!result.keepTurn) {
          setTimeout(nextStudent, 1200);
        } else {
        }
      }
    }, 4600);
  };

  const pickFreeLetter = (letter) => {
    if (!needsLetterPick) return;
    interactSound();
    const count = handleLetterResult(letter, true);
    setNeedsLetterPick(false);
    if (count <= 0) {
      setTimeout(nextStudent, 1000);
    }
  };

  const solvePhrase = () => {
    interactSound();
    const nextBoard = cloneBoard(board);
    nextBoard.rows.forEach((row) => {
      row.forEach((cell) => {
        if (cell.hidden) cell.revealed = true;
      });
    });
    setBoard(nextBoard);
    setWon(true);
    sound.play('win');
    sound.play('cheer');
    setStatusMessage('Đoán đúng cả câu!');
  };

  const addSpecial = () => {
    setSpecials((prev) => [
      ...prev,
      { id: `sp-${Date.now()}`, label: 'Ô mới', effect: 'lose_turn' },
    ]);
  };

  const updateSpecial = (id, patch) => {
    setSpecials((prev) => prev.map((sp) => (sp.id === id ? { ...sp, ...patch } : sp)));
    setGameStarted(false);
  };

  const removeSpecial = (id) => {
    setSpecials((prev) => prev.filter((sp) => sp.id !== id));
    setGameStarted(false);
  };

  const wheelSize = presenting ? 340 : 280;

  const presentationToolbar = (
    <>
      <GameSoundToggle
        muted={sound.muted}
        onToggle={sound.toggleMuted}
        onUnlock={sound.unlock}
        onTestSound={() => sound.play('tap')}
        presenting={presenting}
      />
      {gameStarted && !won && (
        <>
          <Button
            size={presenting ? 'lg' : 'sm'}
            onClick={spin}
            disabled={spinning || !activeStudent || needsLetterPick}
          >
            <CircleDot className="h-4 w-4" />
            Quay
          </Button>
          <Button size={presenting ? 'lg' : 'sm'} variant="secondary" onClick={nextStudent}>
            HS tiếp
          </Button>
          <Button size={presenting ? 'lg' : 'sm'} variant="secondary" onClick={solvePhrase}>
            <Trophy className="h-4 w-4" />
            Đoán cả câu
          </Button>
        </>
      )}
      <Button size={presenting ? 'lg' : 'sm'} variant="ghost" onClick={resetGame}>
        <RotateCcw className="h-4 w-4" />
        Reset
      </Button>
    </>
  );

  return (
    <div className="space-y-4" onPointerDown={() => interactSound()}>
      <div className="card overflow-visible p-3">
        <ClassFilterBar
          classes={activeClasses}
          programs={programs}
          value={selectedClass}
          onChange={setSelectedClass}
          compact
          showStudentCount
          autoSelectFirst={false}
        />
        {!presenting && (
          <div className="mt-3 space-y-3">
            <Field label="Đoạn code (HS đoán chữ còn thiếu)">
              <Textarea
                rows={6}
                className="font-mono text-sm"
                value={codeText}
                onChange={(e) => {
                  setCodeText(e.target.value);
                  setGameStarted(false);
                }}
                placeholder='print("hello")'
              />
            </Field>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Ô đặc biệt trên vòng quay
                </p>
                <Button size="sm" variant="secondary" onClick={addSpecial}>
                  <Plus className="h-4 w-4" />
                  Thêm ô
                </Button>
              </div>
              <div className="space-y-2">
                {specials.map((sp) => (
                  <div
                    key={sp.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700"
                  >
                    <Input
                      className="min-w-[140px] flex-1"
                      value={sp.label}
                      onChange={(e) => updateSpecial(sp.id, { label: e.target.value })}
                      placeholder="Nhãn hiển thị"
                    />
                    <Select
                      className="w-44"
                      value={sp.effect}
                      onChange={(e) => updateSpecial(sp.id, { effect: e.target.value })}
                    >
                      {SPECIAL_EFFECTS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                    <Button size="sm" variant="ghost" onClick={() => removeSpecial(sp.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Button onClick={startGame} disabled={!codeText.trim()}>
                Bắt đầu vòng chơi
              </Button>
              {students.length > 0 && gameStarted && (
                <>
                  <Field label="Học sinh lượt này" className="min-w-[180px] flex-1">
                    <Select
                      value={activeStudentId}
                      onChange={(e) => {
                        setActiveStudentId(e.target.value);
                        const s = students.find((st) => st.id === e.target.value);
                        setDisplayName(s?.fullName || '');
                      }}
                    >
                      <option value="">— Chọn —</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.fullName}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button variant="secondary" onClick={quickPickStudent} disabled={picking}>
                    <Dices className="h-4 w-4" />
                    Quay tên
                  </Button>
                </>
              )}
            </div>
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
          <SelectClassPrompt title="Chọn lớp để chơi Chiếc nón kỳ diệu" />
        )
      ) : students.length === 0 ? (
        <EmptyState icon={<Users className="h-7 w-7" />} title="Lớp chưa có học sinh" />
      ) : (
        <GamePresentationShell
          shellRef={shellRef}
          presenting={presenting}
          onTogglePresentation={() => {
            interactSound();
            togglePresentation();
          }}
          stageBorder="border-cyan-500/40"
          toolbar={presentationToolbar}
        >
          <div
            className={`flex w-full flex-col items-center ${
              presenting ? 'min-h-[min(70vh,580px)] justify-center gap-6' : 'gap-5'
            }`}
          >
            {!gameStarted ? (
              <>
                <CircleDot className={`text-white/40 ${presenting ? 'h-20 w-20' : 'h-14 w-14'}`} />
                <p className="game-stage-label text-center text-sm">
                  Nhập code và bấm Bắt đầu vòng chơi
                </p>
              </>
            ) : (
              <GameResultBurst showConfetti={won} intense={presenting} className="w-full space-y-5">
                {(activeStudent || displayName) && (
                  <GameSpotlightTitle presenting={presenting}>
                    {picking ? displayName : activeStudent?.fullName || displayName || 'Chọn học sinh'}
                  </GameSpotlightTitle>
                )}

                <PhraseBoard
                  board={board}
                  presenting={presenting}
                  newlyRevealedIds={newlyRevealedIds}
                />

                {statusMessage && (
                  <p
                    className={`game-stage-text text-center font-bold ${
                      presenting ? 'text-xl sm:text-2xl' : 'text-base'
                    } ${won ? 'text-emerald-300' : ''}`}
                  >
                    {statusMessage}
                  </p>
                )}

                {needsLetterPick && hiddenLetters.length > 0 && (
                  <div className="rounded-2xl border border-violet-400/40 bg-violet-950/50 p-4">
                    <p className="game-stage-label mb-3 text-center text-sm font-semibold">
                      Chọn chữ tự do
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {hiddenLetters.map((letter) => (
                        <Button
                          key={letter}
                          size={presenting ? 'lg' : 'sm'}
                          onClick={() => pickFreeLetter(letter)}
                        >
                          {letter}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <FortuneWheel
                  segments={wheelSegments}
                  rotation={rotation}
                  spinning={spinning}
                  size={wheelSize}
                />
              </GameResultBurst>
            )}
          </div>
        </GamePresentationShell>
      )}
    </div>
  );
}
