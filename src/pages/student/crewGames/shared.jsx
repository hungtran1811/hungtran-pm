import { useCallback, useEffect, useRef, useState } from 'react';
import { validateCrewTask } from '../../../lib/crewTasks.js';
import {
  SPY_CREW_FEEDBACK_FAIL_MS,
  SPY_CREW_FEEDBACK_SUCCESS_MS,
  SPY_CREW_TASK_FAIL_COOLDOWN_MAX_SECONDS,
  SPY_CREW_TASK_FAIL_COOLDOWN_MIN_SECONDS,
} from '../../../lib/spyConstants.js';

export const WIRE_COLORS = {
  red: 'bg-red-500 border-red-600',
  blue: 'bg-blue-500 border-blue-600',
  yellow: 'bg-amber-400 border-amber-500',
};

export function randomFailCooldownMs() {
  const span = SPY_CREW_TASK_FAIL_COOLDOWN_MAX_SECONDS - SPY_CREW_TASK_FAIL_COOLDOWN_MIN_SECONDS + 1;
  const seconds = SPY_CREW_TASK_FAIL_COOLDOWN_MIN_SECONDS + Math.floor(Math.random() * span);
  return seconds * 1000;
}

export function useCooldownLeft(endsAtMs) {
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

export function TaskShell({ title, instruction, children, footer, flash, blocked }) {
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

export function useTaskFeedback({ onSuccess, onFail, onFlash }) {
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

