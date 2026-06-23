import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Copy,
  ExternalLink,
  Monitor,
  Play,
  RotateCcw,
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
  getSpyPresentLink,
  getSpySessionResults,
  openSpyLobby,
  openSpyVote,
  restartSpyRound,
  revealSpyRound,
  startSpyGame,
  subscribeSpyParticipants,
  subscribeSpySession,
  subscribeSpyVotes,
  syncSpyClassPointer,
  tallySpyVotes,
} from '../../../services/spy.service.js';
import { SpyStage } from './SpyStage.jsx';

function SpyWordPicker({
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
  onRandomPair,
  compact = false,
}) {
  const categoryPairs = useMemo(() => getCategoryPairs(categoryId), [categoryId]);

  return (
    <div className={`space-y-3 ${compact ? '' : 'card p-4'}`}>
      {!compact && (
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Cặp từ (chỉ giáo viên thấy)
        </p>
      )}
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
            <Button type="button" variant="secondary" size="sm" onClick={onRandomPair}>
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

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
        GV xem: <strong>{civilianWord || '—'}</strong> · <strong>{spyWord || '—'}</strong>
      </p>
    </div>
  );
}

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
  const presentLink = sessionId ? getSpyPresentLink(sessionId) : '';
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
    }, 'Đã tạo phòng — học sinh vào một lần, chơi nhiều ván.');
  };

  const handleStart = () => {
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
    return <EmptyState icon={<Users className="h-7 w-7" />} title="Chưa chọn học sinh có mặt" />;
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
          <SpyWordPicker {...wordPickerProps} />
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
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {participants.length} / {presentStudents.length} trong phòng
              </span>
            </div>

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
              Mở <strong>Màn trình chiếu</strong> trên TV/máy chiếu — học sinh không thấy từ khóa. Điều khiển ván ở màn hình này.
            </p>

            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
              {session.status === 'describe' && (
                <>
                  <Button size="sm" onClick={() => runAction(() => advanceSpyDescribe(sessionId))} loading={busy}>
                    <SkipForward className="h-4 w-4" />
                    Người tiếp theo
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
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
                  size="sm"
                  onClick={() => runAction(
                    () => revealSpyRound(sessionId, { civilianWord, spyWord }),
                    'Đã công bố trên màn trình chiếu',
                  )}
                  loading={busy}
                >
                  Công bố kết quả
                </Button>
              )}
              {(session.status === 'reveal' || session.status === 'finished') && (
                <>
                  <Button
                    size="sm"
                    onClick={() => runAction(() => restartSpyRound(sessionId), 'Ván mới — học sinh chờ trong phòng')}
                    loading={busy}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Ván tiếp theo
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => runAction(() => finishSpySession(sessionId), 'Đã đóng phòng')}
                    loading={busy}
                  >
                    Đóng phòng
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => runAction(() => cancelSpySession(sessionId)).then(() => setSessionId(null))}
                loading={busy}
              >
                <Square className="h-4 w-4" />
                Huỷ phòng
              </Button>
            </div>
          </div>

          {(session.status === 'lobby' || session.status === 'reveal' || session.status === 'finished') && (
            <SpyWordPicker {...wordPickerProps} compact />
          )}

          {session.status === 'lobby' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="card p-4">
                <p className="mb-2 text-sm font-semibold">Trong phòng ({participants.length})</p>
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
                  Bắt đầu ván — phát từ cho học sinh
                </Button>
              </div>
            </div>
          )}

          <div className="card border border-slate-200 p-4 dark:border-slate-700">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Xem trước màn trình chiếu (không hiện từ khóa)
            </p>
            <SpyStage
              session={session}
              participants={participants}
              votes={votes}
              tally={tally}
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
