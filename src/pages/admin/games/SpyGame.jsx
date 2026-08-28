import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Copy,
  ExternalLink,
  Monitor,
  Play,
  RotateCcw,
  Search,
  SkipForward,
  Users,
  Vote,
} from 'lucide-react';
import { Button } from '../../../ui/components/Button.jsx';
import { Badge } from '../../../ui/components/Badge.jsx';
import { EmptyState } from '../../../ui/components/EmptyState.jsx';
import { Field, Input, Select } from '../../../ui/components/Field.jsx';
import { SelectClassPrompt, LoadingCatState } from '../../../ui/components/WaitingCatIllustration.jsx';
import { useToast } from '../../../ui/components/Toast.jsx';
import { maxSpyCount } from '../../../lib/minigameAttendance.js';
import { SPY_MODES, spyStatusLabel, spyOutcomeLabel } from '../../../lib/spyConstants.js';
import {
  getCategoryPairs,
  pickRandomPair,
  SPY_WORD_CATEGORIES,
  validateWordPair,
} from '../../../data/spyWordBank.js';
import { getErrorMessage } from '../../../lib/firestore.js';
import { useSpySession } from '../../../hooks/useSpySession.js';
import {
  adminSkipCrewVoteRound,
  advanceSpyDescribe,
  advanceTieDebate,
  acknowledgeCrewSabotage,
  completeCrewGame,
  createSpySession,
  finishSpySession,
  getSpyPortalLink,
  getSpyPresentLink,
  isSpyLobbyRosterReady,
  openSpyMeeting,
  openSpyLobby,
  openSpyVote,
  resolveSpyVoteRound,
  resolveTieRevote,
  restartSpyRound,
  checkCrewTaskWin,
  startCrewGame,
  startSpyGame,
  syncSpyPresentRosterToJoined,
  updateSpyPresentRoster,
} from '../../../services/spy.service.js';
import { SpyStage } from './SpyStage.jsx';
import { SpyGmRoster, SpyTieCountdown } from './SpyGmRoster.jsx';
import { SpyWordPicker } from './SpyWordPicker.jsx';


export function SpyGame({
  selectedClass = '',
  students = [],
  presentStudents = [],
  presentStudentIds,
  loadingStudents = false,
  loadError = '',
}) {
  const toast = useToast();
  const [sessionId, setSessionId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [wordMode, setWordMode] = useState('bank');
  const [categoryId, setCategoryId] = useState(SPY_WORD_CATEGORIES[0].id);
  const [pairIndex, setPairIndex] = useState(0);
  const [civilianWord, setCivilianWord] = useState('');
  const [spyWord, setSpyWord] = useState('');
  const [impostorCount, setImpostorCount] = useState(1);
  const [describeRoundTotal, setDescribeRoundTotal] = useState(1);
  const [gameMode, setGameMode] = useState('word');
  const [crewTaskTarget, setCrewTaskTarget] = useState(15);

  const presentIds = useMemo(() => [...(presentStudentIds || [])], [presentStudentIds]);

  const onParticipantsError = useCallback((err) => {
    toast.error(getErrorMessage(err) || 'Không tải được danh sách học sinh trong phòng.');
  }, [toast]);

  const {
    session,
    participants,
    votes,
    tally,
    topCandidates,
    taskProgress,
    activeParticipants,
    speakerId,
    speakerName,
    spyNames,
  } = useSpySession(sessionId, {
    watchStudentIds: presentIds,
    onParticipantsError,
  });

  const maxSpies = maxSpyCount(presentStudents.length);
  const categoryPairs = useMemo(() => getCategoryPairs(categoryId), [categoryId]);

  useEffect(() => {
    if (maxSpies > 0 && impostorCount > maxSpies) setImpostorCount(maxSpies);
    if (impostorCount < 1) setImpostorCount(1);
  }, [maxSpies, impostorCount]);

  useEffect(() => {
    const picked = pickRandomPair(categoryId);
    setPairIndex(0);
    setCivilianWord(picked.pair.civilian);
    setSpyWord(picked.pair.spy);
  }, [categoryId]);

  useEffect(() => {
    if (wordMode === 'bank' && categoryPairs[pairIndex]) {
      setCivilianWord(categoryPairs[pairIndex].civilian);
      setSpyWord(categoryPairs[pairIndex].spy);
    }
  }, [wordMode, categoryId, pairIndex, categoryPairs]);

  useEffect(() => {
    if (!sessionId || session?.mode !== 'crew' || session?.status !== 'vote') return undefined;
    const endsAt = session.crewVoteResolveEndsAt?.toMillis?.() ?? 0;
    if (!endsAt) return undefined;
    const delay = Math.max(0, endsAt - Date.now());
    const timer = setTimeout(() => {
      resolveSpyVoteRound(sessionId).catch(() => {});
    }, delay);
    return () => clearTimeout(timer);
  }, [sessionId, session?.mode, session?.status, session?.crewVoteResolveEndsAt]);

  const portalLink = sessionId && selectedClass ? getSpyPortalLink(selectedClass, sessionId) : '';
  const presentLink = sessionId ? getSpyPresentLink(sessionId) : '';

  const runAction = useCallback(async (fn, successMsg) => {
    setBusy(true);
    try {
      const result = await fn();
      const msg = typeof successMsg === 'function' ? successMsg(result) : successMsg;
      if (msg) toast.success(msg);
      return result;
    } catch (error) {
      toast.error(getErrorMessage(error));
      return null;
    } finally {
      setBusy(false);
    }
  }, [toast]);

  const formatEliminateResult = (result) => {
    if (!result) return '';
    if (result.skipped) return 'Phiếu trắng thắng — tiếp tục nhiệm vụ';
    if (result.phase === 'tie_debate') {
      return 'Hòa phiếu — bắt đầu biện luận (mỗi người 1 phút)';
    }
    if (result.lastTieBreak?.pickedName) {
      const names = (result.lastTieBreak.candidateIds || [])
        .map((id) => participants.find((p) => p.id === id)?.studentName || id)
        .join(', ');
      return `Hòa phiếu${names ? ` giữa ${names}` : ''} — đã bốc thăm loại ${result.lastTieBreak.pickedName}`;
    }
    if (result.eliminatedName) {
      return `Đã loại ${result.eliminatedName}`;
    }
    return 'Đã chốt vote và loại người';
  };
  const isCrewSession = session?.mode === 'crew';
  const crewReady = isCrewSession && checkCrewTaskWin(session, participants, taskProgress);
  const sessionPresentIds = session?.presentStudentIds || [];
  const sessionPresentCount = sessionPresentIds.length;
  const lobbyRosterReady = Boolean(
    session
    && isSpyLobbyRosterReady(
      participants.map((p) => p.id),
      sessionPresentIds,
    ),
  );
  const missingJoiners = useMemo(() => {
    if (!session) return [];
    const joined = new Set(participants.map((p) => p.id));
    const nameById = new Map([
      ...presentStudents.map((s) => [s.id, s.fullName]),
      ...participants.map((p) => [p.id, p.studentName]),
    ]);
    return (session.presentStudentIds || [])
      .filter((id) => !joined.has(id))
      .map((id) => ({ id, name: nameById.get(id) || id }));
  }, [session, participants, presentStudents]);
  const canStartLobby = lobbyRosterReady && participants.length >= impostorCount + 2;

  useEffect(() => {
    if (!sessionId || !crewReady || session?.status !== 'playing') return undefined;
    const timer = setTimeout(() => {
      completeCrewGame(sessionId)
        .then(() => toast.success('Đủ nhiệm vụ — đã công bố kết quả!'))
        .catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [sessionId, crewReady, session?.status, toast]);

  const handleCreate = () => {
    if (!selectedClass) {
      toast.error('Chọn lớp trước.');
      return;
    }
    if (presentStudents.length < impostorCount + 2) {
      toast.error('Không đủ học sinh có mặt.');
      return;
    }
    runAction(async () => {
      const id = await createSpySession({
        classCode: selectedClass,
        presentStudentIds: presentIds,
        impostorCount,
        describeRoundTotal,
        mode: gameMode,
        crewTaskTarget,
      });
      await openSpyLobby(id);
      setSessionId(id);
    }, 'Đã tạo phòng — học sinh vào một lần, chơi nhiều ván.');
  };

  const handleStart = () => {
    if (session?.mode === 'crew') {
      runAction(
        () => startCrewGame(sessionId),
        'Đã bắt đầu mode Phi hành đoàn.',
      );
      return;
    }
    const validated = validateWordPair(civilianWord, spyWord);
    if (validated.error) {
      toast.error(validated.error);
      return;
    }
    runAction(
      () => startSpyGame(sessionId, { civilianWord: validated.civilian, spyWord: validated.spy }),
      'Đã bắt đầu — học sinh thấy cụm từ trên điện thoại.',
    );
  };

  const copyLink = async (link, label) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(`Đã copy ${label}.`);
    } catch {
      toast.error('Không copy được link.');
    }
  };

  const openPresentation = () => {
    if (presentLink) window.open(presentLink, '_blank', 'noopener');
  };

  const randomPair = () => {
    const picked = pickRandomPair(categoryId);
    setCivilianWord(picked.pair.civilian);
    setSpyWord(picked.pair.spy);
    const idx = picked.category.pairs.findIndex(
      (p) => p.civilian === picked.pair.civilian && p.spy === picked.pair.spy,
    );
    if (idx >= 0) setPairIndex(idx);
  };

  const wordPickerProps = {
    wordMode,
    setWordMode,
    categoryId,
    setCategoryId,
    pairIndex,
    setPairIndex,
    civilianWord,
    setCivilianWord,
    spyWord,
    setSpyWord,
    onRandomPair: randomPair,
  };

  if (loadingStudents) return <LoadingCatState message="Đang tải học sinh..." />;
  if (!selectedClass) return <SelectClassPrompt title="Chọn lớp ở trên để chơi Truy tìm gián điệp" />;
  if (!students.length) {
    return <EmptyState icon={<Users className="h-7 w-7" />} title="Lớp chưa có học sinh" />;
  }
  if (!presentStudents.length) {
    return (
      <EmptyState
        icon={<Users className="h-7 w-7" />}
        title="Chưa chọn học sinh có mặt"
        description="Tick điểm danh tường minh trên hub trước khi tạo phòng."
      />
    );
  }

  return (
    <div className="space-y-4">
      {loadError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</p>
      )}

      {!sessionId && (
        <div className="card space-y-4 p-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Thiết lập phòng chơi</h3>
          <p className="text-sm text-slate-500">
            Học sinh vào phòng một lần qua link lớp. Sau mỗi ván bấm &quot;Ván tiếp theo&quot; — không cần vào lại.
          </p>
          <Field label={`Số gián điệp (tối đa ${maxSpies || 1})`}>
            <Input
              type="number"
              min={1}
              max={Math.max(1, maxSpies)}
              value={impostorCount}
              onChange={(e) => setImpostorCount(Number(e.target.value) || 1)}
            />
          </Field>
          <Field label="Mode">
            <Select value={gameMode} onChange={(e) => setGameMode(e.target.value)}>
              {Object.entries(SPY_MODES).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </Select>
          </Field>
          {gameMode === 'word' ? (
            <>
              <Field label="Số vòng mô tả (ván đầu)">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={describeRoundTotal}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setDescribeRoundTotal(Number.isFinite(n) ? Math.min(20, Math.max(1, n)) : 1);
                  }}
                />
              </Field>
              <SpyWordPicker {...wordPickerProps} />
            </>
          ) : (
            <Field label="Tổng nhiệm vụ nhóm">
              <Input
                type="number"
                min={5}
                max={100}
                value={crewTaskTarget}
                onChange={(e) => setCrewTaskTarget(Math.max(5, Math.min(100, Number(e.target.value) || 15)))}
              />
            </Field>
          )}
          <Button onClick={handleCreate} loading={busy}>
            <Search className="h-4 w-4" />
            Tạo phòng & mở lobby
          </Button>
        </div>
      )}

      {sessionId && session && (
        <>
          <div className="card space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{spyStatusLabel(session.status)}</Badge>
              <Badge tone="slate">{session.mode === 'crew' ? SPY_MODES.crew : SPY_MODES.word}</Badge>
              {isCrewSession && session.status === 'playing' && (
                <Badge tone="brand">
                  Đang làm nhiệm vụ
                </Badge>
              )}
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {participants.length} / {sessionPresentCount || presentStudents.length} trong phòng
              </span>
            </div>

            {session.status === 'lobby' && (
              <p className="text-xs text-slate-500">
                Điểm danh đã khóa vào phòng — sửa bằng &quot;Đồng bộ theo người đã vào&quot; bên dưới nếu tick thừa.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {portalLink && (
                <Button type="button" variant="secondary" size="sm" onClick={() => copyLink(portalLink, 'link học sinh')}>
                  <Copy className="h-4 w-4" />
                  Link HS
                </Button>
              )}
              {presentLink && (
                <>
                  <Button type="button" variant="secondary" size="sm" onClick={openPresentation}>
                    <Monitor className="h-4 w-4" />
                    Màn trình chiếu
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => copyLink(presentLink, 'link trình chiếu')}>
                    <ExternalLink className="h-4 w-4" />
                    Copy trình chiếu
                  </Button>
                </>
              )}
            </div>

            <p className="text-xs text-slate-500">
              Mở <strong>Màn trình chiếu</strong> trên TV/máy chiếu.
              {isCrewSession
                ? ' Mode Phi hành đoàn: gián điệp phá hệ thống sẽ loại ngẫu nhiên 1 người và mở họp khẩn.'
                : ' Trong vòng mô tả, giáo viên chủ động bấm Mở bỏ phiếu khi muốn vote.'}
            </p>

            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
              {session.status === 'describe' && (
                <>
                  <Button
                    size="sm"
                    onClick={() => runAction(async () => {
                      const result = await advanceSpyDescribe(sessionId);
                      if (result.roundComplete) {
                        toast.info('Đã hết vòng mô tả — bấm "Mở bỏ phiếu" khi sẵn sàng.');
                      }
                    })}
                    loading={busy}
                  >
                    <SkipForward className="h-4 w-4" />
                    Người tiếp theo
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => runAction(() => openSpyVote(sessionId), 'Đã mở bỏ phiếu')}
                    loading={busy}
                  >
                    <Vote className="h-4 w-4" />
                    Mở bỏ phiếu
                  </Button>
                </>
              )}
              {session.status === 'playing' && (
                <>
                  <Button
                    size="sm"
                    onClick={() => runAction(() => openSpyMeeting(sessionId), 'Đã mở họp khẩn')}
                    loading={busy}
                  >
                    <Vote className="h-4 w-4" />
                    Họp khẩn
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!crewReady}
                    onClick={() => runAction(() => completeCrewGame(sessionId), 'Đã công bố kết quả')}
                    loading={busy}
                  >
                    Kết thúc — công bố
                  </Button>
                </>
              )}
              {session.status === 'sabotage_alert' && (
                <Button
                  size="sm"
                  onClick={() => runAction(
                    () => acknowledgeCrewSabotage(sessionId),
                    'Đã vào họp khẩn — bỏ phiếu',
                  )}
                  loading={busy}
                >
                  <Vote className="h-4 w-4" />
                  Vào họp khẩn — bỏ phiếu
                </Button>
              )}
              {session.status === 'vote' && (
                <>
                  {session.mode === 'crew' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => runAction(
                        () => adminSkipCrewVoteRound(sessionId),
                        'Đã bỏ qua vote — tiếp tục nhiệm vụ',
                      )}
                      loading={busy}
                    >
                      <SkipForward className="h-4 w-4" />
                      Bỏ qua vote — tiếp tục ({votes.length}/{activeParticipants.length})
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => runAction(
                      () => resolveSpyVoteRound(sessionId),
                      formatEliminateResult,
                    )}
                    loading={busy}
                    disabled={!votes.length}
                  >
                    <Vote className="h-4 w-4" />
                    Chốt vote & loại người ({votes.length}/{activeParticipants.length})
                  </Button>
                </>
              )}
              {session.status === 'tie_debate' && (
                <>
                  <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                    <p>
                      Đang biện luận:{' '}
                      <strong>
                        {participants.find((p) => p.id === (session.tieCandidateIds?.[session.tieDebateIndex]))?.studentName
                          || '—'}
                      </strong>
                      {' · '}
                      {(session.tieDebateIndex || 0) + 1}/{session.tieCandidateIds?.length || 0}
                    </p>
                    <SpyTieCountdown session={session} className="mt-1" />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => runAction(
                      () => advanceTieDebate(sessionId),
                      (result) => (result?.openedRevote
                        ? 'Đã mở đổi phiếu sau biện luận'
                        : 'Chuyển người biện luận tiếp theo'),
                    )}
                    loading={busy}
                  >
                    <SkipForward className="h-4 w-4" />
                    {(session.tieDebateIndex || 0) + 1 >= (session.tieCandidateIds?.length || 0)
                      ? 'Mở đổi phiếu'
                      : 'Người tiếp theo'}
                  </Button>
                </>
              )}
              {session.status === 'tie_revote' && (
                <Button
                  size="sm"
                  onClick={() => runAction(
                    () => resolveTieRevote(sessionId),
                    formatEliminateResult,
                  )}
                  loading={busy}
                  disabled={!votes.length}
                >
                  <Vote className="h-4 w-4" />
                  Chốt sau biện luận ({votes.length}/{activeParticipants.length})
                </Button>
              )}
              {(session.status === 'reveal' || session.status === 'finished') && (
                <Button
                  size="sm"
                  onClick={() => runAction(() => restartSpyRound(sessionId), 'Ván mới — học sinh chờ trong phòng')}
                  loading={busy}
                >
                  <RotateCcw className="h-4 w-4" />
                  Ván tiếp theo
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => runAction(() => finishSpySession(sessionId), 'Đã đóng phòng').then((result) => {
                  if (result !== null) setSessionId(null);
                })}
                loading={busy}
              >
                Đóng phòng
              </Button>
            </div>
          </div>

          {session.mode !== 'crew' && (session.status === 'lobby' || session.status === 'reveal' || session.status === 'finished') && (
            <SpyWordPicker {...wordPickerProps} compact />
          )}

          {session.status === 'reveal' && session.outcome && (
            <div className="card border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                {spyOutcomeLabel(session.outcome, session.mode)}
              </p>
              {(session.eliminatedIds || []).length > 0 && (
                <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                  Đã loại: {(session.eliminatedIds || [])
                    .map((id) => participants.find((p) => p.id === id)?.studentName || id)
                    .join(' → ')}
                </p>
              )}
            </div>
          )}

          {session.status === 'lobby' && (
            <div className="card space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Sẵn sàng bắt đầu
                </p>
                <Badge tone={lobbyRosterReady ? 'green' : 'amber'}>
                  {participants.length}/{sessionPresentCount} đã vào
                </Badge>
              </div>
              {missingJoiners.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                    Có mặt nhưng chưa vào:
                  </p>
                  <ul className="text-sm text-slate-700 dark:text-slate-200">
                    {missingJoiners.map((row) => (
                      <li key={row.id}>· {row.name}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  Đã vào: mọi người trong danh sách có mặt đều đã vào phòng.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleStart}
                  loading={busy}
                  disabled={!canStartLobby}
                >
                  <Play className="h-4 w-4" />
                  {session.mode === 'crew' ? 'Bắt đầu mode Phi hành đoàn' : 'Bắt đầu ván — phát từ cho học sinh'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || participants.length < impostorCount + 2}
                  onClick={() => runAction(
                    () => syncSpyPresentRosterToJoined(sessionId),
                    'Đã đồng bộ điểm danh theo người đã vào phòng.',
                  )}
                >
                  <Users className="h-4 w-4" />
                  Đồng bộ theo người đã vào
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || presentIds.length < impostorCount + 2}
                  onClick={() => runAction(
                    () => updateSpyPresentRoster(sessionId, [
                      ...new Set([...(session.presentStudentIds || []), ...presentIds]),
                    ]),
                    'Đã cập nhật roster từ điểm danh hub (giữ người đã vào).',
                  )}
                >
                  Cập nhật từ hub
                </Button>
              </div>
              {!canStartLobby && (
                <p className="text-xs text-slate-500">
                  Start khi đủ người tick đã vào, hoặc bấm Đồng bộ nếu đã tick thừa người vắng.
                </p>
              )}
            </div>
          )}

          <SpyGmRoster
            session={session}
            presentStudents={presentStudents}
            participants={participants}
            votes={votes}
            tally={tally}
            taskProgress={taskProgress}
            speakerId={speakerId}
          />

          <div className="card border border-slate-200 p-4 dark:border-slate-700">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Xem trước màn trình chiếu (không hiện từ khóa)
            </p>
            <SpyStage
              session={session}
              participants={participants}
              votes={votes}
              tally={tally}
              topCandidates={topCandidates}
              taskProgress={taskProgress}
              speakerName={speakerName}
              presenting={false}
              hideWords
              spyNames={spyNames}
            />
          </div>
        </>
      )}
    </div>
  );
}
