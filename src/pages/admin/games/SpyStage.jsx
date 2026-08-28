import { useEffect, useState } from 'react';
import { Badge } from '../../../ui/components/Badge.jsx';
import { spyOutcomeLabel, spyRoleLabel } from '../../../lib/spyConstants.js';
import {
  getActiveParticipants,
  getDescribeRoundTotal,
  getTieDebateSpeakerName,
} from '../../../services/spy.service.js';
import { SpyTieCountdown } from './SpyGmRoster.jsx';
import { SpyCrewMvpBoard } from './SpyCrewMvpBoard.jsx';

function useEndsInSeconds(endsAtField) {
  const endsAtMs = endsAtField?.toMillis?.() ?? 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAtMs) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [endsAtMs]);
  if (!endsAtMs) return null;
  return Math.max(0, Math.ceil((endsAtMs - now) / 1000));
}

export function SpyStage({
  session,
  participants = [],
  votes = [],
  tally = [],
  topCandidates = [],
  taskProgress = [],
  speakerName = '',
  civilianWord = '',
  spyWord = '',
  presenting = false,
  hideWords = false,
  spyNames = [],
}) {
  const resolveCountdown = useEndsInSeconds(session?.crewVoteResolveEndsAt);
  const announceCountdown = useEndsInSeconds(session?.crewEliminationAnnounceUntil);
  const skipCountdown = useEndsInSeconds(session?.crewSkipVoteAnnounceUntil);

  if (!session) return null;

  const eliminatedSet = new Set(session.eliminatedIds || []);
  const activeParticipants = getActiveParticipants(participants, session.eliminatedIds);
  const voteCount = votes.length;
  const activeCount = activeParticipants.length;
  const showWords = session.status === 'reveal' && !hideWords;
  const revealCivilian = session.civilianWord || civilianWord;
  const revealSpy = session.spyWord || spyWord;
  const describeRoundTotal = getDescribeRoundTotal(session);
  const lastEliminated = participants.find((p) => p.id === session.lastEliminatedId);
  const tieSpeakerName = getTieDebateSpeakerName(session, participants) || speakerName;
  const tieNames = (session.tieCandidateIds || [])
    .map((id) => participants.find((p) => p.id === id)?.studentName || id)
    .filter(Boolean);
  const topCandidateIds = new Set(
    (topCandidates.length
      ? topCandidates
      : tally.filter((row) => row.count === (tally[0]?.count ?? -1))
    ).map((row) => row.studentId),
  );
  const lastTieBreak = session.lastTieBreak;
  const showCrewElimination = session.mode === 'crew'
    && session.status === 'playing'
    && announceCountdown != null
    && announceCountdown > 0
    && lastEliminated;
  const showCrewSkipVote = session.mode === 'crew'
    && session.status === 'playing'
    && skipCountdown != null
    && skipCountdown > 0;
  const lastTieNames = (lastTieBreak?.candidateIds || [])
    .map((id) => participants.find((p) => p.id === id)?.studentName || id)
    .filter(Boolean);

  const titleClass = presenting
    ? 'text-4xl font-black text-white sm:text-5xl md:text-6xl'
    : 'text-2xl font-bold text-slate-900 dark:text-white';

  const subText = presenting ? 'text-slate-300' : 'text-sm text-slate-500';
  const accentText = presenting ? 'text-2xl text-amber-200' : 'text-lg font-medium text-amber-700 dark:text-amber-300';
  const progressById = new Map(taskProgress.map((row) => [row.id, row]));
  const crewCompletedFromProgress = participants
    .filter((p) => !p.isSpy)
    .reduce((sum, p) => sum + Number(progressById.get(p.id)?.completedCount || 0), 0);
  const crewTarget = Number(session.crewTaskTarget || 0);
  const crewCompleted = Math.max(
    Number(session.crewTeamCompleted || 0),
    crewCompletedFromProgress,
  );
  const crewPercent = crewTarget > 0 ? Math.min(100, Math.round((crewCompleted / crewTarget) * 100)) : 0;

  return (
    <div className={`space-y-6 text-center ${presenting ? 'py-6' : ''}`}>
      <div>
        <p className={`mb-2 text-xs font-semibold uppercase tracking-[0.2em] ${presenting ? 'text-brand-300' : 'text-slate-500'}`}>
          {session.mode === 'crew' ? 'Phi hành đoàn' : 'Truy tìm gián điệp'}
        </p>
        <h2 className={titleClass}>
          {session.status === 'describe' && 'Vòng mô tả'}
          {session.status === 'playing' && 'Đang làm nhiệm vụ'}
          {session.status === 'sabotage_alert' && 'Hệ thống bị xâm nhập'}
          {session.status === 'vote' && (session.mode === 'crew' ? 'Họp khẩn — bỏ phiếu' : 'Bỏ phiếu')}
          {session.status === 'tie_debate' && 'Biện luận hòa phiếu'}
          {session.status === 'tie_revote' && 'Đổi phiếu'}
          {session.status === 'reveal' && 'Kết quả'}
          {session.status === 'lobby' && 'Phòng chờ'}
        </h2>
      </div>

      {session.spyHintText && session.status !== 'lobby' && session.status !== 'reveal' && session.status !== 'finished' && (
        <div className={`mx-auto max-w-2xl rounded-2xl border px-4 py-4 ${
          presenting
            ? 'border-violet-400/40 bg-violet-950/50 text-violet-100'
            : 'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100'
        }`}
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em]">Manh mối gián điệp</p>
          <p className={presenting ? 'mt-2 text-xl' : 'mt-2 text-sm'}>{session.spyHintText}</p>
        </div>
      )}

      {session.status === 'sabotage_alert' && session.mode === 'crew' && (
        <div className={`crew-sabotage-alert mx-auto max-w-2xl space-y-4 rounded-3xl border-2 px-6 py-8 ${
          presenting
            ? 'border-red-400 bg-red-700 text-white shadow-[0_0_60px_rgba(220,38,38,0.45)]'
            : 'border-red-400 bg-red-600 text-white'
        }`}>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-100">Cảnh báo khẩn</p>
          <p className={presenting ? 'text-4xl font-black sm:text-5xl' : 'text-2xl font-black'}>
            Hệ thống đang bị xâm nhập!
          </p>
          <p className={presenting ? 'text-2xl text-red-50' : 'text-lg text-red-50'}>
            Thành viên bị loại:{' '}
            <strong className="text-white">{lastEliminated?.studentName || '—'}</strong>
          </p>
          <p className={presenting ? 'text-lg text-red-100' : 'text-sm text-red-100'}>
            Chờ giáo viên / học sinh bấm vào họp khẩn để bỏ phiếu
          </p>
        </div>
      )}

      {session.status === 'playing' && session.mode === 'crew' && (
        <div className="space-y-4">
          {showCrewSkipVote && (
            <div className={`mx-auto max-w-2xl rounded-2xl border px-4 py-4 ${
              presenting
                ? 'border-emerald-400/40 bg-emerald-950/50 text-emerald-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100'
            }`}>
              <p className="text-lg font-black">PHIẾU TRẮNG THẮNG</p>
              <p className={presenting ? 'mt-1 text-xl' : 'mt-1 text-sm'}>
                Không ai bị loại — tiếp tục nhiệm vụ sau {skipCountdown}s
              </p>
            </div>
          )}
          {showCrewElimination && (
            <div className={`mx-auto max-w-2xl rounded-2xl border px-4 py-4 ${
              presenting
                ? 'border-red-400/40 bg-red-950/50 text-red-100'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100'
            }`}>
              <p className="text-lg font-black">ĐÃ LOẠI: {lastEliminated.studentName?.toUpperCase()}</p>
              <p className={presenting ? 'mt-1 text-xl' : 'mt-1 text-sm'}>
                Quay lại nhiệm vụ sau {announceCountdown}s
              </p>
            </div>
          )}
          {!showCrewElimination && !showCrewSkipVote && (
            <div className="mx-auto max-w-xl space-y-4">
              <div className="space-y-2">
                <p className={accentText}>Tiến độ đội: {crewPercent}%</p>
                <div className={`h-4 overflow-hidden rounded-full ${presenting ? 'bg-slate-800' : 'bg-slate-200 dark:bg-slate-800'}`}>
                  <div className="h-full bg-emerald-500" style={{ width: `${crewPercent}%` }} />
                </div>
                <p className={subText}>
                  {crewCompleted}/{crewTarget} nhiệm vụ nhóm · {activeParticipants.length} người còn sống
                </p>
              </div>
              <SpyCrewMvpBoard
                session={session}
                participants={participants}
                taskProgress={taskProgress}
                presenting={presenting}
                limit={presenting ? 5 : 3}
              />
            </div>
          )}
        </div>
      )}

      {session.status === 'lobby' && (
        <p className={presenting ? 'text-xl text-slate-200' : 'text-slate-600 dark:text-slate-300'}>
          {participants.length} / {session.presentStudentIds.length} học sinh đã vào phòng
        </p>
      )}

      {session.status === 'describe' && (
        <div className="space-y-3">
          <p className={accentText}>
            Lượt mô tả: {speakerName || '—'}
          </p>
          <p className={subText}>
            Vòng mô tả {session.describeRoundCurrent} / {describeRoundTotal}
            {' · '}
            Lượt {(session.describeIndex ?? 0) + 1} / {session.describeOrder?.length || 0}
          </p>
          {session.voteRound > 0 && (
            <p className={subText}>Sau vòng vote {session.voteRound}</p>
          )}
          <p className={presenting ? 'text-lg text-slate-300' : subText}>
            Mô tả bằng lời — không nói trực tiếp cụm từ trên màn hình
          </p>
          {session.describeRoundCurrent >= describeRoundTotal
            && (session.describeIndex ?? 0) >= (session.describeOrder?.length || 1) - 1 && (
            <p className={presenting ? 'text-xl text-brand-200' : 'text-sm font-medium text-brand-600 dark:text-brand-300'}>
              Đã hết lượt mô tả — chờ giáo viên mở bỏ phiếu
            </p>
          )}
        </div>
      )}

      {session.status === 'vote' && (
        <div className="space-y-2">
          {session.mode === 'crew' && session.meetingOpenedBy === 'sabotage' && (
            <div className={`mx-auto max-w-2xl rounded-2xl border px-4 py-3 ${
              presenting
                ? 'border-red-400/40 bg-red-950/50 text-red-100'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100'
            }`}>
              <p className="text-lg font-black">HỆ THỐNG BỊ PHÁ — HỌP KHẨN</p>
              {lastEliminated && (
                <p className={presenting ? 'mt-1 text-xl' : 'mt-1 text-sm'}>
                  Nạn nhân ngẫu nhiên: {lastEliminated.studentName}
                </p>
              )}
            </div>
          )}
          <p className={presenting ? 'text-xl text-slate-200' : 'text-slate-600 dark:text-slate-300'}>
            Vote vòng {session.voteRound || 1}
          </p>
          <p className={presenting ? 'text-lg text-slate-300' : subText}>
            Đã vote: {voteCount} / {activeCount}
          </p>
          {session.mode === 'crew' && resolveCountdown != null && resolveCountdown > 0 && voteCount >= activeCount && (
            <p className={presenting ? 'text-3xl font-black text-amber-200' : 'text-lg font-bold text-amber-700 dark:text-amber-300'}>
              Chốt vote sau {resolveCountdown}s
            </p>
          )}
          {lastEliminated && session.lastEliminatedId && (
            <p className={presenting ? 'text-red-300' : 'text-sm text-red-600 dark:text-red-400'}>
              Vừa loại: {lastEliminated.studentName}
            </p>
          )}
        </div>
      )}

      {session.status === 'tie_debate' && (
        <div className="space-y-3">
          <p className={accentText}>
            Đang biện luận: {tieSpeakerName || '—'}
          </p>
          <SpyTieCountdown
            session={session}
            className={presenting ? 'text-2xl text-amber-100' : 'text-lg font-semibold text-amber-700 dark:text-amber-300'}
          />
          {tieNames.length > 0 && (
            <p className={presenting ? 'text-lg text-slate-300' : subText}>
              Hòa phiếu: {tieNames.join(', ')}
            </p>
          )}
          <p className={presenting ? 'text-lg text-slate-300' : subText}>
            Mỗi người 1 phút tự biện luận — sau đó có thể đổi phiếu
          </p>
        </div>
      )}

      {session.status === 'tie_revote' && (
        <div className="space-y-2">
          <p className={presenting ? 'text-xl text-amber-200' : accentText}>
            Có thể đổi phiếu sau biện luận
          </p>
          {tieNames.length > 0 && (
            <p className={presenting ? 'text-lg text-slate-300' : subText}>
              Hòa giữa: {tieNames.join(', ')}
            </p>
          )}
          <p className={presenting ? 'text-lg text-slate-300' : subText}>
            Đã vote: {voteCount} / {activeCount}
          </p>
        </div>
      )}

      {(session.status === 'vote' || session.status === 'tie_revote' || session.status === 'reveal') && tally.length > 0 && (
        <ul className="mx-auto max-w-md space-y-2 text-left">
          {tally.map((row) => {
            const isEliminated = eliminatedSet.has(row.studentId);
            const isSpy = participants.find((p) => p.id === row.studentId)?.isSpy;
            const isTiedTop = session.status !== 'reveal' && topCandidateIds.has(row.studentId) && topCandidateIds.size > 1;
            return (
              <li
                key={row.studentId}
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  presenting ? 'bg-slate-800/60 text-white' : 'bg-slate-100 dark:bg-slate-800'
                } ${isEliminated ? 'ring-2 ring-red-500/60' : ''} ${session.status === 'reveal' && isSpy ? 'ring-2 ring-amber-500/60' : ''} ${isTiedTop ? 'ring-2 ring-amber-400/70' : ''}`}
              >
                <span>
                  {row.studentName}
                  {isTiedTop && (
                    <span className="ml-2 text-xs text-amber-500">(hòa)</span>
                  )}
                  {isEliminated && session.status === 'reveal' && (
                    <span className="ml-2 text-xs text-red-400">(đã loại)</span>
                  )}
                </span>
                <Badge tone="slate">{row.count} phiếu</Badge>
              </li>
            );
          })}
        </ul>
      )}

      {lastTieBreak?.pickedName && (session.status === 'describe' || session.status === 'playing' || session.status === 'reveal') && (
        <div className={`mx-auto max-w-xl rounded-xl border px-4 py-3 ${
          presenting
            ? 'border-amber-400/40 bg-amber-950/40 text-amber-100'
            : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
        }`}
        >
          <p className="font-semibold">
            Hòa phiếu{lastTieNames.length ? ` giữa ${lastTieNames.join(', ')}` : ''}
            {' — '}đã bốc thăm loại <strong>{lastTieBreak.pickedName}</strong>
          </p>
        </div>
      )}

      {session.status === 'reveal' && session.outcome && (
        <p className={`font-black ${presenting ? 'text-4xl text-emerald-300' : 'text-2xl text-emerald-600 dark:text-emerald-400'}`}>
          {spyOutcomeLabel(session.outcome, session.mode)}
        </p>
      )}

      {session.status === 'reveal' && spyNames.length > 0 && (
        <p className={`text-center font-semibold ${presenting ? 'text-2xl text-red-300' : 'text-red-600 dark:text-red-400'}`}>
          Gián điệp: {spyNames.join(', ')}
        </p>
      )}

      {session.status === 'reveal' && showWords && (
        <div className="mx-auto max-w-xl space-y-4">
          <div className={`rounded-2xl border p-4 ${presenting ? 'border-emerald-500/40 bg-emerald-950/40' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
              {spyRoleLabel(session.mode, false)}
            </p>
            <p className={`mt-1 font-bold ${presenting ? 'text-3xl text-white' : 'text-xl'}`}>{revealCivilian}</p>
          </div>
          <div className={`rounded-2xl border p-4 ${presenting ? 'border-red-500/40 bg-red-950/40' : 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-300">{spyRoleLabel(session.mode, true)}</p>
            <p className={`mt-1 font-bold ${presenting ? 'text-3xl text-white' : 'text-xl'}`}>{revealSpy}</p>
          </div>
          {(session.eliminatedIds || []).length > 0 && (
            <div className={presenting ? 'text-slate-300' : 'text-sm text-slate-600 dark:text-slate-400'}>
              <p className="font-semibold">Thứ tự loại:</p>
              <ol className="mt-1 list-inside list-decimal">
                {(session.eliminatedIds || []).map((id) => {
                  const name = participants.find((p) => p.id === id)?.studentName || id;
                  return <li key={id}>{name}</li>;
                })}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
