import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Mountain,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Trash2,
  Users,
} from 'lucide-react';
import { Button } from '../../../ui/components/Button.jsx';
import { EmptyState } from '../../../ui/components/EmptyState.jsx';
import { Field, Input, Select, Textarea } from '../../../ui/components/Field.jsx';
import { Markdown } from '../../../ui/components/Markdown.jsx';
import { SelectClassPrompt, LoadingCatState } from '../../../ui/components/WaitingCatIllustration.jsx';
import { ClassFilterBar } from '../../../ui/components/ClassFilterBar.jsx';
import { useToast } from '../../../ui/components/Toast.jsx';
import { listActiveStudentsByClass } from '../../../services/students.service.js';
import {
  advanceOlympiaQuestion,
  cancelOlympiaSession,
  createOlympiaSession,
  getOlympiaPortalLink,
  getResponsesForQuestion,
  getRoundProgress,
  gradeCurrentQuestion,
  openOlympiaLobby,
  startOlympiaGame,
  subscribeOlympiaParticipants,
  subscribeOlympiaResponses,
  subscribeOlympiaSession,
} from '../../../services/olympia.service.js';
import {
  getQuestionFromSession,
  isLastQuestionInRound,
  isLastRound,
  previewPackQuestions,
} from '../../../lib/olympiaQuestions.js';
import { DEFAULT_STEP_THRESHOLD, OLYMPIA_ROUNDS, ROUND_ORDER } from '../../../lib/olympiaConstants.js';
import { OLYMPIA_PRESET_PACKS, suggestPackForSession } from '../../../data/olympiaPresetPacks.js';
import { getSessionStatusLabel } from '../../../lib/olympiaRules.js';
import { OlympiaRulesPanel, OlympiaRoundBanner } from '../../../ui/components/OlympiaRulesPanel.jsx';
import { getErrorMessage, toDate } from '../../../lib/firestore.js';
import { GameConfetti } from './GameConfetti.jsx';
import { GamePresentationShell, useGamePresentation } from './GamePresentationShell.jsx';
import { OlympiaMountainBoard, OlympiaPodium } from './OlympiaMountainBoard.jsx';

function formatCountdown(deadline) {
  const end = toDate(deadline);
  if (!end) return '--:--';
  const sec = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function emptyCustomQuestion() {
  return {
    prompt: '',
    code: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    round: 'startup',
  };
}

export function OlympiaGame({ classes, programs = [] }) {
  const toast = useToast();
  const { shellRef, presenting, togglePresentation } = useGamePresentation();

  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [packId, setPackId] = useState(OLYMPIA_PRESET_PACKS[0].id);
  const [stepThreshold, setStepThreshold] = useState(String(DEFAULT_STEP_THRESHOLD));
  const [speedBonusEnabled, setSpeedBonusEnabled] = useState(false);
  const [customQuestions, setCustomQuestions] = useState([]);
  const [creating, setCreating] = useState(false);
  const [roundBanner, setRoundBanner] = useState(null);

  const [sessionId, setSessionId] = useState(null);
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [responses, setResponses] = useState([]);
  const [countdown, setCountdown] = useState('--:--');
  const [busy, setBusy] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const activeClasses = useMemo(
    () => classes.filter((c) => c.status === 'active'),
    [classes],
  );

  const selectedClassDoc = useMemo(
    () => activeClasses.find((c) => c.classCode === selectedClass) || null,
    [activeClasses, selectedClass],
  );

  const suggestedPack = useMemo(
    () => suggestPackForSession(selectedClassDoc?.curriculumCurrentSession),
    [selectedClassDoc?.curriculumCurrentSession],
  );

  const previewQuestions = useMemo(
    () => previewPackQuestions(packId, customQuestions),
    [packId, customQuestions],
  );

  const selectedPack = useMemo(
    () => OLYMPIA_PRESET_PACKS.find((p) => p.id === packId) || OLYMPIA_PRESET_PACKS[0],
    [packId],
  );

  useEffect(() => {
    if (!activeClasses.length) {
      setSelectedClass('');
      return;
    }
    setSelectedClass((prev) => {
      if (prev && activeClasses.some((c) => c.classCode === prev)) return prev;
      return '';
    });
  }, [activeClasses]);

  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      return undefined;
    }
    let cancelled = false;
    setLoadingStudents(true);
    listActiveStudentsByClass(selectedClass)
      .then((list) => {
        if (!cancelled) {
          setStudents(list);
          setLoadingStudents(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingStudents(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedClassDoc || !suggestedPack) return;
    setPackId(suggestedPack.id);
  }, [selectedClass, suggestedPack?.id]);

  useEffect(() => {
    if (!session || session.status !== 'playing' || session.questionIndex !== 0) return undefined;
    setRoundBanner(session.currentRound);
    const timer = setTimeout(() => setRoundBanner(null), 4000);
    return () => clearTimeout(timer);
  }, [session?.currentRound, session?.questionIndex, session?.status]);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      return undefined;
    }
    return subscribeOlympiaSession(
      sessionId,
      setSession,
      (err) => toast.error(getErrorMessage(err)),
    );
  }, [sessionId, toast]);

  useEffect(() => {
    if (!sessionId) {
      setParticipants([]);
      return undefined;
    }
    return subscribeOlympiaParticipants(sessionId, setParticipants, () => {});
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setResponses([]);
      return undefined;
    }
    return subscribeOlympiaResponses(sessionId, setResponses, () => {});
  }, [sessionId]);

  useEffect(() => {
    if (session?.status !== 'playing' || !session.questionDeadlineAt) {
      setCountdown('--:--');
      return undefined;
    }
    const tick = () => setCountdown(formatCountdown(session.questionDeadlineAt));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [session?.status, session?.questionDeadlineAt]);

  useEffect(() => {
    if (session?.status === 'finished') {
      setShowConfetti(true);
    }
  }, [session?.status]);

  const currentQuestion = useMemo(() => {
    if (!session) return null;
    return getQuestionFromSession(session, session.currentRound, session.questionIndex);
  }, [session]);

  const roundProgress = useMemo(
    () => (session ? getRoundProgress(session) : null),
    [session],
  );

  const currentResponses = useMemo(() => {
    if (!session) return [];
    return getResponsesForQuestion(responses, session.currentRound, session.questionIndex);
  }, [responses, session]);

  const submittedCount = currentResponses.length;
  const joinedIds = useMemo(() => new Set(participants.map((p) => p.id)), [participants]);
  const notJoined = students.filter((s) => !joinedIds.has(s.id));

  const portalLink = sessionId && selectedClass
    ? getOlympiaPortalLink(selectedClass, sessionId)
    : '';

  const handleCreate = async () => {
    if (!selectedClass) {
      toast.error('Chọn lớp trước.');
      return;
    }
    if (!packId) {
      toast.error('Chọn gói câu hỏi.');
      return;
    }
    setCreating(true);
    try {
      const id = await createOlympiaSession({
        classCode: selectedClass,
        packId,
        customQuestions,
        stepThreshold: Number(stepThreshold) || DEFAULT_STEP_THRESHOLD,
        speedBonusEnabled,
      });
      await openOlympiaLobby(id);
      setSessionId(id);
      toast.success('Đã tạo phòng Olympia.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const runAction = useCallback(
    async (fn, successMsg) => {
      if (!sessionId || busy) return;
      setBusy(true);
      try {
        await fn();
        if (successMsg) toast.success(successMsg);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [sessionId, busy, toast],
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(portalLink);
      toast.success('Đã copy link thi.');
    } catch {
      toast.error('Không copy được link.');
    }
  };

  const resetSetup = () => {
    setSessionId(null);
    setSession(null);
    setShowConfetti(false);
  };

  const revealedIndex = session?.revealedAnswer?.correctIndex;

  const renderQuestion = (large = false) => {
    if (!currentQuestion) return null;
    return (
      <div className={`text-center ${large ? 'space-y-6' : 'space-y-3'}`}>
        {roundProgress && (
          <p className={`font-semibold ${large ? 'text-lg text-amber-300' : 'text-sm text-amber-400'}`}>
            {roundProgress.roundLabel} — Câu {roundProgress.current}/{roundProgress.total}
          </p>
        )}
        <div className={`card-prose mx-auto max-w-2xl ${large ? 'text-xl text-white' : 'text-base text-slate-100'}`}>
          <Markdown content={currentQuestion.prompt} />
        </div>
        {currentQuestion.code && (
          <pre
            className={`mx-auto max-w-xl overflow-x-auto rounded-xl bg-black/60 text-left ${
              large ? 'p-6 text-lg' : 'p-4 text-sm'
            } text-emerald-300`}
          >
            <code>{currentQuestion.code}</code>
          </pre>
        )}
        {session?.status === 'reveal' && revealedIndex != null && (
          <p className={`font-bold text-green-400 ${large ? 'text-xl' : 'text-base'}`}>
            Đáp án: {String.fromCharCode(65 + revealedIndex)} — {currentQuestion.options[revealedIndex]}
          </p>
        )}
        {session?.status === 'playing' && (
          <p className={`font-mono font-bold tabular-nums ${large ? 'text-4xl text-white' : 'text-2xl text-brand-300'}`}>
            {countdown}
          </p>
        )}
      </div>
    );
  };

  const stageContent = () => {
    if (!session) return null;

    if (session.status === 'finished') {
      return (
        <div className="flex flex-col items-center gap-4">
          {showConfetti && <GameConfetti />}
          <h2 className={`font-bold ${presenting ? 'text-3xl text-white' : 'text-xl text-slate-100'}`}>
            Kết thúc — Bục vinh quang
          </h2>
          <OlympiaPodium participants={participants} presenting={presenting} />
          <OlympiaMountainBoard
            participants={participants}
            stepThreshold={session.config?.stepThreshold}
            presenting={presenting}
          />
        </div>
      );
    }

    if (session.status === 'lobby') {
      return (
        <div className="text-center">
          <p className={`mb-4 ${presenting ? 'text-2xl text-white' : 'text-lg text-slate-200'}`}>
            Phòng chờ — Olympia Python
          </p>
          <p className={presenting ? 'text-6xl font-bold text-amber-300' : 'text-4xl font-bold text-amber-400'}>
            {participants.length}
            <span className={`ml-2 font-normal ${presenting ? 'text-2xl text-white/70' : 'text-lg text-slate-400'}`}>
              / {students.length} HS
            </span>
          </p>
          <OlympiaMountainBoard
            participants={participants}
            stepThreshold={session.config?.stepThreshold}
            presenting={presenting}
          />
        </div>
      );
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
        {roundBanner && (
          <div className="absolute inset-x-0 top-8 z-30 mx-auto max-w-xl px-4">
            <OlympiaRoundBanner
              roundId={roundBanner}
              speedBonusEnabled={session.config?.speedBonusEnabled}
              large={presenting}
            />
          </div>
        )}
        <div className="flex flex-1 flex-col justify-center">{renderQuestion(presenting)}</div>
        <div className={`${presenting ? 'w-full lg:w-[45%]' : 'w-full'}`}>
          <OlympiaMountainBoard
            participants={participants}
            stepThreshold={session.config?.stepThreshold}
            presenting={presenting}
          />
        </div>
      </div>
    );
  };

  if (sessionId && session) {
    return (
      <div className="space-y-4">
        <GamePresentationShell
          shellRef={shellRef}
          presenting={presenting}
          onTogglePresentation={togglePresentation}
          stageBorder="border-emerald-500/30"
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">
                {selectedClass} · {getSessionStatusLabel(session.status, submittedCount, participants.length)}
              </span>
              {session.config?.packLabel && (
                <span className="text-xs text-slate-500">{session.config.packLabel}</span>
              )}
              {!presenting && (
                <Button variant="subtle" size="sm" onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                  Copy link
                </Button>
              )}
            </div>
          }
          footer={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {session.status === 'lobby' && (
                <Button
                  disabled={busy || participants.length === 0}
                  onClick={() => runAction(() => startOlympiaGame(sessionId), 'Bắt đầu vòng Khởi động!')}
                >
                  <Play className="h-4 w-4" />
                  Bắt đầu thi
                </Button>
              )}
              {session.status === 'playing' && (
                <>
                  <span className="text-sm text-slate-400">
                    Đã nộp: {submittedCount}/{participants.length}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    className={
                      submittedCount > 0 && submittedCount >= participants.length
                        ? 'ring-2 ring-amber-400 ring-offset-2 dark:ring-offset-slate-900'
                        : ''
                    }
                    onClick={() => runAction(() => gradeCurrentQuestion(sessionId), 'Đã công bố đáp án')}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Công bố đáp án
                  </Button>
                </>
              )}
              {session.status === 'reveal' && (
                <Button
                  disabled={busy}
                  onClick={() => {
                    const isLast =
                      isLastQuestionInRound(session) && isLastRound(session);
                    runAction(
                      () => advanceOlympiaQuestion(sessionId),
                      isLast ? 'Kết thúc!' : 'Câu tiếp theo',
                    );
                  }}
                >
                  <SkipForward className="h-4 w-4" />
                  {isLastQuestionInRound(session) && isLastRound(session)
                    ? 'Kết thúc'
                    : 'Câu / vòng tiếp'}
                </Button>
              )}
              {session.status !== 'finished' && (
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    runAction(async () => {
                      await cancelOlympiaSession(sessionId);
                      resetSetup();
                    }, 'Đã kết thúc sớm')
                  }
                >
                  Kết thúc sớm
                </Button>
              )}
              {session.status === 'finished' && (
                <Button variant="secondary" onClick={resetSetup}>
                  <RotateCcw className="h-4 w-4" />
                  Tạo phòng mới
                </Button>
              )}
            </div>
          }
        >
          {stageContent()}
        </GamePresentationShell>

        {!presenting && (
          <div className="card grid gap-4 p-4 sm:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Link thi cho học sinh
              </h4>
              <p className="break-all text-xs text-brand-600 dark:text-brand-300">{portalLink}</p>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Chưa vào phòng ({notJoined.length})
              </h4>
              <p className="text-xs text-slate-500">
                {notJoined.length
                  ? notJoined.map((s) => s.fullName).join(', ')
                  : 'Tất cả đã tham gia'}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ClassFilterBar
        classes={activeClasses}
        programs={programs}
        value={selectedClass}
        onChange={setSelectedClass}
        compact
        showStudentCount
        autoSelectFirst={false}
      />

      {loadingStudents ? (
        <LoadingCatState message="Đang tải học sinh..." />
      ) : !selectedClass ? (
        <SelectClassPrompt
          title="Chọn lớp để bắt đầu Olympia"
          description="Chọn lớp để mở phiên Olympia."
        />
      ) : (
        <>
          <OlympiaRulesPanel stepThreshold={Number(stepThreshold) || DEFAULT_STEP_THRESHOLD} />

          <div className="card space-y-4 p-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Gói câu hỏi theo buổi</h3>
            {selectedClassDoc?.curriculumCurrentSession > 0 && (
              <p className="text-sm text-brand-600 dark:text-brand-300">
                Lớp đang ở buổi {selectedClassDoc.curriculumCurrentSession} — gợi ý:{' '}
                <strong>{suggestedPack.label}</strong>
              </p>
            )}
            <Field label="Chọn gói đề">
              <Select value={packId} onChange={(e) => setPackId(e.target.value)}>
                {OLYMPIA_PRESET_PACKS.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.label}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-sm text-slate-500">{selectedPack.description}</p>
            <p className="text-xs text-slate-400">
              {ROUND_ORDER.map((r) => `${OLYMPIA_ROUNDS[r].label}: ${OLYMPIA_ROUNDS[r].count} câu`).join(' · ')}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ngưỡng 1 bậc leo núi (điểm)">
                <Input
                  type="number"
                  min={10}
                  max={100}
                  value={stepThreshold}
                  onChange={(e) => setStepThreshold(e.target.value)}
                />
              </Field>
              <Field label="Bonus trả lời nhanh (vòng Tăng tốc)">
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={speedBonusEnabled}
                    onChange={(e) => setSpeedBonusEnabled(e.target.checked)}
                  />
                  Bật +5 điểm nếu trả lời đúng trong 10 giây
                </label>
              </Field>
            </div>
          </div>

          <div className="card space-y-3 p-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">
              Preview — {previewQuestions.length} câu trong phiên
            </h3>
            <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {previewQuestions.map((q, i) => (
                <div
                  key={`${q.round}-${q.id}-${i}`}
                  className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
                >
                  <p className="text-xs font-semibold text-brand-600 dark:text-brand-300">
                    {q.roundLabel} · Câu {q.index}
                  </p>
                  <p className="line-clamp-2 text-slate-700 dark:text-slate-200">{q.prompt}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Câu hỏi tùy chỉnh</h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCustomQuestions((prev) => [...prev, emptyCustomQuestion()])}
              >
                <Plus className="h-4 w-4" />
                Thêm câu
              </Button>
            </div>
            {customQuestions.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có — sẽ dùng bộ câu có sẵn.</p>
            ) : (
              customQuestions.map((q, qi) => (
                <div key={qi} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Select
                      value={q.round}
                      onChange={(e) => {
                        const next = [...customQuestions];
                        next[qi] = { ...next[qi], round: e.target.value };
                        setCustomQuestions(next);
                      }}
                    >
                      {ROUND_ORDER.map((r) => (
                        <option key={r} value={r}>
                          {OLYMPIA_ROUNDS[r].label}
                        </option>
                      ))}
                    </Select>
                    <button
                      type="button"
                      className="text-red-500"
                      onClick={() => setCustomQuestions((prev) => prev.filter((_, i) => i !== qi))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Field label="Câu hỏi">
                    <Textarea
                      value={q.prompt}
                      onChange={(e) => {
                        const next = [...customQuestions];
                        next[qi] = { ...next[qi], prompt: e.target.value };
                        setCustomQuestions(next);
                      }}
                    />
                  </Field>
                  <Field label="Code (tuỳ chọn)" className="mt-2">
                    <Textarea
                      value={q.code}
                      onChange={(e) => {
                        const next = [...customQuestions];
                        next[qi] = { ...next[qi], code: e.target.value };
                        setCustomQuestions(next);
                      }}
                      className="font-mono text-sm"
                    />
                  </Field>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {q.options.map((opt, oi) => (
                      <Field key={oi} label={`Đáp án ${String.fromCharCode(65 + oi)}`}>
                        <Input
                          value={opt}
                          onChange={(e) => {
                            const next = [...customQuestions];
                            const opts = [...next[qi].options];
                            opts[oi] = e.target.value;
                            next[qi] = { ...next[qi], options: opts };
                            setCustomQuestions(next);
                          }}
                        />
                      </Field>
                    ))}
                  </div>
                  <Field label="Đáp án đúng" className="mt-2">
                    <Select
                      value={q.correctIndex}
                      onChange={(e) => {
                        const next = [...customQuestions];
                        next[qi] = { ...next[qi], correctIndex: Number(e.target.value) };
                        setCustomQuestions(next);
                      }}
                    >
                      {[0, 1, 2, 3].map((i) => (
                        <option key={i} value={i}>
                          {String.fromCharCode(65 + i)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button disabled={creating || students.length === 0} onClick={handleCreate}>
              <Users className="h-4 w-4" />
              {creating ? 'Đang tạo...' : `Tạo phòng Olympia (${students.length} HS)`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
