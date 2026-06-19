import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Database,
  ExternalLink,
  History,
  MonitorCog,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Swords,
  Tv,
  Users,
  X,
} from 'lucide-react';
import { Button } from '../../../ui/components/Button.jsx';
import { Field, Input, Select } from '../../../ui/components/Field.jsx';
import { useToast } from '../../../ui/components/Toast.jsx';
import { ClassFilterBar } from '../../../ui/components/ClassFilterBar.jsx';
import { SelectClassPrompt, LoadingCatState } from '../../../ui/components/WaitingCatIllustration.jsx';
import { listActiveStudentsByClass } from '../../../services/students.service.js';
import {
  advanceFinishTurn,
  advanceShowdownQuestion,
  cancelShowdownSession,
  createShowdownSession,
  dealFinishQuestion,
  finalizeCodeQuestion,
  getResponsesForQuestion,
  getRoundProgress,
  getShowdownPortalLink,
  getShowdownPresentLink,
  gradeCurrentQuestion,
  gradeOralQuestion,
  gradeShowdownCodeResponse,
  openShowdownLobby,
  resolveQuestionDeadlineMs,
  startShowdownGame,
  subscribeShowdownParticipants,
  subscribeShowdownResponses,
  subscribeShowdownSession,
  syncShowdownClassPointer,
} from '../../../services/showdown.service.js';
import {
  getQuestionFromSession,
  isLastQuestionInRound,
  isLastRound,
  isLastStartupQuestionForStudent,
  pickRandomSessionSelection,
  startupHasMoreStudents,
  validateSessionQuestionSelection,
} from '../../../lib/showdownQuestionEngine.js';
import { DEFAULT_SHOWDOWN_MATRIX } from '../../../data/showdownDefaultMatrix.js';
import { resolveSpeedBonusTiers } from '../../../lib/showdownSpeedBonus.js';
import { SHOWDOWN_SEED_BANK } from '../../../data/showdownSeedBank.js';
import { waitForShowdownStep, SHOWDOWN_SETTLE_MS } from '../../../lib/showdownSync.js';
import { useShowdownStepSync } from '../../../lib/useShowdownStepSync.js';
import { roundLabel } from '../../../lib/showdownConstants.js';
import { getErrorMessage } from '../../../lib/firestore.js';
import {
  listShowdownMatrices,
  listShowdownQuestions,
} from '../../../services/showdownBank.service.js';
import { GameConfetti } from './GameConfetti.jsx';
import { GamePresentationShell, useGamePresentation } from './GamePresentationShell.jsx';
import { ShowdownStage } from './ShowdownStage.jsx';
import { ShowdownBankManager } from './ShowdownBankManager.jsx';
import { ShowdownHistory } from './ShowdownHistory.jsx';
import { ShowdownSyncOverlay } from '../../../ui/components/games/ShowdownSyncOverlay.jsx';
import { ShowdownSessionQuestionPicker } from '../../../ui/components/games/ShowdownSessionQuestionPicker.jsx';

export function CodingShowdownGame({ classes, programs = [] }) {
  const toast = useToast();
  const { shellRef, presenting, togglePresentation } = useGamePresentation();

  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [creating, setCreating] = useState(false);
  const [matrices, setMatrices] = useState([]);
  const [selectedMatrixId, setSelectedMatrixId] = useState('');
  const [showBankManager, setShowBankManager] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [setupBank, setSetupBank] = useState(null);
  const [loadingSetupBank, setLoadingSetupBank] = useState(true);
  const [questionSelection, setQuestionSelection] = useState(null);

  const [sessionId, setSessionId] = useState(null);
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [responses, setResponses] = useState([]);
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const activeClasses = useMemo(() => classes.filter((c) => c.status === 'active'), [classes]);

  const loadMatrices = useCallback(() => {
    listShowdownMatrices()
      .then((list) => setMatrices(list))
      .catch(() => setMatrices([]));
  }, []);

  const loadSetupBank = useCallback(async () => {
    setLoadingSetupBank(true);
    try {
      let bank;
      try {
        const fsBank = await listShowdownQuestions();
        const hasFinishCode = fsBank.some(
          (q) => (q.round === 'finish' || q.bankRound === 'finish') && q.questionType === 'code',
        );
        bank = hasFinishCode ? fsBank : SHOWDOWN_SEED_BANK;
      } catch {
        bank = SHOWDOWN_SEED_BANK;
      }
      setSetupBank(bank);
      return bank;
    } finally {
      setLoadingSetupBank(false);
    }
  }, []);

  useEffect(() => {
    loadMatrices();
    loadSetupBank();
  }, [loadMatrices, loadSetupBank]);

  useEffect(() => {
    if (!setupBank) return;
    setQuestionSelection(pickRandomSessionSelection({ matrix: effectiveMatrix, bank: setupBank }));
  }, [setupBank, selectedMatrixId]); // eslint-disable-line react-hooks/exhaustive-deps -- re-roll when matrix template or bank changes

  const selectedMatrix = useMemo(() => {
    if (!selectedMatrixId) return DEFAULT_SHOWDOWN_MATRIX;
    return matrices.find((m) => m.id === selectedMatrixId) || DEFAULT_SHOWDOWN_MATRIX;
  }, [matrices, selectedMatrixId]);

  const [matchConfig, setMatchConfig] = useState(null);

  useEffect(() => {
    const r = selectedMatrix.rounds || {};
    setMatchConfig({
      startupCount: r.startup?.count ?? 5,
      startupSeconds: r.startup?.seconds ?? 5,
      startupPoints: r.startup?.points ?? 10,
      obstacleCount: r.obstacle?.count ?? 5,
      obstacleSeconds: r.obstacle?.seconds ?? 25,
      obstaclePoints: r.obstacle?.points ?? 20,
      obstacleSpeedBonusTiers: resolveSpeedBonusTiers(r.obstacle),
      finishSeconds: r.finish?.seconds ?? 90,
    });
  }, [selectedMatrix]);

  const effectiveMatrix = useMemo(() => {
    if (!matchConfig) return selectedMatrix;
    const rounds = selectedMatrix.rounds || {};
    return {
      ...selectedMatrix,
      rounds: {
        ...rounds,
        startup: {
          ...rounds.startup,
          count: matchConfig.startupCount,
          seconds: matchConfig.startupSeconds,
          points: matchConfig.startupPoints,
        },
        obstacle: {
          ...rounds.obstacle,
          count: matchConfig.obstacleCount,
          seconds: matchConfig.obstacleSeconds,
          points: matchConfig.obstaclePoints,
          speedBonusTiers: matchConfig.obstacleSpeedBonusTiers.map((n) => Math.max(0, Number(n) || 0)),
          speedBonus: matchConfig.obstacleSpeedBonusTiers[0] ?? 0,
        },
        finish: {
          ...rounds.finish,
          seconds: matchConfig.finishSeconds,
          questionTypes: ['code'],
        },
      },
    };
  }, [selectedMatrix, matchConfig]);

  const selectionValidation = useMemo(() => {
    if (!questionSelection) {
      return { valid: false, errors: ['Đang tải kho đề…'], warnings: [] };
    }
    return validateSessionQuestionSelection({
      matrix: effectiveMatrix,
      selection: questionSelection,
      studentCount: students.length,
    });
  }, [questionSelection, effectiveMatrix, students.length]);

  useEffect(() => {
    if (!activeClasses.length) {
      setSelectedClass('');
      return;
    }
    setSelectedClass((prev) => (prev && activeClasses.some((c) => c.classCode === prev) ? prev : ''));
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
    if (!sessionId) {
      setSession(null);
      return undefined;
    }
    return subscribeShowdownSession(sessionId, setSession, (err) => toast.error(getErrorMessage(err)));
  }, [sessionId, toast]);

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
    if (session?.status === 'finished') setShowConfetti(true);
  }, [session?.status]);

  // Keep the public class pointer in sync so students can auto-discover the room.
  useEffect(() => {
    if (!sessionId || !session?.status) return;
    syncShowdownClassPointer(sessionId).catch(() => {});
  }, [sessionId, session?.status]);

  const currentQuestion = useMemo(() => {
    if (!session) return null;
    return getQuestionFromSession(session, session.currentRound, session.questionIndex);
  }, [session]);

  const roundProgress = useMemo(() => (session ? getRoundProgress(session) : null), [session]);

  const currentResponses = useMemo(() => {
    if (!session) return [];
    let list = getResponsesForQuestion(responses, session.currentRound, session.questionIndex);
    // Finish round reuses questionIndex 0 for every student turn.
    if (session.currentRound === 'finish' && session.activeStudentId) {
      list = list.filter((r) => r.studentId === session.activeStudentId);
    }
    return list;
  }, [responses, session]);

  const submittedCount = currentResponses.length;
  const { syncing, syncMessage } = useShowdownStepSync(session);
  const controlsLocked = busy || syncing;
  const syncOverlayMessage = busy ? 'Đang đồng bộ với lớp…' : syncMessage;
  const joinedIds = useMemo(() => new Set(participants.map((p) => p.id)), [participants]);
  const notJoined = students.filter((s) => !joinedIds.has(s.id));
  const portalLink = sessionId && selectedClass ? getShowdownPortalLink(selectedClass, sessionId) : '';
  const presentLink = sessionId ? getShowdownPresentLink(sessionId) : '';

  const runAction = useCallback(
    async (fn, successMsg, { sync = 'skip' } = {}) => {
      if (!sessionId || busy || syncing) return;
      setBusy(true);
      const minVersion = (session?.stateVersion ?? 0) + 1;
      try {
        await fn();
        if (sync === 'full') {
          const result = await waitForShowdownStep(sessionId, { minVersion, minMs: SHOWDOWN_SETTLE_MS });
          if (!result.ok) {
            toast.error('Đồng bộ chậm — kiểm tra lại màn hình lớp.');
          }
        } else if (sync === 'light') {
          await new Promise((resolve) => {
            setTimeout(resolve, SHOWDOWN_SETTLE_MS);
          });
        }
        if (successMsg) toast.success(successMsg);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [sessionId, busy, syncing, session?.stateVersion, toast],
  );

  const handleCreate = async () => {
    if (!selectedClass) {
      toast.error('Chọn lớp trước.');
      return;
    }
    if (!selectionValidation.valid) {
      toast.error(selectionValidation.errors[0] || 'Bộ câu hỏi chưa hợp lệ.');
      return;
    }
    setCreating(true);
    try {
      const bank = setupBank || SHOWDOWN_SEED_BANK;
      const id = await createShowdownSession({
        classCode: selectedClass,
        matrix: effectiveMatrix,
        bank,
        selectedQuestionIds: questionSelection,
      });
      await openShowdownLobby(id);
      setSessionId(id);
      toast.success('Đã tạo phòng Coding Showdown.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(portalLink);
      toast.success('Đã copy link thi.');
    } catch {
      toast.error('Không copy được link.');
    }
  };

  const copyPresentLink = async () => {
    try {
      await navigator.clipboard.writeText(presentLink);
      toast.success('Đã copy link trình chiếu.');
    } catch {
      toast.error('Không copy được link.');
    }
  };

  const openPresentation = () => {
    if (presentLink) window.open(presentLink, '_blank', 'noopener');
  };

  const resetSetup = () => {
    setSessionId(null);
    setSession(null);
    setShowConfetti(false);
  };

  const isOral = session?.roundMode === 'oral';
  const isCodeQuestion = currentQuestion?.questionType === 'code';
  const isFinishRound = session?.currentRound === 'finish';
  const finishChoosing = isFinishRound && session?.finishStage === 'choosing';
  const finishHasMore =
    isFinishRound && (session?.finishQueueIndex || 0) < (session?.finishQueue?.length || 0) - 1;
  const oralNextLabel = !isOral || !session
    ? ''
    : !isLastStartupQuestionForStudent(session)
      ? 'Câu tiếp theo'
      : startupHasMoreStudents(session)
        ? 'Học sinh tiếp theo'
        : 'Sang vòng tiếp';

  const footer = session ? (
    <div className="flex flex-col gap-3 px-4 py-3">
      {session.status === 'lobby' && (
        <div className="flex justify-center">
          <Button
            disabled={controlsLocked || participants.length === 0}
            onClick={() => runAction(() => startShowdownGame(sessionId), 'Bắt đầu vòng Khởi động!', { sync: 'full' })}
          >
            <Play className="h-4 w-4" />
            Bắt đầu thi
          </Button>
        </div>
      )}

      {session.status === 'playing' && isOral && (
        <div className="space-y-2">
          {session.activeStudentId ? (
            <>
              <p className="text-center text-sm text-slate-300">
                Đang vấn đáp:{' '}
                <strong className="text-white">{session.activeStudentName}</strong>
                {roundProgress?.studentTotal ? (
                  <span className="text-slate-400">
                    {' '}· HS {roundProgress.studentIndex}/{roundProgress.studentTotal} · Câu{' '}
                    {roundProgress.current}/{roundProgress.total}
                  </span>
                ) : null}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="secondary"
                  disabled={controlsLocked}
                  className="border-green-400/60 bg-green-500/15 text-green-100 hover:bg-green-500/25"
                  onClick={() => runAction(() => gradeOralQuestion(sessionId, 'correct'), 'Đúng!')}
                >
                  <Check className="h-4 w-4" />
                  Đúng
                </Button>
                <Button
                  variant="secondary"
                  disabled={controlsLocked}
                  className="border-red-400/60 bg-red-500/15 text-red-100 hover:bg-red-500/25"
                  onClick={() => runAction(() => gradeOralQuestion(sessionId, 'wrong'), 'Chưa đúng')}
                >
                  <X className="h-4 w-4" />
                  Sai
                </Button>
                <Button
                  variant="secondary"
                  disabled={controlsLocked}
                  onClick={() => runAction(() => gradeOralQuestion(sessionId, 'skip'), 'Đã bỏ qua')}
                >
                  <SkipForward className="h-4 w-4" />
                  Bỏ qua
                </Button>
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-slate-500">Chưa có học sinh trong hàng chờ.</p>
          )}
        </div>
      )}

      {session.status === 'playing' && finishChoosing && (
        <div className="space-y-2">
          <p className="text-center text-sm text-slate-300">
            <strong className="text-white">{session.activeStudentName || 'Học sinh'}</strong> chọn gói điểm —
            bấm đúng gói bạn ấy công bố để phát đề & bắt đầu đếm giờ:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[10, 20, 30].map((pts) => (
              <Button
                key={pts}
                disabled={controlsLocked}
                className="min-w-24"
                onClick={() => runAction(() => dealFinishQuestion(sessionId, pts), `Đã phát đề gói ${pts}đ`)}
              >
                Gói {pts}đ
                <span className="ml-1 text-xs opacity-80">
                  ({pts === 10 ? 'Dễ' : pts === 20 ? 'TB' : 'Khó'})
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {session.status === 'playing' && !isOral && !isCodeQuestion && !finishChoosing && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="text-sm text-slate-400">
            Đã nộp: {submittedCount}/{isFinishRound ? 1 : participants.length}
          </span>
          <Button
            variant="secondary"
            disabled={controlsLocked}
            className={
              submittedCount > 0 ? 'ring-2 ring-amber-400 ring-offset-2 dark:ring-offset-slate-900' : ''
            }
            onClick={() => runAction(() => gradeCurrentQuestion(sessionId), 'Đã công bố đáp án')}
          >
            <CheckCircle2 className="h-4 w-4" />
            Công bố đáp án
          </Button>
        </div>
      )}

      {session.status === 'playing' && !isOral && isCodeQuestion && (
        <div className="space-y-2">
          <p className="text-center text-sm font-semibold text-cyan-200">
            <Code2 className="mr-1 inline h-4 w-4" />
            Chấm code — {session.activeStudentName || 'Học sinh'}
            {isFinishRound && session.finishChoice ? (
              <span className="ml-1 text-amber-200">· Gói {session.finishChoice}đ</span>
            ) : null}
            {' · '}
            {submittedCount > 0 ? 'Đã nộp bài' : 'Chưa nộp bài'}
          </p>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {currentResponses.length === 0 && (
              <p className="text-center text-sm text-slate-500">Chưa có bài nộp.</p>
            )}
            {currentResponses.map((r) => {
              const graded = r.isCorrect !== null && r.isCorrect !== undefined;
              const isMarkedCorrect = r.isCorrect === true;
              const isMarkedWrong = r.isCorrect === false;
              return (
              <div
                key={r.studentId}
                className={`rounded-xl border-2 p-3 ${
                  isMarkedCorrect
                    ? 'border-green-500/70 bg-green-500/15'
                    : isMarkedWrong
                      ? 'border-red-500/70 bg-red-500/15'
                      : 'border-amber-400/50 bg-slate-900/60'
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="text-sm text-white">{r.studentName}</strong>
                    {graded ? (
                      <span
                        className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                          isMarkedCorrect
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                        }`}
                      >
                        {isMarkedCorrect ? `✓ ĐÚNG · +${r.pointsEarned}đ` : '✗ SAI · 0đ'}
                      </span>
                    ) : (
                      <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-200">
                        Chưa chấm
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      size="sm"
                      disabled={controlsLocked}
                      className={`border-0 text-white ${
                        isMarkedCorrect
                          ? 'bg-green-600 ring-2 ring-green-300'
                          : 'bg-green-600/80 hover:bg-green-600'
                      }`}
                      onClick={() =>
                        runAction(
                          () => gradeShowdownCodeResponse(sessionId, r.studentId, true),
                          'Đã chấm đúng',
                          { sync: 'light' },
                        )
                      }
                    >
                      <Check className="h-4 w-4" />
                      Đúng
                    </Button>
                    <Button
                      size="sm"
                      disabled={controlsLocked}
                      className={`border-0 text-white ${
                        isMarkedWrong
                          ? 'bg-red-600 ring-2 ring-red-300'
                          : 'bg-red-600/80 hover:bg-red-600'
                      }`}
                      onClick={() =>
                        runAction(
                          () => gradeShowdownCodeResponse(sessionId, r.studentId, false),
                          'Đã chấm sai',
                          { sync: 'light' },
                        )
                      }
                    >
                      <X className="h-4 w-4" />
                      Sai
                    </Button>
                  </div>
                </div>
                <pre className="max-h-40 overflow-auto rounded-lg border border-slate-700 bg-black/70 p-3 text-left text-xs text-emerald-300">
                  <code>{r.textAnswer || '(trống)'}</code>
                </pre>
              </div>
            );
            })}
          </div>
          <div className="flex justify-center">
            <Button
              disabled={controlsLocked}
              onClick={() => runAction(() => finalizeCodeQuestion(sessionId), 'Đã hoàn tất chấm')}
            >
              <CheckCircle2 className="h-4 w-4" />
              Hoàn tất chấm & tiếp tục
            </Button>
          </div>
        </div>
      )}

      {session.status === 'reveal' && (
        <div className="flex justify-center">
          {isFinishRound && finishHasMore ? (
            <Button disabled={controlsLocked} onClick={() => runAction(() => advanceFinishTurn(sessionId), 'Lượt tiếp theo')}>
              <SkipForward className="h-4 w-4" />
              Học sinh tiếp theo
            </Button>
          ) : isOral ? (
            <Button
              disabled={controlsLocked}
              onClick={() =>
                runAction(
                  () => advanceShowdownQuestion(sessionId),
                  oralNextLabel === 'Sang vòng tiếp' ? 'Sang vòng tiếp theo' : oralNextLabel,
                )
              }
            >
              <SkipForward className="h-4 w-4" />
              {oralNextLabel}
            </Button>
          ) : (
            <Button
              disabled={controlsLocked}
              onClick={() => {
                const isLast = isLastQuestionInRound(session) && isLastRound(session);
                runAction(
                  () => (isFinishRound ? advanceFinishTurn(sessionId) : advanceShowdownQuestion(sessionId)),
                  isLast ? 'Kết thúc!' : 'Tiếp tục',
                );
              }}
            >
              <SkipForward className="h-4 w-4" />
              {isLastQuestionInRound(session) && isLastRound(session) ? 'Kết thúc' : 'Câu / vòng tiếp'}
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {session.status !== 'finished' && (
          <Button
            variant="danger"
            size="sm"
            disabled={controlsLocked}
            onClick={() =>
              runAction(async () => {
                await cancelShowdownSession(sessionId);
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
    </div>
  ) : null;

  if (sessionId && session) {
    return (
      <div className="space-y-4">
        {showConfetti && session.status === 'finished' && <GameConfetti />}

        {!presenting && (
          <div className="flex flex-col gap-2 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white">
                <MonitorCog className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                  Màn hình GIÁO VIÊN · Bảng điều khiển
                </p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                  Bấm các nút bên dưới để điều khiển game. Mở “Màn trình chiếu” trên cửa sổ/máy chiếu cho cả lớp xem.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={openPresentation}
              >
                <ExternalLink className="h-4 w-4" />
                Mở màn trình chiếu
              </Button>
              <Button variant="secondary" size="sm" onClick={copyPresentLink}>
                <Tv className="h-4 w-4" />
                Copy link chiếu
              </Button>
            </div>
          </div>
        )}

        <div className="relative">
          <ShowdownSyncOverlay
            show={syncing}
            message={syncOverlayMessage}
            compact={presenting}
          />
          <GamePresentationShell
          shellRef={shellRef}
          presenting={presenting}
          onTogglePresentation={togglePresentation}
          stageBorder="border-cyan-500/30"
          stageMinHeight="min-h-[420px] sm:min-h-[500px]"
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              {presenting ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-300">
                  <Tv className="h-4 w-4" />
                  Màn hình trình chiếu
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-700/60 px-2.5 py-1 text-xs font-semibold text-slate-300">
                  <Tv className="h-4 w-4" />
                  Xem trước trình chiếu
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                <Swords className="h-4 w-4" />
                Coding Showdown
              </span>
              <span className="text-xs text-slate-400">
                {selectedClass} · {participants.length} HS · {roundLabel(session.currentRound)}
              </span>
              {!presenting && (
                <Button variant="subtle" size="sm" onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                  Copy link
                </Button>
              )}
            </div>
          }
          footer={footer}
        >
          <ShowdownStage
            session={session}
            question={currentQuestion}
            participants={participants}
            roundProgress={roundProgress}
            countdown={countdown}
            submittedCount={submittedCount}
            totalCount={isFinishRound ? 1 : participants.length}
            presenting={presenting}
          />
        </GamePresentationShell>
        </div>

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
                Link màn trình chiếu (máy chiếu)
              </h4>
              <p className="break-all text-xs text-amber-600 dark:text-amber-300">{presentLink}</p>
            </div>
            <div className="sm:col-span-2">
              <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Chưa vào phòng ({notJoined.length})
              </h4>
              <p className="text-xs text-slate-500">
                {notJoined.length ? notJoined.map((s) => s.fullName).join(', ') : 'Tất cả đã tham gia'}
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
          title="Chọn lớp để bắt đầu Coding Showdown"
          description="Chọn lớp để mở phòng thi đấu lập trình."
        />
      ) : (
        <>
          <div className="card space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-300">
                <Swords className="h-5 w-5" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                  Coding Showdown — Python Basic
                </h3>
              </div>
              <div className="ml-auto flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowBankManager(true)}>
                  <Database className="h-4 w-4" />
                  Kho đề
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShowHistory(true)}>
                  <History className="h-4 w-4" />
                  Lịch sử
                </Button>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Gameshow 3 vòng: <strong>Khởi động</strong> (vấn đáp, GV chấm trực tiếp) ·{' '}
              <strong>Vượt chướng ngại vật</strong> (trắc nghiệm + thưởng tốc độ) ·{' '}
              <strong>Về đích</strong> (chọn mức điểm 10/20/30).
            </p>
            <Field label="Ma trận đề">
              <Select value={selectedMatrixId} onChange={(e) => setSelectedMatrixId(e.target.value)}>
                <option value="">{DEFAULT_SHOWDOWN_MATRIX.name} (mặc định)</option>
                {matrices
                  .filter((m) => m.id !== DEFAULT_SHOWDOWN_MATRIX.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>

          {matchConfig && (
            <div className="card space-y-4 p-4">
              <div className="flex items-center gap-2">
                <MonitorCog className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                  Cấu hình trận đấu (áp dụng khi tạo phòng)
                </h3>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="mb-2 text-sm font-semibold text-cyan-700 dark:text-cyan-300">
                  Vòng 1 · Khởi động (vấn đáp)
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Số câu / học sinh">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={matchConfig.startupCount}
                      onChange={(e) =>
                        setMatchConfig((c) => ({ ...c, startupCount: Math.max(1, Number(e.target.value) || 1) }))
                      }
                    />
                  </Field>
                  <Field label="Thời gian / câu (s)">
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={matchConfig.startupSeconds}
                      onChange={(e) =>
                        setMatchConfig((c) => ({ ...c, startupSeconds: Math.max(1, Number(e.target.value) || 1) }))
                      }
                    />
                  </Field>
                  <Field label="Điểm / câu">
                    <Input
                      type="number"
                      min={1}
                      value={matchConfig.startupPoints}
                      onChange={(e) =>
                        setMatchConfig((c) => ({ ...c, startupPoints: Math.max(1, Number(e.target.value) || 1) }))
                      }
                    />
                  </Field>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="mb-2 text-sm font-semibold text-cyan-700 dark:text-cyan-300">
                  Vòng 2 · Vượt chướng ngại vật
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Số câu">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={matchConfig.obstacleCount}
                      onChange={(e) =>
                        setMatchConfig((c) => ({ ...c, obstacleCount: Math.max(1, Number(e.target.value) || 1) }))
                      }
                    />
                  </Field>
                  <Field label="Thời gian / câu (s)">
                    <Input
                      type="number"
                      min={5}
                      max={300}
                      value={matchConfig.obstacleSeconds}
                      onChange={(e) =>
                        setMatchConfig((c) => ({ ...c, obstacleSeconds: Math.max(5, Number(e.target.value) || 5) }))
                      }
                    />
                  </Field>
                  <Field label="Điểm / câu">
                    <Input
                      type="number"
                      min={1}
                      value={matchConfig.obstaclePoints}
                      onChange={(e) =>
                        setMatchConfig((c) => ({ ...c, obstaclePoints: Math.max(1, Number(e.target.value) || 1) }))
                      }
                    />
                  </Field>
                </div>
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Thưởng nộp nhanh (điểm cộng thêm theo hạng nộp đúng sớm)
                  </p>
                  <div className="space-y-2">
                    {matchConfig.obstacleSpeedBonusTiers.map((pts, index) => (
                      <div key={`speed-tier-${index}`} className="flex items-center gap-2">
                        <span className="w-20 shrink-0 text-xs text-slate-500">Hạng {index + 1}</span>
                        <Input
                          type="number"
                          min={0}
                          className="max-w-[6rem]"
                          value={pts}
                          onChange={(e) => {
                            const value = Math.max(0, Number(e.target.value) || 0);
                            setMatchConfig((c) => {
                              const tiers = [...c.obstacleSpeedBonusTiers];
                              tiers[index] = value;
                              return { ...c, obstacleSpeedBonusTiers: tiers };
                            });
                          }}
                        />
                        <span className="text-xs text-slate-400">đ</span>
                        {matchConfig.obstacleSpeedBonusTiers.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-red-500"
                            onClick={() => {
                              setMatchConfig((c) => ({
                                ...c,
                                obstacleSpeedBonusTiers: c.obstacleSpeedBonusTiers.filter((_, i) => i !== index),
                              }));
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setMatchConfig((c) => ({
                        ...c,
                        obstacleSpeedBonusTiers: [...c.obstacleSpeedBonusTiers, 0],
                      }));
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Thêm hạng
                  </Button>
                  <p className="text-xs text-slate-400">
                    Chỉ học sinh trả lời đúng mới được xếp hạng tốc độ. Ví dụ [5, 4, 3]: nhanh nhất +5đ,
                    thứ 2 +4đ, thứ 3 +3đ; từ hạng 4 trở đi không cộng thêm.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="mb-2 text-sm font-semibold text-cyan-700 dark:text-cyan-300">
                  Vòng 3 · Về đích (viết code — GV chấm)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Thời gian / câu (s)">
                    <Input
                      type="number"
                      min={10}
                      max={600}
                      value={matchConfig.finishSeconds}
                      onChange={(e) =>
                        setMatchConfig((c) => ({ ...c, finishSeconds: Math.max(10, Number(e.target.value) || 10) }))
                      }
                    />
                  </Field>
                  <div className="flex items-end text-xs text-slate-400">
                    Gói 10đ → câu Dễ · 20đ → câu TB · 30đ → câu Khó (mỗi gói một câu khác nhau).
                  </div>
                </div>
              </div>
            </div>
          )}

          {loadingSetupBank || !questionSelection ? (
            <LoadingCatState message="Đang tải kho đề…" />
          ) : (
            <ShowdownSessionQuestionPicker
              matrix={effectiveMatrix}
              bank={setupBank || SHOWDOWN_SEED_BANK}
              selection={questionSelection}
              onChange={setQuestionSelection}
              studentCount={students.length}
            />
          )}

          <div className="flex items-center gap-3">
            <Button
              disabled={
                creating
                || students.length === 0
                || loadingSetupBank
                || !selectionValidation.valid
              }
              onClick={handleCreate}
            >
              <Users className="h-4 w-4" />
              {creating ? 'Đang tạo...' : `Tạo phòng Coding Showdown (${students.length} HS)`}
            </Button>
          </div>
        </>
      )}

      {showBankManager && (
        <ShowdownBankManager
          onClose={() => {
            setShowBankManager(false);
            loadMatrices();
            loadSetupBank();
          }}
        />
      )}
      {showHistory && (
        <ShowdownHistory classCode={selectedClass} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}
