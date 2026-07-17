import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Home, Search, Siren, UserX } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { Spinner } from '../../ui/components/Spinner.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { spyOutcomeLabel, spyStatusLabel, SPY_BLANK_VOTE_ID, SPY_CREW_FEEDBACK_FAIL_MS, SPY_CREW_FEEDBACK_SUCCESS_MS } from '../../lib/spyConstants.js';
import { CrewTaskPanel } from './CrewTaskPanel.jsx';
import { getErrorMessage } from '../../lib/firestore.js';
import {
  acknowledgeCrewSabotage,
  changeSpyVote,
  getCrewTaskTotalForStudent,
  getCurrentSpeaker,
  getTieDebateEndsAtMs,
  joinSpySession,
  reportCrewMeeting,
  sabotageCrewSystem,
  subscribeCrewTaskProgress,
  subscribeSpyParticipant,
  subscribeSpySession,
  subscribeSpyVote,
  submitCrewTaskProgress,
  submitSpyVote,
} from '../../services/spy.service.js';

function useCountdown(endsAtMs) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAtMs || endsAtMs <= Date.now()) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAtMs]);
  if (!endsAtMs || endsAtMs <= Date.now()) return 0;
  return Math.max(0, Math.ceil((endsAtMs - now) / 1000));
}

export function SpyStudentView({ sessionId, classCode, student, classStudents = [], onExit }) {
  const toast = useToast();
  const [session, setSession] = useState(null);
  const [self, setSelf] = useState(null);
  const [ownVote, setOwnVote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roleVisible, setRoleVisible] = useState(false);
  const [sabotageOpen, setSabotageOpen] = useState(false);
  const [sabotageBusy, setSabotageBusy] = useState(false);
  const [ackBusy, setAckBusy] = useState(false);
  const [wordVisible, setWordVisible] = useState(false);
  const [taskProgress, setTaskProgress] = useState(null);

  useEffect(() => {
    if (!sessionId) return undefined;
    setLoading(true);
    const unsub = subscribeSpySession(
      sessionId,
      (data) => {
        setSession(data);
        setLoading(false);
      },
      (err) => {
        toast.error(getErrorMessage(err));
        setLoading(false);
      },
    );
    return unsub;
  }, [sessionId, toast]);

  useEffect(() => {
    if (!sessionId || !student?.id) return undefined;
    return subscribeSpyParticipant(sessionId, student.id, setSelf, () => {});
  }, [sessionId, student?.id]);

  useEffect(() => {
    if (!sessionId || !student?.id) return undefined;
    return subscribeSpyVote(sessionId, student.id, setOwnVote, () => {});
  }, [sessionId, student?.id]);

  useEffect(() => {
    if (!sessionId || !student?.id || session?.mode !== 'crew') {
      setTaskProgress(null);
      return undefined;
    }
    return subscribeCrewTaskProgress(sessionId, (rows) => {
      setTaskProgress(rows.find((row) => row.id === student.id) || null);
    }, () => {});
  }, [sessionId, student?.id, session?.mode]);

  useEffect(() => {
    setWordVisible(false);
  }, [session?.status, self?.assignedWord]);

  useEffect(() => {
    if (session?.status === 'finished' && !loading) {
      const timer = setTimeout(() => onExit?.(), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [session?.status, loading, onExit]);

  const isPresent = useMemo(() => {
    if (!student?.id || !session) return true;
    const present = session.presentStudentIds || [];
    return present.includes(student.id);
  }, [student?.id, session]);

  useEffect(() => {
    if (!sessionId || !student?.id || session?.status !== 'lobby') return;
    if (!isPresent) return;
    setJoining(true);
    joinSpySession(sessionId, { studentId: student.id, studentName: student.fullName })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setJoining(false));
  }, [sessionId, student?.id, student?.fullName, session?.status, isPresent, toast]);

  const eliminated = useMemo(() => {
    if (self?.eliminated) return true;
    return (session?.eliminatedIds || []).includes(student?.id);
  }, [self?.eliminated, session?.eliminatedIds, student?.id]);

  const voted = Boolean(ownVote?.targetStudentId);
  const debateSeconds = useCountdown(getTieDebateEndsAtMs(session));
  const debateSpeakerId = getCurrentSpeaker(session);
  const debateSpeakerName = useMemo(() => {
    if (!debateSpeakerId) return '';
    return classStudents.find((s) => s.id === debateSpeakerId)?.fullName
      || (debateSpeakerId === student?.id ? student.fullName : debateSpeakerId);
  }, [debateSpeakerId, classStudents, student?.id, student?.fullName]);

  const voteTargets = useMemo(() => {
    const sourceIds = session?.activePlayerIds?.length
      ? session.activePlayerIds
      : (session?.presentStudentIds || []);
    if (!sourceIds.length) return [];
    const eliminatedIds = new Set(session.eliminatedIds || []);
    const nameById = new Map(classStudents.map((s) => [s.id, s.fullName]));
    return sourceIds
      .filter((id) => id !== student?.id && !eliminatedIds.has(id))
      .map((id) => ({ id, name: nameById.get(id) || id }));
  }, [session?.activePlayerIds, session?.presentStudentIds, session?.eliminatedIds, student?.id, classStudents]);

  const tieNames = useMemo(() => {
    const ids = session?.tieCandidateIds || [];
    const nameById = new Map(classStudents.map((s) => [s.id, s.fullName]));
    return ids.map((id) => nameById.get(id) || id);
  }, [session?.tieCandidateIds, classStudents]);

  const hasReported = (session?.reportedByIds || []).includes(student.id);
  const sabotageCooldownMs = session?.sabotageCooldownUntil?.toMillis?.() ?? 0;
  const sabotageCooldownLeft = useCountdown(sabotageCooldownMs);
  const completedCount = Number(taskProgress?.completedCount || 0);
  const taskTotal = getCrewTaskTotalForStudent(session, student?.id, taskProgress);

  const victimName = useMemo(() => {
    const id = session?.lastEliminatedId;
    if (!id) return '';
    return classStudents.find((s) => s.id === id)?.fullName
      || (id === student?.id ? student.fullName : id);
  }, [session?.lastEliminatedId, classStudents, student?.id, student?.fullName]);

  const handleVote = async (targetStudentId) => {
    if (submitting || eliminated) return;
    if (session?.status === 'vote' && voted) return;
    setSubmitting(true);
    try {
      if (session?.status === 'tie_revote') {
        await changeSpyVote(sessionId, { voterId: student.id, targetStudentId });
        toast.success('Đã đổi phiếu.');
      } else {
        await submitSpyVote(sessionId, { voterId: student.id, targetStudentId });
        toast.success(targetStudentId === SPY_BLANK_VOTE_ID ? 'Đã bỏ phiếu trắng.' : 'Đã bỏ phiếu.');
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCrewTaskComplete = useCallback(async (nextCompleted) => {
    const next = Number(nextCompleted) || completedCount + 1;
    try {
      await submitCrewTaskProgress(sessionId, {
        studentId: student.id,
        total: taskTotal,
        completedCount: next,
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, [sessionId, student.id, taskTotal, completedCount, toast]);

  const handleCrewTaskFeedback = useCallback((type) => {
    if (type === 'success') {
      toast.success('Đúng rồi!', SPY_CREW_FEEDBACK_SUCCESS_MS + 300);
    } else if (type === 'fail') {
      toast.error('Sai rồi — thử lại', SPY_CREW_FEEDBACK_FAIL_MS + 300);
    }
  }, [toast]);

  const handleAcknowledgeSabotage = useCallback(async () => {
    if (ackBusy) return;
    setAckBusy(true);
    try {
      await acknowledgeCrewSabotage(sessionId, { studentId: student.id });
    } catch (err) {
      toast.error(getErrorMessage(err));
      setAckBusy(false);
    }
  }, [ackBusy, sessionId, student.id, toast]);

  useEffect(() => {
    if (session?.status !== 'sabotage_alert') setAckBusy(false);
    if (session?.status !== 'playing') {
      setSabotageOpen(false);
      setSabotageBusy(false);
    }
  }, [session?.status]);

  if (loading || !session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner label="Đang tải phòng chơi..." />
      </div>
    );
  }

  if (!isPresent) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Truy tìm gián điệp</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{student.fullName}</p>
          </div>
          <Button type="button" variant="subtle" size="sm" onClick={onExit}>
            <Home className="h-4 w-4" />
            Thoát
          </Button>
        </div>
        <div className="card border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
          <UserX className="mx-auto h-10 w-10 text-amber-600 dark:text-amber-300" />
          <p className="mt-3 font-medium text-amber-900 dark:text-amber-100">
            Bạn không có mặt buổi này — không thể tham gia.
          </p>
          <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">
            Nhờ giáo viên tick điểm danh nếu bạn đang có mặt.
          </p>
        </div>
      </div>
    );
  }

  const isSpyRevealed = session.status === 'reveal' && session.revealedSpyIds?.includes(student.id);
  const revealedSpyNames = (session.revealedSpyIds || [])
    .map((id) => classStudents.find((s) => s.id === id)?.fullName || (id === student.id ? student.fullName : id))
    .filter(Boolean);
  const lastTieBreak = session.lastTieBreak;
  const showWordCard = (session.status === 'describe' || session.status === 'tie_debate' || session.status === 'tie_revote')
    && self?.assignedWord
    && !eliminated;
  const isCrewMode = session.mode === 'crew';

  return (
    <div className="space-y-5">
      {isCrewMode && session.status === 'sabotage_alert' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-950/90 px-4 backdrop-blur-sm">
          <div className="crew-sabotage-alert w-full max-w-md space-y-5 rounded-2xl border-2 border-red-400 bg-red-600 px-6 py-8 text-center text-white shadow-2xl">
            <Siren className="mx-auto h-12 w-12 animate-pulse" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-100">Cảnh báo khẩn</p>
              <h2 className="mt-2 text-2xl font-black leading-tight">
                Hệ thống đang bị xâm nhập!
              </h2>
              <p className="mt-3 text-base text-red-50">
                Thành viên bị loại:{' '}
                <strong className="text-white">{victimName || '—'}</strong>
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="min-h-12 w-full border-white/40 bg-white text-red-700 hover:bg-red-50"
              loading={ackBusy}
              onClick={handleAcknowledgeSabotage}
            >
              Vào họp khẩn — bỏ phiếu
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            {isCrewMode ? 'Phi hành đoàn' : 'Truy tìm gián điệp'}
          </p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{student.fullName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="brand">{spyStatusLabel(session.status)}</Badge>
          <Button type="button" variant="subtle" size="sm" onClick={onExit}>
            <Home className="h-4 w-4" />
            Thoát
          </Button>
        </div>
      </div>

      {eliminated && session.status !== 'reveal' && session.status !== 'finished' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          Bạn đã bị loại — chờ ván kết thúc.
        </div>
      )}

      {lastTieBreak?.pickedName && (session.status === 'describe' || session.status === 'playing' || session.status === 'reveal') && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          Hòa phiếu — đã bốc thăm loại <strong>{lastTieBreak.pickedName}</strong>
        </div>
      )}

      {session.status === 'lobby' && (
        <div className="card p-6 text-center">
          <Search className="mx-auto h-10 w-10 text-brand-500" />
          <p className="mt-3 font-medium text-slate-800 dark:text-slate-100">
            {joining ? 'Đang vào phòng...' : self ? 'Đã trong phòng' : 'Đang chờ vào phòng...'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {self
              ? (isCrewMode
                ? 'Chờ giáo viên bắt đầu — bạn sẽ nhận nhiệm vụ mini-game trên điện thoại.'
                : 'Chờ giáo viên bắt đầu ván — không cần thoát khi chơi ván tiếp theo.')
              : 'Chờ giáo viên mở phòng.'}
          </p>
          {isCrewMode && (
            <p className="mt-2 text-xs font-medium text-brand-600 dark:text-brand-300">
              Mode: Phi hành đoàn
            </p>
          )}
        </div>
      )}

      {isCrewMode && session.status === 'playing' && !eliminated && (
        <>
          <div className="card relative space-y-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-brand-600 dark:hover:text-brand-300"
                  onClick={() => setRoleVisible((v) => !v)}
                >
                  {roleVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  Vai trò
                </button>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {roleVisible ? (self?.isSpy ? 'Gián điệp' : 'Phi hành đoàn') : '••••••••'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="brand">{completedCount}/{taskTotal} nhiệm vụ</Badge>
              <Button
                type="button"
                variant="secondary"
                disabled={hasReported}
                onClick={async () => {
                  try {
                    await reportCrewMeeting(sessionId, { studentId: student.id });
                    toast.success('Đã Report — mở họp.');
                  } catch (err) {
                    toast.error(getErrorMessage(err));
                  }
                }}
              >
                Report {hasReported ? '(đã dùng)' : ''}
              </Button>
            </div>
            {roleVisible && self?.isSpy && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Phá hệ thống: loại ngẫu nhiên 1 người và mở họp khẩn (chờ 30–45s giữa mỗi lần).
              </p>
            )}
          </div>

          <CrewTaskPanel
            sessionId={sessionId}
            studentId={student.id}
            taskPerPlayer={taskTotal}
            completedCount={completedCount}
            onCompleteTask={handleCrewTaskComplete}
            onTaskFeedback={handleCrewTaskFeedback}
          />
        </>
      )}

      {showWordCard && (
        <button
          type="button"
          onClick={() => setWordVisible((v) => !v)}
          className="card w-full min-h-[12rem] border-2 border-brand-200 bg-gradient-to-br from-brand-50 to-violet-50 p-6 text-center transition active:scale-[0.99] hover:border-brand-300 dark:border-brand-500/30 dark:from-brand-500/10 dark:to-violet-500/10"
        >
          <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {wordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            Cụm từ của bạn
          </div>
          {wordVisible ? (
            <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white sm:text-4xl">
              {self.assignedWord}
            </p>
          ) : (
            <p className="mt-3 text-lg italic text-slate-500 dark:text-slate-400">
              Chạm để xem cụm từ
            </p>
          )}
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            Hãy mô tả cụm từ này bằng lời — không nói trực tiếp từ trên màn hình.
          </p>
        </button>
      )}

      {session.status === 'tie_debate' && !eliminated && (
        <div className="card space-y-2 border border-amber-200 bg-amber-50 p-5 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Hòa phiếu — đang biện luận
          </p>
          <p className="text-xl font-bold text-amber-950 dark:text-amber-50">
            {debateSpeakerName || '—'}
            {debateSpeakerId === student.id ? ' (bạn)' : ''}
          </p>
          {debateSeconds != null && (
            <p className="text-lg font-semibold text-amber-800 dark:text-amber-200">
              Còn {debateSeconds}s
            </p>
          )}
          {tieNames.length > 0 && (
            <p className="text-sm text-amber-800/90 dark:text-amber-200/90">
              Hòa giữa: {tieNames.join(', ')}
            </p>
          )}
        </div>
      )}

      {session.status === 'vote' && !eliminated && (
        <div className="space-y-3">
          {isCrewMode && session.meetingOpenedBy === 'sabotage' && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              Hệ thống bị phá — một thành viên đã bị loại. Họp khẩn để bỏ phiếu!
            </div>
          )}
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Chọn người nghi là gián điệp:
          </p>
          {voted ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              <CheckCircle2 className="h-4 w-4" />
              {ownVote?.targetStudentId === SPY_BLANK_VOTE_ID
                ? 'Đã bỏ phiếu trắng — chờ chốt vote.'
                : 'Đã gửi phiếu — chờ giáo viên chốt vote.'}
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              <li className="sm:col-span-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-12 w-full justify-start text-base"
                  disabled={submitting}
                  onClick={() => handleVote(SPY_BLANK_VOTE_ID)}
                >
                  Phiếu trắng — bỏ qua vòng vote
                </Button>
              </li>
              {voteTargets.map((target) => (
                <li key={target.id}>
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-12 w-full justify-start text-base"
                    disabled={submitting}
                    onClick={() => handleVote(target.id)}
                  >
                    <UserX className="h-4 w-4" />
                    {target.name}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {session.status === 'tie_revote' && !eliminated && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Có thể đổi phiếu sau biện luận:
          </p>
          {voted && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Phiếu hiện tại:{' '}
              <strong>
                {ownVote?.targetStudentId === SPY_BLANK_VOTE_ID
                  ? 'Phiếu trắng'
                  : voteTargets.find((t) => t.id === ownVote?.targetStudentId)?.name
                    || ownVote?.targetStudentId
                    || '—'}
              </strong>
            </div>
          )}
          <ul className="grid gap-2 sm:grid-cols-2">
            {voteTargets.map((target) => (
              <li key={target.id}>
                <Button
                  type="button"
                  variant={ownVote?.targetStudentId === target.id ? 'primary' : 'secondary'}
                  className="min-h-12 w-full justify-start text-base"
                  disabled={submitting || ownVote?.targetStudentId === target.id}
                  onClick={() => handleVote(target.id)}
                >
                  <UserX className="h-4 w-4" />
                  {target.name}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isCrewMode && self?.isSpy && !eliminated && session.status === 'playing' && (
        <div className="fixed bottom-5 right-4 z-20 flex flex-col items-end gap-2">
          {sabotageOpen && !sabotageBusy && (
            <div className="max-w-[11rem] rounded-xl border border-slate-200 bg-white/95 p-2 text-right text-xs text-slate-500 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-400">
              Bấm lần nữa để phá hệ thống
            </div>
          )}
          <button
            type="button"
            disabled={sabotageCooldownLeft > 0 || sabotageBusy || session.sabotageActive}
            className={`relative flex h-11 w-11 items-center justify-center rounded-full border shadow-sm backdrop-blur transition ${
              sabotageCooldownLeft > 0 || sabotageBusy
                ? 'border-amber-300/80 bg-amber-50/80 text-amber-600 opacity-90 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300'
                : 'border-emerald-300/80 bg-emerald-50/70 text-emerald-600 opacity-70 hover:opacity-100 hover:text-red-500 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
            }`}
            title={sabotageCooldownLeft > 0
              ? `Chờ ${sabotageCooldownLeft}s sau vote/phá`
              : sabotageBusy
                ? 'Đang phá hệ thống...'
                : 'Phá hệ thống — sẵn sàng'}
            onClick={async () => {
              if (sabotageCooldownLeft > 0 || sabotageBusy || session.sabotageActive) return;
              if (!sabotageOpen) {
                setSabotageOpen(true);
                return;
              }
              setSabotageBusy(true);
              setSabotageOpen(false);
              try {
                const result = await sabotageCrewSystem(sessionId, { spyId: student.id });
                if (result.outcome) {
                  toast.success('Đã phá hệ thống — ván kết thúc.');
                }
                // Không toast họp khẩn — mọi máy sẽ cùng hiện overlay đỏ từ Firestore.
              } catch (err) {
                setSabotageBusy(false);
                toast.error(getErrorMessage(err));
              }
            }}
          >
            <Siren className={`h-4 w-4 ${sabotageCooldownLeft > 0 || sabotageBusy ? 'opacity-30' : ''}`} />
            {sabotageCooldownLeft > 0 ? (
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums">
                {sabotageCooldownLeft}
              </span>
            ) : sabotageBusy ? (
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">...</span>
            ) : null}
          </button>
        </div>
      )}

      {session.status === 'reveal' && (
        <div className="card space-y-4 p-5">
          {session.outcome && (
            <p className="text-center text-lg font-bold text-emerald-700 dark:text-emerald-300">
              {spyOutcomeLabel(session.outcome, session.mode)}
            </p>
          )}
          {revealedSpyNames.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center dark:border-red-500/30 dark:bg-red-500/10">
              <p className="text-xs font-semibold text-red-700 dark:text-red-300">Gián điệp</p>
              <p className="mt-1 text-lg font-bold text-red-700 dark:text-red-200">
                {revealedSpyNames.join(', ')}
              </p>
            </div>
          )}
          {isSpyRevealed && (
            <p className="text-center text-sm font-medium text-red-600 dark:text-red-400">
              Bạn là gián điệp trong ván này.
            </p>
          )}
          {!isSpyRevealed && session.revealedSpyIds?.length > 0 && (
            <p className="text-center text-sm text-slate-600 dark:text-slate-300">
              Gián điệp đã được công bố trên màn hình lớp.
            </p>
          )}
        </div>
      )}

      {session.status === 'finished' && (
        <div className="card p-5 text-center text-sm text-slate-600 dark:text-slate-300">
          Phòng đã đóng. Đang chuyển về trang chính...
        </div>
      )}
    </div>
  );
}
