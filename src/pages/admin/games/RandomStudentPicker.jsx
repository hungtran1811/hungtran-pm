import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dices, RotateCcw, Sparkles, Users } from 'lucide-react';
import { Button } from '../../../ui/components/Button.jsx';
import { EmptyState } from '../../../ui/components/EmptyState.jsx';
import { SelectClassPrompt, LoadingCatState } from '../../../ui/components/WaitingCatIllustration.jsx';
import { ClassFilterBar } from '../../../ui/components/ClassFilterBar.jsx';
import { listActiveStudentsByClass } from '../../../services/students.service.js';
import { getErrorMessage } from '../../../lib/firestore.js';
import { GameConfetti } from './GameConfetti.jsx';
import { GamePresentationShell, useGamePresentation } from './GamePresentationShell.jsx';

function runPickAnimation(pool, onTick, onDone) {
  if (!pool.length) return () => {};
  const winnerIndex = Math.floor(Math.random() * pool.length);
  const totalSteps = 24 + Math.floor(Math.random() * 16);
  let step = 0;
  let cancelled = false;
  let timeoutId;

  const tick = () => {
    if (cancelled) return;
    const idx = step < totalSteps - 1
      ? Math.floor(Math.random() * pool.length)
      : winnerIndex;
    onTick(pool[idx]);
    step += 1;
    if (step >= totalSteps) {
      onDone(pool[winnerIndex]);
      return;
    }
    const progress = step / totalSteps;
    const delay = 45 + progress * progress * 340;
    timeoutId = setTimeout(tick, delay);
  };

  tick();
  return () => {
    cancelled = true;
    clearTimeout(timeoutId);
  };
}

export function RandomStudentPicker({ classes, programs = [] }) {
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [phase, setPhase] = useState('idle');
  const [displayName, setDisplayName] = useState('');
  const [winner, setWinner] = useState(null);
  const [pickedIds, setPickedIds] = useState([]);
  const [history, setHistory] = useState([]);
  const [excludePicked, setExcludePicked] = useState(true);
  const cancelSpinRef = useRef(null);
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
    setPhase('idle');
    setDisplayName('');
    setWinner(null);
    setPickedIds([]);
    setHistory([]);

    listActiveStudentsByClass(selectedClass)
      .then((list) => {
        if (cancelled) return;
        setStudents(list);
        setLoadingStudents(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(getErrorMessage(error));
        setStudents([]);
        setLoadingStudents(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClass]);

  useEffect(() => () => cancelSpinRef.current?.(), []);

  const pickedSet = useMemo(() => new Set(pickedIds), [pickedIds]);

  const pool = useMemo(() => {
    let list = students;
    if (excludePicked) list = list.filter((s) => !pickedSet.has(s.id));
    return list;
  }, [students, excludePicked, pickedSet]);

  const selectedClassDoc = useMemo(
    () => activeClasses.find((c) => c.classCode === selectedClass) || null,
    [activeClasses, selectedClass],
  );

  const resetSession = useCallback(() => {
    cancelSpinRef.current?.();
    cancelSpinRef.current = null;
    setPhase('idle');
    setDisplayName('');
    setWinner(null);
    setPickedIds([]);
    setHistory([]);
  }, []);

  const handleSpin = () => {
    if (phase === 'spinning' || !pool.length) return;
    cancelSpinRef.current?.();
    setPhase('spinning');
    setWinner(null);
    setDisplayName(pool[Math.floor(Math.random() * pool.length)]?.fullName || '');

    cancelSpinRef.current = runPickAnimation(
      pool,
      (student) => setDisplayName(student.fullName),
      (student) => {
        setWinner(student);
        setDisplayName(student.fullName);
        setPhase('revealed');
        setPickedIds((prev) => (prev.includes(student.id) ? prev : [...prev, student.id]));
        setHistory((prev) => [
          { id: student.id, fullName: student.fullName, at: Date.now() },
          ...prev,
        ]);
        cancelSpinRef.current = null;
      },
    );
  };

  const nameClass = presenting
    ? 'text-6xl sm:text-7xl md:text-8xl lg:text-9xl'
    : 'text-3xl sm:text-4xl md:text-5xl';

  const stageBorder = phase === 'revealed'
    ? 'border-amber-400/80 shadow-[0_0_40px_rgba(251,191,36,0.35)]'
    : phase === 'spinning'
      ? 'border-brand-400/60 shadow-[0_0_30px_rgba(49,111,253,0.4)]'
      : 'border-slate-700/80';

  return (
    <div className="space-y-4">
      <div className="card overflow-visible p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
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
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
                checked={excludePicked}
                onChange={(e) => setExcludePicked(e.target.checked)}
              />
              Không lặp lại trong buổi
            </label>
            <span className="text-slate-400">·</span>
            <span>
              <strong>{pool.length}</strong>
              /
              {students.length}
              {' '}
              học sinh
            </span>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
          {loadError}
        </div>
      )}

      {loadingStudents ? (
        <LoadingCatState message="Đang tải học sinh..." />
      ) : !selectedClass ? (
        activeClasses.length === 0 ? (
          <EmptyState icon={<Users className="h-7 w-7" />} title="Chưa có lớp đang hoạt động" />
        ) : (
          <SelectClassPrompt title="Chọn lớp để quay tên học sinh" />
        )
      ) : students.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title="Lớp chưa có học sinh"
          description="Thêm học sinh trong mục Học sinh trước khi quay tên."
        />
      ) : pool.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-7 w-7" />}
          title="Đã quay hết học sinh"
          description="Bật lại tất cả hoặc tắt «Không lặp lại trong buổi» để quay tiếp."
          action={(
            <Button variant="secondary" onClick={resetSession}>
              <RotateCcw className="h-4 w-4" />
              Quay lại từ đầu
            </Button>
          )}
        />
      ) : (
        <>
          <GamePresentationShell
            shellRef={shellRef}
            presenting={presenting}
            onTogglePresentation={togglePresentation}
            stageBorder={stageBorder}
            toolbar={(
              <>
                <Button
                  size={presenting ? 'lg' : 'lg'}
                  onClick={handleSpin}
                  disabled={phase === 'spinning'}
                  loading={phase === 'spinning'}
                >
                  <Dices className="h-5 w-5" />
                  {presenting
                    ? phase === 'spinning'
                      ? '…'
                      : phase === 'revealed'
                        ? 'Tiếp'
                        : 'Quay'
                    : phase === 'spinning'
                      ? 'Đang quay...'
                      : phase === 'revealed'
                        ? 'Quay tiếp'
                        : 'Quay tên'}
                </Button>
                <Button
                  variant="secondary"
                  size={presenting ? 'lg' : 'default'}
                  onClick={resetSession}
                  disabled={phase === 'spinning'}
                  title="Làm mới buổi"
                >
                  <RotateCcw className="h-4 w-4" />
                  {!presenting && 'Làm mới buổi'}
                </Button>
              </>
            )}
          >
            <div
              className={`relative ${
                presenting ? 'min-h-[min(70vh,560px)]' : 'min-h-[280px] sm:min-h-[320px]'
              }`}
            >
              {phase === 'spinning' && (
                <div className="game-marquee absolute inset-x-0 top-0 h-1" />
              )}

              {(phase === 'spinning' || phase === 'revealed') && (
                <>
                  <div
                    className={`game-spin-slow pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-500/20 ${
                      presenting
                        ? 'h-[min(92vw,520px)] w-[min(92vw,520px)]'
                        : 'h-[min(90%,420px)] w-[min(90%,420px)]'
                    }`}
                  />
                  <div
                    className={`game-spin-reverse pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-400/15 ${
                      presenting
                        ? 'h-[min(78vw,440px)] w-[min(78vw,440px)]'
                        : 'h-[min(75%,340px)] w-[min(75%,340px)]'
                    }`}
                  />
                </>
              )}

              {phase === 'spinning' && (
                <>
                  <div
                    className={`game-pulse-ring pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-400/50 ${
                      presenting
                        ? 'h-[min(88vw,500px)] w-[min(88vw,500px)]'
                        : 'h-[min(85%,400px)] w-[min(85%,400px)]'
                    }`}
                  />
                  <div
                    className={`game-pulse-ring pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-400/50 ${
                      presenting
                        ? 'h-[min(88vw,500px)] w-[min(88vw,500px)]'
                        : 'h-[min(85%,400px)] w-[min(85%,400px)]'
                    }`}
                    style={{ animationDelay: '0.6s' }}
                  />
                </>
              )}

              {phase === 'revealed' && <GameConfetti intense={presenting} />}

              <div className="relative flex min-h-[inherit] flex-col items-center justify-center px-4 text-center">
                {!presenting && selectedClassDoc && phase !== 'revealed' && (
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-300/70">
                    {selectedClassDoc.className || selectedClassDoc.classCode}
                  </p>
                )}

                {phase === 'idle' && (
                  <span
                    className={`font-black text-white/20 ${
                      presenting
                        ? 'game-idle-mark text-[8rem] leading-none sm:text-[10rem]'
                        : 'text-6xl'
                    }`}
                    aria-hidden
                  >
                    ?
                  </span>
                )}

                {(phase === 'spinning' || phase === 'revealed') && (
                  <p
                    className={`max-w-[90vw] font-black leading-[1.05] tracking-tight text-white ${
                      phase === 'revealed'
                        ? `game-name-reveal ${nameClass}`
                        : `${nameClass} blur-[3px] opacity-90`
                    }`}
                  >
                    {displayName}
                  </p>
                )}

                {!presenting && phase === 'idle' && (
                  <p className="mt-4 text-sm text-slate-500">Nhấn Quay tên</p>
                )}
              </div>
            </div>
          </GamePresentationShell>

          {history.length > 0 && (
            <div className="card p-3">
              <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Đã quay (
                {history.length}
                )
              </p>
              <div className="flex flex-wrap gap-2">
                {history.map((item, index) => (
                  <span
                    key={`${item.id}-${item.at}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <span className="text-xs font-bold text-brand-600 dark:text-brand-300">
                      #
                      {history.length - index}
                    </span>
                    {item.fullName}
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
