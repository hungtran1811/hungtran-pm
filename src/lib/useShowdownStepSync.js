import { useEffect, useRef, useState } from 'react';
import {
  getShowdownStepKey,
  getShowdownSyncMessage,
  isShowdownStepReady,
  SHOWDOWN_SETTLE_MS,
} from './showdownSync.js';

const FAILSAFE_MS = 8000;

/**
 * Shows a syncing overlay while the session step is settling after a state change.
 * Used on presentation, student, and teacher preview screens.
 */
export function useShowdownStepSync(session) {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('Đang đồng bộ với lớp…');
  const prevSessionRef = useRef(null);
  const prevKeyRef = useRef(null);

  useEffect(() => {
    if (!session) {
      setSyncing(false);
      prevSessionRef.current = null;
      prevKeyRef.current = null;
      return;
    }

    const key = getShowdownStepKey(session);
    const prevSession = prevSessionRef.current;
    const prevKey = prevKeyRef.current;

    if (prevKey !== null && prevKey !== key) {
      setSyncing(true);
      setSyncMessage(getShowdownSyncMessage(session, prevSession));
    }

    prevSessionRef.current = session;
    prevKeyRef.current = key;
  }, [session]);

  useEffect(() => {
    if (!syncing || !session) return undefined;

    let settleTimer;
    const failTimer = setTimeout(() => setSyncing(false), FAILSAFE_MS);

    const trySettle = () => {
      if (isShowdownStepReady(session)) {
        settleTimer = setTimeout(() => {
          setSyncing(false);
          clearTimeout(failTimer);
        }, SHOWDOWN_SETTLE_MS);
      }
    };

    trySettle();

    return () => {
      clearTimeout(failTimer);
      clearTimeout(settleTimer);
    };
  }, [
    syncing,
    session,
    session?.stateVersion,
    session?.status,
    session?.serverStartedAt,
    session?.revealedAnswer,
    session?.finishStage,
    session?.finishQuestion,
  ]);

  return { syncing, syncMessage };
}
