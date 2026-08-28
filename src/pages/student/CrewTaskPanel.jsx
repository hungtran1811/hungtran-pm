import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../../ui/components/Badge.jsx';
import { CREW_MINI_GAMES } from '../../data/crewMiniGames.js';
import { assignCrewTasks, buildTaskInstance } from '../../lib/crewTasks.js';
import { SPY_CREW_GAME_SWITCH_MS } from '../../lib/spyConstants.js';
import {
  CREW_GAME_COMPONENTS,
  randomFailCooldownMs,
  useCooldownLeft,
  useTaskFeedback,
} from './crewGames/index.js';

export function CrewTaskPanel({
  sessionId,
  studentId,
  completedCount = 0,
  onCompleteTask,
  onTaskFeedback,
}) {
  const TASK_BUFFER = 20;
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
  const taskPoolSize = Math.max(effectiveCompleted + TASK_BUFFER, TASK_BUFFER);
  const tasks = useMemo(
    () => assignCrewTasks({ sessionId, studentId, count: taskPoolSize }),
    [sessionId, studentId, taskPoolSize],
  );

  useEffect(() => {
    setPlayIndex((prev) => (prev < effectiveCompleted ? effectiveCompleted : prev));
  }, [effectiveCompleted]);

  useEffect(() => () => {
    if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current);
  }, []);

  const currentTask = tasks[playIndex];
  const instance = useMemo(
    () => (currentTask ? buildTaskInstance(currentTask.taskId, currentTask.instanceSeed) : null),
    [currentTask?.taskId, currentTask?.instanceSeed],
  );
  const remainingTasks = tasks.slice(effectiveCompleted, effectiveCompleted + 5);

  const requestSwitch = useCallback((nextIndex) => {
    if (nextIndex < effectiveCompleted || nextIndex === playIndex) return;
    if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current);
    setSwitchingUntil(Date.now() + SPY_CREW_GAME_SWITCH_MS);
    switchTimerRef.current = window.setTimeout(() => {
      setPlayIndex(nextIndex);
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
    if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current);
    setSwitchingUntil(Date.now() + SPY_CREW_GAME_SWITCH_MS);
    switchTimerRef.current = window.setTimeout(() => {
      setPlayIndex(nextCompleted);
      setSwitchingUntil(0);
    }, SPY_CREW_GAME_SWITCH_MS);
    onCompleteTask?.(nextCompleted);
  }, [effectiveCompleted, onCompleteTask]);

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

  if (!currentTask || !instance) return null;

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Badge tone="brand">Đóng góp: {effectiveCompleted}</Badge>
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
  const gameKey = `${playIndex}-${currentTask.taskId}-${currentTask.instanceSeed}-${failCooldownLeft > 0 ? 'wait' : 'play'}`;
  const GameComponent = CREW_GAME_COMPONENTS[currentTask.taskId];

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
        {GameComponent ? <GameComponent {...gameProps} /> : null}
        {footer}
      </div>
    </div>
  );
}
