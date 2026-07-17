import { useEffect, useMemo, useState } from 'react';
import {
  getActiveParticipants,
  getCurrentSpeaker,
  getSpySessionResults,
  subscribeSpyParticipants,
  subscribeSpyParticipantsByIds,
  subscribeCrewTaskProgress,
  subscribeSpySession,
  subscribeSpyVotes,
  syncSpyClassPointer,
  tallySpyVotes,
} from '../services/spy.service.js';

export function useSpySession(
  sessionId,
  {
    syncClassPointer = true,
    loadReveal = true,
    watchStudentIds = null,
    onParticipantsError,
  } = {},
) {
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [votes, setVotes] = useState([]);
  const [taskProgress, setTaskProgress] = useState([]);
  const [revealData, setRevealData] = useState(null);
  const [loading, setLoading] = useState(Boolean(sessionId));

  const watchIdsKey = Array.isArray(watchStudentIds)
    ? [...watchStudentIds].filter(Boolean).sort().join('|')
    : '';

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return subscribeSpySession(
      sessionId,
      (data) => {
        setSession(data);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setParticipants([]);
      return undefined;
    }

    const handleError = (err) => {
      onParticipantsError?.(err);
    };

    const idsFromProp = watchIdsKey ? watchIdsKey.split('|').filter(Boolean) : null;
    const idsFromSession = Array.isArray(session?.presentStudentIds)
      ? session.presentStudentIds
      : [];
    const ids = idsFromProp?.length ? idsFromProp : idsFromSession;

    if (ids.length) {
      return subscribeSpyParticipantsByIds(sessionId, ids, setParticipants, handleError);
    }

    // Chưa có roster ids: thử list (admin). Khi session load xong effect chạy lại.
    if (!session) return undefined;

    return subscribeSpyParticipants(sessionId, setParticipants, handleError);
  }, [
    sessionId,
    watchIdsKey,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- compare by joined ids
    (session?.presentStudentIds || []).join('|'),
    session,
    onParticipantsError,
  ]);

  useEffect(() => {
    if (!sessionId) {
      setVotes([]);
      return undefined;
    }
    return subscribeSpyVotes(sessionId, setVotes, () => {});
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setTaskProgress([]);
      return undefined;
    }
    if (session?.mode !== 'crew') {
      setTaskProgress([]);
      return undefined;
    }
    return subscribeCrewTaskProgress(sessionId, setTaskProgress, () => {});
  }, [sessionId, session?.mode]);

  useEffect(() => {
    if (!syncClassPointer || !sessionId || !session?.status) return;
    syncSpyClassPointer(sessionId).catch(() => {});
  }, [sessionId, session?.status, syncClassPointer]);

  useEffect(() => {
    if (!loadReveal || session?.status !== 'reveal' || !sessionId) {
      setRevealData(null);
      return;
    }
    getSpySessionResults(sessionId).then(setRevealData).catch(() => {});
  }, [session?.status, sessionId, loadReveal]);

  const speakerId = getCurrentSpeaker(session);
  const speakerName = participants.find((p) => p.id === speakerId)?.studentName || '';
  const tally = useMemo(() => {
    const { tally: rows, topCandidates: tops, topCount } = tallySpyVotes(
      votes,
      participants,
      session?.eliminatedIds,
    );
    return { rows, topCandidates: tops, topCount };
  }, [votes, participants, session?.eliminatedIds]);
  const activeParticipants = useMemo(
    () => getActiveParticipants(participants, session?.eliminatedIds),
    [participants, session?.eliminatedIds],
  );
  const spyNames = useMemo(() => {
    if (session?.status === 'reveal' && revealData?.spies) {
      return revealData.spies.map((p) => p.studentName);
    }
    return [];
  }, [session?.status, revealData]);

  return {
    session,
    participants,
    votes,
    taskProgress,
    revealData,
    tally: tally.rows,
    topCandidates: tally.topCandidates,
    topCount: tally.topCount,
    activeParticipants,
    speakerId,
    speakerName,
    spyNames,
    loading,
  };
}
