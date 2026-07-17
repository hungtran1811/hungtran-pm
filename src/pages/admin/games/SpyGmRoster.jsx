import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../ui/components/Badge.jsx';
import { getCurrentSpeaker, getTieDebateEndsAtMs } from '../../../services/spy.service.js';

function useCountdown(endsAtMs) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAtMs) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAtMs]);
  if (!endsAtMs) return null;
  return Math.max(0, Math.ceil((endsAtMs - now) / 1000));
}

export function SpyGmRoster({
  session,
  presentStudents = [],
  participants = [],
  votes = [],
  tally = [],
  taskProgress = [],
  speakerId = null,
}) {
  const participantById = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants],
  );
  const voteByVoter = useMemo(
    () => new Map(votes.map((v) => [v.voterId || v.id, v])),
    [votes],
  );
  const votesAgainst = useMemo(() => {
    const map = new Map();
    for (const row of tally) {
      map.set(row.studentId, row.count);
    }
    return map;
  }, [tally]);
  const progressById = useMemo(
    () => new Map(taskProgress.map((row) => [row.id, row])),
    [taskProgress],
  );

  const eliminatedSet = new Set(session?.eliminatedIds || []);
  const status = session?.status;
  const debateSpeakerId = status === 'tie_debate'
    ? (session?.tieCandidateIds?.[session?.tieDebateIndex] || null)
    : null;
  const activeSpeakerId = speakerId || debateSpeakerId || getCurrentSpeaker(session);
  const showVoteStatus = status === 'vote' || status === 'tie_revote';
  const showVoteCount = status === 'vote' || status === 'tie_revote' || status === 'reveal';
  const showRoles = Boolean(session?.startedAt) || ['describe', 'playing', 'vote', 'tie_debate', 'tie_revote', 'reveal'].includes(status);

  const rows = useMemo(() => {
    const present = presentStudents.length
      ? presentStudents
      : participants.map((p) => ({ id: p.id, fullName: p.studentName }));
    return present.map((s) => {
      const part = participantById.get(s.id);
      return {
        id: s.id,
        name: part?.studentName || s.fullName || s.id,
        joined: Boolean(part),
        part,
      };
    });
  }, [presentStudents, participants, participantById]);

  if (!session) return null;

  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Thẻ học sinh (quản trò)
        </p>
        <p className="text-xs text-slate-500">
          Chỉ giáo viên thấy vai trò / từ khóa
        </p>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((row) => {
          const eliminated = eliminatedSet.has(row.id) || row.part?.eliminated;
          const isSpeaker = activeSpeakerId === row.id;
          const vote = voteByVoter.get(row.id);
          const against = votesAgainst.get(row.id) || 0;
          const isTieCandidate = (session.tieCandidateIds || []).includes(row.id);
          const progress = progressById.get(row.id);

          return (
            <div
              key={row.id}
              className={`rounded-xl border p-3 text-left shadow-sm ${
                eliminated
                  ? 'border-red-300/70 bg-red-50/80 opacity-80 dark:border-red-500/40 dark:bg-red-500/10'
                  : isSpeaker
                    ? 'border-amber-400 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40'
              }`}
            >
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {row.name}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {status === 'lobby' && (
                  <Badge tone={row.joined ? 'brand' : 'slate'}>
                    {row.joined ? 'Trong phòng' : 'Chưa vào'}
                  </Badge>
                )}
                {isSpeaker && (status === 'describe' || status === 'tie_debate') && (
                  <Badge tone="amber">Đang nói</Badge>
                )}
                {isTieCandidate && (status === 'tie_debate' || status === 'tie_revote') && (
                  <Badge tone="amber">Hòa phiếu</Badge>
                )}
                {showVoteStatus && row.joined && !eliminated && (
                  <Badge tone={vote ? 'brand' : 'slate'}>
                    {vote ? 'Đã vote' : 'Chưa vote'}
                  </Badge>
                )}
                {eliminated && <Badge tone="red">Đã loại</Badge>}
                {showRoles && row.part && (
                  <Badge tone={row.part.isSpy ? 'red' : 'slate'}>
                    {row.part.isSpy
                      ? 'Gián điệp'
                      : (session?.mode === 'crew' ? 'Phi hành đoàn' : 'Dân')}
                  </Badge>
                )}
              </div>
              {showRoles && row.part?.assignedWord && (
                <p className="mt-2 truncate text-xs text-slate-500 dark:text-slate-400">
                  Từ: <span className="font-medium text-slate-700 dark:text-slate-200">{row.part.assignedWord}</span>
                </p>
              )}
              {showVoteCount && against > 0 && (
                <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {against} phiếu nhận
                </p>
              )}
              {session.mode === 'crew' && progress && (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Nhiệm vụ: {progress.completedCount}/{progress.total}
                </p>
              )}
              {session.mode === 'crew' && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {session.reportedByIds?.includes(row.id) ? 'Đã Report' : 'Còn Report'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SpyTieCountdown({ session, className = '' }) {
  const endsAtMs = getTieDebateEndsAtMs(session);
  const seconds = useCountdown(endsAtMs);
  if (seconds == null) return null;
  return (
    <p className={className}>
      Còn <strong>{seconds}s</strong>
    </p>
  );
}
