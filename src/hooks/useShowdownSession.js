import { useEffect, useState } from 'react';
import {
  resolveQuestionDeadlineMs,
  subscribeShowdownParticipants,
  subscribeShowdownResponses,
  subscribeShowdownSession,
  syncShowdownClassPointer,
} from '../services/showdown.service.js';

export function useShowdownSession(sessionId, { onSessionError, syncClassPointer = true } = {}) {
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [responses, setResponses] = useState([]);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(Boolean(sessionId));

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return subscribeShowdownSession(
      sessionId,
      (data) => {
        setSession(data);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        onSessionError?.(err);
      },
    );
  }, [sessionId, onSessionError]);

  useEffect(() => {
    if (!sessionId) {
      setParticipants([]);
      return undefined;
    }
    return subscribeShowdownParticipants(sessionId, setParticipants, () => {});
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setResponses([]);
      return undefined;
    }
    return subscribeShowdownResponses(sessionId, setResponses, () => {});
  }, [sessionId]);

  useEffect(() => {
    const end = resolveQuestionDeadlineMs(session);
    if (session?.status !== 'playing' || !end) {
      setCountdown(0);
      return undefined;
    }
    const tick = () => setCountdown(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [session?.status, session?.serverStartedAt, session?.questionDeadlineAt, session?.questionDurationSeconds]);

  useEffect(() => {
    if (!syncClassPointer || !sessionId || !session?.status) return;
    syncShowdownClassPointer(sessionId).catch(() => {});
  }, [sessionId, session?.status, syncClassPointer]);

  return {
    session,
    participants,
    responses,
    countdown,
    loading,
    setSession,
  };
}
