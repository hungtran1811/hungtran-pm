import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { CREW_MINI_GAMES } from '../../data/crewMiniGames.js';
import { assignCrewTasks, buildTaskInstance, validateCrewTask } from '../../lib/crewTasks.js';
import {
  SPY_CREW_FEEDBACK_FAIL_MS,
  SPY_CREW_FEEDBACK_SUCCESS_MS,
  SPY_CREW_GAME_SWITCH_MS,
  SPY_CREW_TASK_FAIL_COOLDOWN_MAX_SECONDS,
  SPY_CREW_TASK_FAIL_COOLDOWN_MIN_SECONDS,
} from '../../lib/spyConstants.js';

const WIRE_COLORS = {
  red: 'bg-red-500 border-red-600',
  blue: 'bg-blue-500 border-blue-600',
  yellow: 'bg-amber-400 border-amber-500',
};

function randomFailCooldownMs() {
  const span = SPY_CREW_TASK_FAIL_COOLDOWN_MAX_SECONDS - SPY_CREW_TASK_FAIL_COOLDOWN_MIN_SECONDS + 1;
  const seconds = SPY_CREW_TASK_FAIL_COOLDOWN_MIN_SECONDS + Math.floor(Math.random() * span);
  return seconds * 1000;
}

function useCooldownLeft(endsAtMs) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAtMs || endsAtMs <= Date.now()) {
      setNow(Date.now());
      return undefined;
    }
    setNow(Date.now());
    const id = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAtMs) {
        window.clearInterval(id);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [endsAtMs]);
  if (!endsAtMs) return 0;
  return Math.max(0, Math.ceil((endsAtMs - now) / 1000));
}

function TaskShell({ title, instruction, children, footer, flash, blocked }) {
  return (
    <div className={`card crew-task-shell relative space-y-4 border-2 border-brand-200 bg-gradient-to-br from-brand-50 to-cyan-50 p-5 dark:border-brand-500/30 dark:from-brand-500/10 dark:to-cyan-500/10 ${flash === 'success' ? 'crew-task-success' : ''} ${flash === 'fail' ? 'crew-task-fail' : ''}`}>
      {flash && (
        <div
          className={`crew-feedback-overlay ${flash === 'success' ? 'crew-feedback-success' : 'crew-feedback-fail'}`}
          aria-live="polite"
        >
          <span className="crew-feedback-label">
            {flash === 'success' ? 'Đúng rồi!' : 'Sai rồi!'}
          </span>
        </div>
      )}
      {blocked > 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm dark:bg-slate-950/75">
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Thử lại sau</p>
            <p className="text-3xl font-black text-amber-600 dark:text-amber-300">{blocked}s</p>
          </div>
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
          Nhiệm vụ
        </p>
        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{title}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{instruction}</p>
      </div>
      {children}
      {footer}
    </div>
  );
}

function useTaskFeedback({ onSuccess, onFail, onFlash }) {
  const [flash, setFlash] = useState(null);
  const timersRef = useRef([]);
  const busyRef = useRef(false);

  useEffect(() => () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
  }, []);

  const schedule = useCallback((fn, ms) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const submit = useCallback((taskId, instanceSeed, payload) => {
    if (busyRef.current) return false;

    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];

    const result = validateCrewTask(taskId, instanceSeed, payload);
    if (result.ok) {
      busyRef.current = true;
      setFlash('success');
      onFlash?.('success');
      schedule(() => {
        setFlash(null);
        busyRef.current = false;
        onSuccess?.();
      }, SPY_CREW_FEEDBACK_SUCCESS_MS);
      return true;
    }
    busyRef.current = true;
    setFlash('fail');
    onFlash?.('fail');
    schedule(() => {
      setFlash(null);
      busyRef.current = false;
      onFail?.();
    }, SPY_CREW_FEEDBACK_FAIL_MS);
    return false;
  }, [onSuccess, onFail, onFlash, schedule]);

  return { flash, submit };
}

function TapSequenceGame({ instance, onSubmit, flash, blocked, locked }) {
  const [phase, setPhase] = useState('demo');
  const [highlight, setHighlight] = useState(null);
  const [input, setInput] = useState([]);
  const instanceSeed = instance.instanceSeed;

  useEffect(() => {
    setPhase('demo');
    setHighlight(null);
    setInput([]);
    let cancelled = false;
    const timers = [];
    instance.order.forEach((n, i) => {
      timers.push(window.setTimeout(() => {
        if (cancelled) return;
        setHighlight(n);
        timers.push(window.setTimeout(() => {
          if (!cancelled) setHighlight(null);
        }, 500));
      }, i * 700 + 400));
    });
    timers.push(window.setTimeout(() => {
      if (!cancelled) setPhase('input');
    }, instance.order.length * 700 + 500));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [instanceSeed, instance.order]);

  return (
    <TaskShell title={CREW_MINI_GAMES.tap_sequence.label} instruction={phase === 'demo' ? 'Ghi nhớ thứ tự đang hiện...' : 'Bấm lại đúng thứ tự vừa xem.'} flash={flash} blocked={blocked}>
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((n) => (
          <Button
            key={n}
            type="button"
            variant={highlight === n ? 'primary' : 'secondary'}
            disabled={phase !== 'input' || blocked > 0 || locked}
            className={`min-h-14 transition-transform ${highlight === n ? 'crew-tap-pulse scale-105' : ''}`}
            onClick={() => {
              const next = [...input, n];
              setInput(next);
              if (next.length === instance.order.length) {
                if (!onSubmit({ sequence: next })) {
                  window.setTimeout(() => setInput([]), SPY_CREW_FEEDBACK_FAIL_MS);
                }
              }
            }}
          >
            {n}
          </Button>
        ))}
      </div>
    </TaskShell>
  );
}

function OddOneOutGame({ instance, onSubmit, flash, blocked, locked }) {
  const [picked, setPicked] = useState(null);
  const instanceSeed = instance.instanceSeed;

  useEffect(() => {
    setPicked(null);
  }, [instanceSeed]);
  return (
    <TaskShell title={CREW_MINI_GAMES.odd_one_out.label} instruction="Chọn hình tròn có màu hơi khác so với các hình còn lại." flash={flash} blocked={blocked}>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, idx) => {
          const isOdd = idx === instance.oddIndex;
          const style = {
            backgroundColor: `hsl(${instance.baseHue} ${instance.baseSat}% ${isOdd ? instance.baseLight - 4 : instance.baseLight}%)`,
          };
          return (
            <button
              key={idx}
              type="button"
              disabled={picked !== null || blocked > 0 || locked}
              style={style}
              className={`crew-odd-tile h-16 rounded-full border border-black/10 shadow-inner transition hover:scale-105 active:scale-95 disabled:opacity-70 dark:border-white/10 ${picked === idx ? 'ring-2 ring-brand-500' : ''}`}
              onClick={() => {
                setPicked(idx);
                if (!onSubmit({ pickIndex: idx })) {
                  window.setTimeout(() => setPicked(null), SPY_CREW_FEEDBACK_FAIL_MS);
                }
              }}
            />
          );
        })}
      </div>
    </TaskShell>
  );
}

const TIMING_BAR_SPEED = 0.85;

function TimingBarGame({ instance, onSubmit, flash, blocked, locked }) {
  const [position, setPosition] = useState(0);
  const [stopped, setStopped] = useState(false);
  const direction = useRef(1);
  const rafRef = useRef(null);
  const runningRef = useRef(false);
  const instanceSeed = instance.instanceSeed;
  const isBlocked = blocked > 0;

  const stopLoop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startLoop = useCallback(() => {
    stopLoop();
    runningRef.current = true;
    const tick = () => {
      if (!runningRef.current) return;
      setPosition((prev) => {
        let next = prev + direction.current * TIMING_BAR_SPEED;
        if (next >= 100) {
          next = 100;
          direction.current = -1;
        } else if (next <= 0) {
          next = 0;
          direction.current = 1;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopLoop]);

  // Chỉ phụ thuộc isBlocked (boolean) — tránh reset mỗi giây khi countdown tick.
  useEffect(() => {
    setPosition(0);
    setStopped(false);
    direction.current = 1;
    if (!isBlocked) {
      startLoop();
    } else {
      stopLoop();
    }
    return stopLoop;
  }, [instanceSeed, isBlocked, startLoop, stopLoop]);

  return (
    <TaskShell title={CREW_MINI_GAMES.timing_bar.label} instruction="Bấm Dừng khi thanh trắng nằm trong vùng xanh." flash={flash} blocked={blocked}>
      <div className="space-y-4">
        <div className="relative h-8 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="absolute top-0 h-8 rounded-full bg-emerald-500/80 crew-zone-glow" style={{ left: `${instance.zoneStart}%`, width: `${instance.zoneWidth}%` }} />
          <div className="absolute top-1 h-6 w-3 -translate-x-1/2 rounded-full bg-white shadow-md ring-2 ring-brand-500" style={{ left: `${position}%` }} />
        </div>
        <Button type="button" variant="primary" className="w-full min-h-12" disabled={stopped || isBlocked || locked} onClick={() => {
          setStopped(true);
          stopLoop();
          if (!onSubmit({ position: Math.round(position) })) {
            // Không resume ngay — chờ cooldown xong effect sẽ start lại sạch.
            setStopped(false);
          }
        }}>
          Dừng!
        </Button>
      </div>
    </TaskShell>
  );
}

function WireMatchGame({ instance, onSubmit, flash, blocked, locked }) {
  const [matches, setMatches] = useState(['', '', '']);
  const colors = ['red', 'blue', 'yellow'];
  const instanceSeed = instance.instanceSeed;

  useEffect(() => {
    setMatches(['', '', '']);
  }, [instanceSeed]);
  return (
    <TaskShell title={CREW_MINI_GAMES.wire_match.label} instruction="Chọn màu bên phải trùng với màu bên trái." flash={flash} blocked={blocked}>
      <div className="space-y-3">
        {instance.leftOrder.map((color, idx) => (
          <div key={`${color}-${idx}`} className="crew-wire-row flex items-center gap-3">
            <span className={`h-10 w-10 shrink-0 rounded-full border-2 ${WIRE_COLORS[color] || 'bg-slate-400'}`} />
            <div className="crew-wire-line h-1 flex-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <select
              className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              disabled={blocked > 0 || locked}
              value={matches[idx] || ''}
              onChange={(e) => {
                const next = [...matches];
                next[idx] = e.target.value;
                setMatches(next);
                if (next.filter(Boolean).length === 3) {
                  if (!onSubmit({ matches: instance.leftOrder.map((left, i) => ({ left, right: next[i] })) })) {
                    window.setTimeout(() => setMatches(['', '', '']), SPY_CREW_FEEDBACK_FAIL_MS);
                  }
                }
              }}
            >
              <option value="">Chọn màu</option>
              {colors.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </TaskShell>
  );
}

function QuickCountGame({ instance, onSubmit, flash, blocked, locked }) {
  const [phase, setPhase] = useState('memorize');
  const [answer, setAnswer] = useState(null);
  const instanceSeed = instance.instanceSeed;
  const isBlocked = blocked > 0;

  useEffect(() => {
    if (isBlocked) {
      setPhase('memorize');
      setAnswer(null);
      return undefined;
    }
    setPhase('memorize');
    setAnswer(null);
    const t = window.setTimeout(() => setPhase('answer'), 2200);
    return () => clearTimeout(t);
  }, [instanceSeed, isBlocked]);

  return (
    <TaskShell title={CREW_MINI_GAMES.quick_count.label} instruction={phase === 'memorize' ? 'Nhớ nhanh số lượng emoji!' : 'Chọn đáp án đúng.'} flash={flash} blocked={blocked}>
      <div className="space-y-4">
        <div className={`rounded-2xl border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-900 ${phase === 'memorize' && !isBlocked ? 'crew-count-flash' : ''}`}>
          {phase === 'memorize' ? (
            <p className="text-2xl leading-relaxed">{instance.emoji.repeat(instance.count)}</p>
          ) : (
            <p className="text-lg font-medium text-slate-500">???</p>
          )}
        </div>
        {phase === 'answer' && !isBlocked && (
          <div className="grid grid-cols-2 gap-2 crew-options-in">
            {instance.options.map((option) => (
              <Button key={option} type="button" variant={answer === option ? 'primary' : 'secondary'} disabled={answer !== null || locked} onClick={() => {
                setAnswer(option);
                if (!onSubmit({ answer: option })) {
                  window.setTimeout(() => setAnswer(null), SPY_CREW_FEEDBACK_FAIL_MS);
                }
              }}>
                {option}
              </Button>
            ))}
          </div>
        )}
      </div>
    </TaskShell>
  );
}

export function CrewTaskPanel({
  sessionId,
  studentId,
  taskPerPlayer = 5,
  completedCount = 0,
  onCompleteTask,
  onTaskFeedback,
}) {
  const tasks = useMemo(
    () => assignCrewTasks({ sessionId, studentId, count: taskPerPlayer }),
    [sessionId, studentId, taskPerPlayer],
  );
  const [localCompleted, setLocalCompleted] = useState(completedCount);
  const [playIndex, setPlayIndex] = useState(completedCount);
  const [failCooldownUntil, setFailCooldownUntil] = useState(0);
  const [switchingUntil, setSwitchingUntil] = useState(0);
  const switchTimerRef = useRef(null);
  const failCooldownLeft = useCooldownLeft(failCooldownUntil);
  const switchLeftMs = Math.max(0, switchingUntil - Date.now());
  const switchBlocked = switchLeftMs > 0;

  useEffect(() => {
    setLocalCompleted((prev) => Math.max(prev, completedCount));
  }, [completedCount]);

  const effectiveCompleted = Math.max(localCompleted, completedCount);

  useEffect(() => {
    setPlayIndex((prev) => {
      if (prev < effectiveCompleted) return effectiveCompleted;
      if (prev >= taskPerPlayer) return Math.max(effectiveCompleted, taskPerPlayer - 1);
      return prev;
    });
  }, [effectiveCompleted, taskPerPlayer]);

  useEffect(() => () => {
    if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current);
  }, []);

  const currentTask = tasks[playIndex];
  const instance = useMemo(
    () => (currentTask ? buildTaskInstance(currentTask.taskId, currentTask.instanceSeed) : null),
    [currentTask?.taskId, currentTask?.instanceSeed],
  );
  const remainingTasks = tasks.slice(effectiveCompleted);

  const requestSwitch = useCallback((nextIndex) => {
    if (nextIndex < effectiveCompleted || nextIndex === playIndex) return;
    if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current);
    setSwitchingUntil(Date.now() + SPY_CREW_GAME_SWITCH_MS);
    switchTimerRef.current = window.setTimeout(() => {
      setPlayIndex(nextIndex);
      // Giữ fail cooldown — vẫn phải chờ hết giờ mới chơi tiếp.
      setSwitchingUntil(0);
    }, SPY_CREW_GAME_SWITCH_MS);
  }, [effectiveCompleted, playIndex]);

  const handleFail = useCallback(() => {
    setFailCooldownUntil(Date.now() + randomFailCooldownMs());
  }, []);

  const handleSuccess = useCallback(() => {
    const nextCompleted = effectiveCompleted + 1;
    setLocalCompleted(nextCompleted);
    setFailCooldownUntil(0);
    if (nextCompleted < taskPerPlayer) {
      if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current);
      setSwitchingUntil(Date.now() + SPY_CREW_GAME_SWITCH_MS);
      switchTimerRef.current = window.setTimeout(() => {
        setPlayIndex(nextCompleted);
        setSwitchingUntil(0);
      }, SPY_CREW_GAME_SWITCH_MS);
    }
    onCompleteTask?.(nextCompleted);
  }, [effectiveCompleted, taskPerPlayer, onCompleteTask]);

  const handleFlash = useCallback((type) => {
    onTaskFeedback?.(type);
  }, [onTaskFeedback]);

  const { flash, submit } = useTaskFeedback({
    onSuccess: handleSuccess,
    onFail: handleFail,
    onFlash: handleFlash,
  });

  useEffect(() => {
    if (failCooldownUntil > 0 && failCooldownUntil <= Date.now()) {
      setFailCooldownUntil(0);
    }
  }, [failCooldownLeft, failCooldownUntil]);

  const tryComplete = useCallback((payload) => {
    if (!currentTask || failCooldownUntil > Date.now() || switchBlocked || flash) return false;
    return submit(currentTask.taskId, currentTask.instanceSeed, payload);
  }, [currentTask, submit, failCooldownUntil, switchBlocked, flash]);

  if (effectiveCompleted >= taskPerPlayer) {
    return (
      <div className="card crew-task-done space-y-3 border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">Đã hoàn thành nhiệm vụ</p>
        <p className="text-sm text-emerald-800 dark:text-emerald-200">Chờ họp hoặc chờ các bạn khác hoàn thành.</p>
      </div>
    );
  }

  if (!currentTask || !instance) return null;

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Badge tone="brand">{effectiveCompleted}/{taskPerPlayer} nhiệm vụ</Badge>
      {failCooldownLeft > 0 && <Badge tone="amber">Chờ {failCooldownLeft}s</Badge>}
      {switchBlocked && <Badge tone="slate">Đang tải game...</Badge>}
    </div>
  );

  const gameProps = {
    instance,
    onSubmit: tryComplete,
    flash,
    blocked: failCooldownLeft,
    locked: !!flash || switchBlocked,
  };
  // Remount sạch khi hết cooldown / đổi game — tránh thanh trượt đơ.
  const gameKey = `${playIndex}-${currentTask.taskId}-${currentTask.instanceSeed}-${failCooldownLeft > 0 ? 'wait' : 'play'}`;

  return (
    <div className="space-y-3">
      {remainingTasks.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {remainingTasks.map((task, offset) => {
            const index = effectiveCompleted + offset;
            const label = CREW_MINI_GAMES[task.taskId]?.label || task.taskId;
            return (
              <button
                key={`${index}-${task.taskId}`}
                type="button"
                onClick={() => requestSwitch(index)}
                disabled={index < effectiveCompleted || switchBlocked || !!flash}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  playIndex === index
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/10 dark:text-brand-200'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div key={gameKey} className="relative">
        {switchBlocked && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm dark:bg-slate-950/75">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Đang chuyển nhiệm vụ...</p>
          </div>
        )}
        {currentTask.taskId === 'tap_sequence' && <TapSequenceGame {...gameProps} />}
        {currentTask.taskId === 'odd_one_out' && <OddOneOutGame {...gameProps} />}
        {currentTask.taskId === 'timing_bar' && <TimingBarGame {...gameProps} />}
        {currentTask.taskId === 'wire_match' && <WireMatchGame {...gameProps} />}
        {currentTask.taskId === 'quick_count' && <QuickCountGame {...gameProps} />}
        {footer}
      </div>
    </div>
  );
}
