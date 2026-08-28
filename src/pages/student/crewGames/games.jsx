import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../../ui/components/Button.jsx';
import { CREW_DIRECTION_LABELS, CREW_MINI_GAMES } from '../../../data/crewMiniGames.js';
import { SPY_CREW_FEEDBACK_FAIL_MS } from '../../../lib/spyConstants.js';
import { TaskShell, WIRE_COLORS } from './shared.jsx';

export function TapSequenceGame({ instance, onSubmit, flash, blocked, locked }) {
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

export function OddOneOutGame({ instance, onSubmit, flash, blocked, locked }) {
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

export function TimingBarGame({ instance, onSubmit, flash, blocked, locked }) {
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

export function WireMatchGame({ instance, onSubmit, flash, blocked, locked }) {
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

export function QuickCountGame({ instance, onSubmit, flash, blocked, locked }) {
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

export function NumberSortGame({ instance, onSubmit, flash, blocked, locked }) {
  const [input, setInput] = useState([]);
  const instanceSeed = instance.instanceSeed;

  useEffect(() => {
    setInput([]);
  }, [instanceSeed]);

  return (
    <TaskShell
      title={CREW_MINI_GAMES.number_sort.label}
      instruction={`Bấm tăng dần từ 1 → 6. Đã chọn: ${input.length}/6`}
      flash={flash}
      blocked={blocked}
    >
      <div className="grid grid-cols-3 gap-2">
        {instance.order.map((n) => {
          const picked = input.includes(n);
          return (
            <Button
              key={n}
              type="button"
              variant={picked ? 'primary' : 'secondary'}
              disabled={picked || blocked > 0 || locked}
              className="min-h-14 text-lg font-bold"
              onClick={() => {
                const next = [...input, n];
                setInput(next);
                if (next.length === 6) {
                  if (!onSubmit({ sequence: next })) {
                    window.setTimeout(() => setInput([]), SPY_CREW_FEEDBACK_FAIL_MS);
                  }
                }
              }}
            >
              {n}
            </Button>
          );
        })}
      </div>
    </TaskShell>
  );
}

export function MathPickGame({ instance, onSubmit, flash, blocked, locked }) {
  const [answer, setAnswer] = useState(null);
  const instanceSeed = instance.instanceSeed;

  useEffect(() => {
    setAnswer(null);
  }, [instanceSeed]);

  return (
    <TaskShell
      title={CREW_MINI_GAMES.math_pick.label}
      instruction="Chọn đáp án đúng cho phép tính."
      flash={flash}
      blocked={blocked}
    >
      <div className="space-y-4">
        <p className="rounded-2xl border border-slate-200 bg-white py-6 text-center text-3xl font-black text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
          {instance.a} {instance.op} {instance.b} = ?
        </p>
        <div className="grid grid-cols-2 gap-2">
          {instance.options.map((option) => (
            <Button
              key={option}
              type="button"
              variant={answer === option ? 'primary' : 'secondary'}
              disabled={answer !== null || blocked > 0 || locked}
              className="min-h-12 text-lg font-bold"
              onClick={() => {
                setAnswer(option);
                if (!onSubmit({ answer: option })) {
                  window.setTimeout(() => setAnswer(null), SPY_CREW_FEEDBACK_FAIL_MS);
                }
              }}
            >
              {option}
            </Button>
          ))}
        </div>
      </div>
    </TaskShell>
  );
}

export function SymbolHuntGame({ instance, onSubmit, flash, blocked, locked }) {
  const [phase, setPhase] = useState('memorize');
  const [picked, setPicked] = useState(null);
  const instanceSeed = instance.instanceSeed;
  const isBlocked = blocked > 0;

  useEffect(() => {
    if (isBlocked) {
      setPhase('memorize');
      setPicked(null);
      return undefined;
    }
    setPhase('memorize');
    setPicked(null);
    const t = window.setTimeout(() => setPhase('pick'), 1200);
    return () => clearTimeout(t);
  }, [instanceSeed, isBlocked]);

  return (
    <TaskShell
      title={CREW_MINI_GAMES.symbol_hunt.label}
      instruction={phase === 'memorize' ? 'Nhớ biểu tượng này!' : 'Chọn đúng biểu tượng vừa thấy.'}
      flash={flash}
      blocked={blocked}
    >
      <div className="space-y-4">
        {phase === 'memorize' ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-5xl">{instance.target}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {instance.grid.map((symbol, idx) => (
              <Button
                key={`${symbol}-${idx}`}
                type="button"
                variant={picked === idx ? 'primary' : 'secondary'}
                disabled={picked !== null || blocked > 0 || locked}
                className="min-h-14 text-2xl"
                onClick={() => {
                  setPicked(idx);
                  if (!onSubmit({ pickIndex: idx })) {
                    window.setTimeout(() => setPicked(null), SPY_CREW_FEEDBACK_FAIL_MS);
                  }
                }}
              >
                {symbol}
              </Button>
            ))}
          </div>
        )}
      </div>
    </TaskShell>
  );
}

export function DirectionDashGame({ instance, onSubmit, flash, blocked, locked }) {
  const [phase, setPhase] = useState('memorize');
  const [picked, setPicked] = useState(null);
  const instanceSeed = instance.instanceSeed;
  const isBlocked = blocked > 0;

  useEffect(() => {
    if (isBlocked) {
      setPhase('memorize');
      setPicked(null);
      return undefined;
    }
    setPhase('memorize');
    setPicked(null);
    const t = window.setTimeout(() => setPhase('pick'), 1100);
    return () => clearTimeout(t);
  }, [instanceSeed, isBlocked]);

  return (
    <TaskShell
      title={CREW_MINI_GAMES.direction_dash.label}
      instruction={phase === 'memorize' ? 'Nhớ hướng mũi tên!' : 'Bấm đúng hướng vừa thấy.'}
      flash={flash}
      blocked={blocked}
    >
      <div className="space-y-4">
        {phase === 'memorize' ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-6xl font-black text-brand-600 dark:text-brand-300">
              {CREW_DIRECTION_LABELS[instance.direction]}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {instance.buttonOrder.map((dir) => (
              <Button
                key={dir}
                type="button"
                variant={picked === dir ? 'primary' : 'secondary'}
                disabled={picked !== null || blocked > 0 || locked}
                className="min-h-14 text-3xl"
                onClick={() => {
                  setPicked(dir);
                  if (!onSubmit({ direction: dir })) {
                    window.setTimeout(() => setPicked(null), SPY_CREW_FEEDBACK_FAIL_MS);
                  }
                }}
              >
                {CREW_DIRECTION_LABELS[dir]}
              </Button>
            ))}
          </div>
        )}
      </div>
    </TaskShell>
  );
}


export const CREW_GAME_COMPONENTS = {
  tap_sequence: TapSequenceGame,
  odd_one_out: OddOneOutGame,
  timing_bar: TimingBarGame,
  wire_match: WireMatchGame,
  quick_count: QuickCountGame,
  number_sort: NumberSortGame,
  math_pick: MathPickGame,
  symbol_hunt: SymbolHuntGame,
  direction_dash: DirectionDashGame,
};
