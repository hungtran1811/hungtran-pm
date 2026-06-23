import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Play,
  Search,
  SkipForward,
  Square,
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
import { spyStatusLabel } from '../../../lib/spyConstants.js';
import {
  getCategoryPairs,
  pickRandomPair,
  SPY_WORD_CATEGORIES,
  validateWordPair,
} from '../../../data/spyWordBank.js';
import { getErrorMessage } from '../../../lib/firestore.js';
import {
  advanceSpyDescribe,
  cancelSpySession,
  createSpySession,
  finishSpySession,
  getCurrentSpeaker,
  getSpyPortalLink,
  getSpySessionResults,
  openSpyLobby,
  openSpyVote,
  revealSpyRound,
  startSpyGame,
  subscribeSpyParticipants,
  subscribeSpySession,
  subscribeSpyVotes,
  syncSpyClassPointer,
  tallySpyVotes,
} from '../../../services/spy.service.js';
import { GamePresentationShell, useGamePresentation } from './GamePresentationShell.jsx';
import { SpyStage } from './SpyStage.jsx';

export function SpyGame({
  selectedClass = '',
  students = [],
  presentStudents = [],
  presentStudentIds,
  loadingStudents = false,
  loadError = '',
}) {
  const toast = useToast();
  const { shellRef, presenting, togglePresentation } = useGamePresentation();
  const [sessionId, setSessionId] = useState(null);
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [votes, setVotes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [wordMode, setWordMode] = useState('bank');
  const [categoryId, setCategoryId] = useState(SPY_WORD_CATEGORIES[0].id);
  const [pairIndex, setPairIndex] = useState(0);
  const [civilianWord, setCivilianWord] = useState('');
  const [spyWord, setSpyWord] = useState('');
  const [impostorCount, setImpostorCount] = useState(1);
  const [revealData, setRevealData] = useState(null);

  const presentIds = useMemo(() => [...(presentStudentIds || [])], [presentStudentIds]);
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
    if (!sessionId) {
      setSession(null);
      return undefined;
    }
    return subscribeSpySession(sessionId, setSession, () => {});
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setParticipants([]);
      return undefined;
    }
    return subscribeSpyParticipants(sessionId, setParticipants, () => {});
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setVotes([]);
      return undefined;
    }
    return subscribeSpyVotes(sessionId, setVotes, () => {});
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !session?.status) return;
    syncSpyClassPointer(sessionId).catch(() => {});
  }, [sessionId, session?.status]);

  useEffect(() => {
    if (session?.status !== 'reveal' || !sessionId) {
      setRevealData(null);
      return;
    }
    getSpySessionResults(sessionId).then(setRevealData).catch(() => {});
  }, [session?.status, sessionId]);

  const joinedIds = useMemo(() => new Set(participants.map((p) => p.id)), [participants]);
  const notJoined = presentStudents.filter((s) => !joinedIds.has(s.id));
  const portalLink = sessionId && selectedClass ? getSpyPortalLink(selectedClass, sessionId) : '';
  const speakerId = getCurrentSpeaker(session);
  const speakerName = participants.find((p) => p.id === speakerId)?.studentName || '';
  const tally = useMemo(() => tallySpyVotes(votes, participants), [votes, participants]);
  const spyNames = useMemo(() => {
    if (session?.status === 'reveal' && revealData?.spies) {
      return revealData.spies.map((p) => p.studentName);
    }
    return [];
  }, [session?.status, revealData]);

  const runAction = useCallback(async (fn, successMsg) => {
    setBusy(true);
    try {
      await fn();
      if (successMsg) toast.success(successMsg);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [toast]);

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
      });
      await openSpyLobby(id);
      setSessionId(id);
    }, 'Đã tạo phòng.');
  };

  const handleStart = () => {
    const validated = validateWordPair(civilianWord, spyWord);
    if (validated.error) {
      toast.error(validated.error);
      return;
    }
    runAction(
      () => startSpyGame(sessionId, validated),
      'Đã bắt đầu — học sinh thấy cụm từ.',
    );
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(portalLink);
      toast.success('Đã copy link.');
    } catch {
      toast.error('Không copy được link.');
    }
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

  const stageBorder =
    session?.status === 'reveal'
      ? 'border-amber-400/80 shadow-[0_0_40px_rgba(251,191,36,0.35)]'
      : 'border-slate-700/80';

  if (loadingStudents) return <LoadingCatState message="Đang tải học sinh..." />;
  if (!selectedClass) return <SelectClassPrompt title="Chọn lớp ở trên để chơi Truy tìm gián điệp" />;
  if (!students.length) {
    return <EmptyState icon={<Users className="h-7 w-7" />} title="Lớp chưa có học sinh" />;
  }
  if (!presentStudents.length) {
    return <EmptyState icon={<Users className="h-7 w-7" />} title="Chưa chọn học sinh có mặt" />;
  }

  return (
    <div className="space-y-4">
      {loadError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</p>
      )}

      {!sessionId && (
        <div className="card space-y-4 p-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Thiết lập ván chơi</h3>
          <Field label={`Số gián điệp (tối đa ${maxSpies || 1})`}>
            <Input
              type="number"
              min={1}
              max={Math.max(1, maxSpies)}
              value={impostorCount}
              onChange={(e) => setImpostorCount(Number(e.target.value) || 1)}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={wordMode === 'bank' ? 'primary' : 'secondary'} size="sm" onClick={() => setWordMode('bank')}>
              Bộ từ sẵn
            </Button>
            <Button type="button" variant={wordMode === 'custom' ? 'primary' : 'secondary'} size="sm" onClick={() => setWordMode('custom')}>
              Tuỳ chỉnh
            </Button>
          </div>

          {wordMode === 'bank' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Chủ đề">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {SPY_WORD_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Cặp từ">
                <Select value={pairIndex} onChange={(e) => setPairIndex(Number(e.target.value))}>
                  {categoryPairs.map((pair, index) => (
                    <option key={`${pair.civilian}-${pair.spy}`} value={index}>
                      {pair.civilian} / {pair.spy}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Button type="button" variant="secondary" size="sm" onClick={randomPair}>
                  Random cặp từ
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Từ dân thường">
                <Input value={civilianWord} onChange={(e) => setCivilianWord(e.target.value)} />
              </Field>
              <Field label="Từ gián điệp">
                <Input value={spyWord} onChange={(e) => setSpyWord(e.target.value)} />
              </Field>
            </div>
          )}

          <p className="text-sm text-slate-500">
            Xem trước: <strong>{civilianWord}</strong> · <strong>{spyWord}</strong>
          </p>

          <Button onClick={handleCreate} loading={busy}>
            <Search className="h-4 w-4" />
            Tạo phòng & mở lobby
          </Button>
        </div>
      )}

      {sessionId && session && (
        <>
          <div className="card flex flex-wrap items-center gap-2 p-3">
            <Badge tone="brand">{spyStatusLabel(session.status)}</Badge>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {participants.length} / {presentStudents.length} đã vào
            </span>
            {portalLink && (
              <Button type="button" variant="secondary" size="sm" onClick={copyLink}>
                <Copy className="h-4 w-4" />
                Copy link HS
              </Button>
            )}
          </div>

          {session.status === 'lobby' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="card p-4">
                <p className="mb-2 text-sm font-semibold">Đã vào ({participants.length})</p>
                <ul className="space-y-1 text-sm">
                  {participants.map((p) => (
                    <li key={p.id}>{p.studentName}</li>
                  ))}
                </ul>
              </div>
              <div className="card p-4">
                <p className="mb-2 text-sm font-semibold text-amber-700">Chưa vào ({notJoined.length})</p>
                <ul className="space-y-1 text-sm text-slate-600">
                  {notJoined.map((s) => (
                    <li key={s.id}>{s.fullName}</li>
                  ))}
                </ul>
              </div>
              <div className="lg:col-span-2">
                <Button onClick={handleStart} loading={busy} disabled={participants.length < impostorCount + 2}>
                  <Play className="h-4 w-4" />
                  Bắt đầu — phát từ cho học sinh
                </Button>
              </div>
            </div>
          )}

          <GamePresentationShell
            shellRef={shellRef}
            presenting={presenting}
            onTogglePresentation={togglePresentation}
            stageBorder={stageBorder}
            toolbar={(
              <>
                {session.status === 'describe' && (
                  <>
                    <Button size="lg" onClick={() => runAction(() => advanceSpyDescribe(sessionId))} loading={busy}>
                      <SkipForward className="h-4 w-4" />
                      {presenting ? 'Tiếp' : 'Người tiếp theo'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => runAction(() => openSpyVote(sessionId), 'Mở bỏ phiếu')}
                      loading={busy}
                    >
                      <Vote className="h-4 w-4" />
                      Bỏ phiếu ngay
                    </Button>
                  </>
                )}
                {session.status === 'vote' && (
                  <Button
                    size="lg"
                    onClick={() => runAction(
                      () => revealSpyRound(sessionId, { civilianWord, spyWord }),
                      'Đã công bố',
                    )}
                    loading={busy}
                  >
                    Công bố kết quả
                  </Button>
                )}
                {session.status === 'reveal' && (
                  <Button size="lg" onClick={() => runAction(() => finishSpySession(sessionId), 'Đã kết thúc')} loading={busy}>
                    Kết thúc ván
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => runAction(() => cancelSpySession(sessionId)).then(() => setSessionId(null))}
                  loading={busy}
                >
                  <Square className="h-4 w-4" />
                  Huỷ phòng
                </Button>
              </>
            )}
          >
            <SpyStage
              session={session}
              participants={participants}
              votes={votes}
              tally={tally}
              speakerName={speakerName}
              civilianWord={civilianWord}
              spyWord={spyWord}
              presenting={presenting}
            />
            {session.status === 'reveal' && spyNames.length > 0 && (
              <p className={`mt-4 text-center ${presenting ? 'text-xl text-red-300' : 'text-red-600'}`}>
                Gián điệp: {spyNames.join(', ')}
              </p>
            )}
          </GamePresentationShell>
        </>
      )}
    </div>
  );
}
