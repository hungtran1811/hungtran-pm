import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Home, Mic, Send, Smartphone, Swords, XCircle } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Input } from '../../ui/components/Field.jsx';
import { CodeQuestionPanel } from '../../ui/components/CodeQuestionPanel.jsx';
import { Spinner } from '../../ui/components/Spinner.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { responseDocId, roundLabel, SHOWDOWN_ROUNDS } from '../../lib/showdownConstants.js';
import { formatSpeedBonusTierList, hasSpeedBonus, resolveSpeedBonusTiers } from '../../lib/showdownSpeedBonus.js';
import { getQuestionFromSession } from '../../lib/showdownQuestionEngine.js';
import { useShowdownStepSync } from '../../lib/useShowdownStepSync.js';
import { mapShowdownJoinError } from '../../lib/showdownSync.js';
import { getErrorMessage } from '../../lib/firestore.js';
import { ShowdownLeaderboard } from '../../ui/components/games/ShowdownLeaderboard.jsx';
import { ShowdownSyncOverlay } from '../../ui/components/games/ShowdownSyncOverlay.jsx';
import {
  ShowdownQuestionBody,
  ShowdownQuestionMetaBar,
} from '../../ui/components/games/ShowdownSessionUi.jsx';
import {
  assignParticipantRanks,
  getRoundProgress,
  isShowdownTimerWaiting,
  joinShowdownSession,
  resolveQuestionDeadlineMs,
  submitShowdownResponse,
  subscribeShowdownParticipants,
  subscribeShowdownResponse,
  subscribeShowdownSession,
} from '../../services/showdown.service.js';

function submissionStorageKey(sessionId, studentId) {
  return `showdown-submission:${sessionId}:${studentId}`;
}

function readLocalSubmission(sessionId, studentId, round, questionIndex) {
  if (!sessionId || !studentId || round == null || questionIndex == null) return null;
  try {
    const raw = localStorage.getItem(submissionStorageKey(sessionId, studentId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.responseId !== responseDocId(studentId, round, questionIndex)) return null;
    return data;
  } catch {
    return null;
  }
}

function writeLocalSubmission(sessionId, studentId, round, questionIndex, payload) {
  localStorage.setItem(
    submissionStorageKey(sessionId, studentId),
    JSON.stringify({ responseId: responseDocId(studentId, round, questionIndex), ...payload }),
  );
}

function formatCountdownMs(endMs) {
  if (!endMs) return '--:--';
  const sec = Math.max(0, Math.ceil((endMs - Date.now()) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ShowdownStudentView({ sessionId, classCode, student, onExit }) {
  const toast = useToast();
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [serverResponse, setServerResponse] = useState(null);
  const [localSubmission, setLocalSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [codeAnswer, setCodeAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState('--:--');

  useEffect(() => {
    if (!sessionId) return undefined;
    setLoading(true);
    return subscribeShowdownSession(
      sessionId,
      (data) => {
        setSession(data);
        setLoading(false);
      },
      (err) => {
        const message =
          err?.code === 'permission-denied'
            ? 'Không tìm thấy phòng thi hoặc phòng không thuộc lớp này.'
            : getErrorMessage(err);
        toast.error(message);
        setLoading(false);
      },
    );
  }, [sessionId, toast]);

  useEffect(() => {
    if (!sessionId) return undefined;
    return subscribeShowdownParticipants(sessionId, setParticipants, () => {});
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !student?.id || !session) {
      setServerResponse(null);
      return undefined;
    }
    if (session.status !== 'reveal' && session.status !== 'finished') {
      setServerResponse(null);
      return undefined;
    }
    const respId = responseDocId(student.id, session.currentRound, session.questionIndex);
    return subscribeShowdownResponse(sessionId, respId, setServerResponse, () => {});
  }, [sessionId, student?.id, session?.status, session?.currentRound, session?.questionIndex]);

  useEffect(() => {
    if (!sessionId || !student?.id || !session) {
      setLocalSubmission(null);
      return;
    }
    setLocalSubmission(
      readLocalSubmission(sessionId, student.id, session.currentRound, session.questionIndex),
    );
  }, [sessionId, student?.id, session?.currentRound, session?.questionIndex]);

  useEffect(() => {
    if (!sessionId || !student?.id || !session) return undefined;

    const joinable = ['lobby', 'playing', 'reveal'];
    if (!joinable.includes(session.status)) return undefined;

    if (classCode && session.classCode && session.classCode !== classCode) return undefined;

    let cancelled = false;
    setJoining(true);
    joinShowdownSession(sessionId, { studentId: student.id, studentName: student.fullName })
      .catch((err) => {
        if (!cancelled) toast.error(mapShowdownJoinError(session, err, { classCode }));
      })
      .finally(() => {
        if (!cancelled) setJoining(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, student?.id, student?.fullName, session, session?.status, session?.classCode, classCode, toast]);

  useEffect(() => {
    const end = resolveQuestionDeadlineMs(session);
    if (session?.status !== 'playing' || !end) {
      setCountdown('--:--');
      return undefined;
    }
    const tick = () => setCountdown(formatCountdownMs(end));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [session?.status, session?.serverStartedAt, session?.questionDeadlineAt, session?.questionDurationSeconds]);

  useEffect(() => {
    setSelectedOption(null);
    setTextAnswer('');
  }, [session?.currentRound, session?.questionIndex, session?.status]);

  const myParticipant = useMemo(
    () => participants.find((p) => p.id === student?.id) || null,
    [participants, student?.id],
  );

  const currentQuestion = useMemo(() => {
    if (!session) return null;
    return getQuestionFromSession(session, session.currentRound, session.questionIndex);
  }, [session]);

  const roundProgress = useMemo(() => (session ? getRoundProgress(session) : null), [session]);

  const { syncing, syncMessage } = useShowdownStepSync(session);

  useEffect(() => {
    setCodeAnswer(currentQuestion?.questionType === 'code' ? currentQuestion.starterCode || '' : '');
  }, [currentQuestion?.id, currentQuestion?.questionType, currentQuestion?.starterCode]);

  const myResponse = useMemo(() => {
    if (serverResponse) return serverResponse;
    if (!localSubmission) return null;
    return {
      id: localSubmission.responseId,
      selectedOption: localSubmission.selectedOption,
      textAnswer: localSubmission.textAnswer ?? null,
      finishChoice: localSubmission.finishChoice ?? null,
      isCorrect: null,
      pointsEarned: 0,
    };
  }, [serverResponse, localSubmission]);

  const isOral = session?.roundMode === 'oral';
  const isShortAnswer = currentQuestion?.questionType === 'short_answer';
  const isCode = currentQuestion?.questionType === 'code';
  const isObstacleRound = session?.currentRound === 'obstacle';
  const isFinishRound = session?.currentRound === 'finish';
  const finishStage = session?.finishStage || null;
  const sessionFinishChoice = session?.finishChoice ?? null;
  const isMyTurn = !isFinishRound || session?.activeStudentId === student?.id;
  const revealedIndex = session?.revealedAnswer?.correctIndex;
  const revealedCorrectText = session?.revealedAnswer?.correctText;
  const obstacleBasePoints =
    session?.config?.matrix?.rounds?.obstacle?.points ?? SHOWDOWN_ROUNDS.obstacle.basePoints ?? 20;
  const obstacleSpeedBonusTiers = useMemo(
    () => resolveSpeedBonusTiers(session?.config?.matrix?.rounds?.obstacle),
    [session?.config?.matrix?.rounds?.obstacle],
  );
  const speedBonusEarned =
    myResponse?.isCorrect && isObstacleRound
      ? Math.max(0, (myResponse.pointsEarned || 0) - obstacleBasePoints)
      : 0;
  const showQuestion = !isFinishRound
    ? true
    : Boolean(myResponse) || (finishStage === 'answering' && Boolean(currentQuestion));

  const handleSubmit = useCallback(async () => {
    if (!session || !student || submitting) return;
    const hasAnswer = isCode
      ? codeAnswer.trim()
      : isShortAnswer
        ? textAnswer.trim()
        : selectedOption !== null;
    if (!hasAnswer) return;
    if (isFinishRound && sessionFinishChoice == null) {
      toast.error('Chờ giáo viên phát đề theo gói điểm bạn chọn.');
      return;
    }
    const submittedText = isCode ? codeAnswer : isShortAnswer ? textAnswer.trim() : null;
    const submittedOption = isCode || isShortAnswer ? null : selectedOption;
    setSubmitting(true);
    try {
      await submitShowdownResponse(sessionId, {
        studentId: student.id,
        studentName: student.fullName,
        round: session.currentRound,
        questionIndex: session.questionIndex,
        questionId: currentQuestion?.id,
        selectedOption: submittedOption,
        textAnswer: submittedText,
        finishChoice: isFinishRound ? sessionFinishChoice : null,
        roundStartedAt: session.roundStartedAt,
      });
      writeLocalSubmission(sessionId, student.id, session.currentRound, session.questionIndex, {
        selectedOption: submittedOption,
        textAnswer: submittedText,
        finishChoice: isFinishRound ? sessionFinishChoice : null,
        isCode,
      });
      setLocalSubmission(
        readLocalSubmission(sessionId, student.id, session.currentRound, session.questionIndex),
      );
      toast.success('Đã nộp câu trả lời!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }, [session, student, selectedOption, textAnswer, codeAnswer, isShortAnswer, isCode, submitting, isFinishRound, sessionFinishChoice, sessionId, currentQuestion?.id, toast]);

  if (loading || joining) {
    return (
      <div className="card flex items-center justify-center gap-3 p-8">
        <Spinner />
        <span className="text-sm text-slate-500">Đang vào phòng Coding Showdown...</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="card p-6 text-center text-sm text-slate-500">
        Không tìm thấy phòng thi.
        {onExit && (
          <Button variant="subtle" size="sm" className="mt-3" onClick={onExit}>
            Quay lại
          </Button>
        )}
      </div>
    );
  }

  if (classCode && session.classCode && session.classCode !== classCode) {
    return (
      <div className="card space-y-3 p-6 text-center text-sm text-slate-600 dark:text-slate-300">
        <p>Phòng thi không thuộc lớp học này.</p>
        {onExit && (
          <Button variant="subtle" size="sm" onClick={onExit}>
            Quay lại
          </Button>
        )}
      </div>
    );
  }

  if (session.status === 'draft') {
    return (
      <div className="space-y-4">
        <StudentScreenBadge />
        <div className="card space-y-3 p-6 text-center">
          <Spinner className="mx-auto" />
          <p className="text-sm text-slate-600 dark:text-slate-300">Chờ giáo viên mở phòng…</p>
        </div>
      </div>
    );
  }

  if (session.status === 'finished') {
    const ranked = assignParticipantRanks(participants);
    const myEntry = ranked.find((p) => p.id === student?.id);
    return (
      <div className="space-y-4">
        <StudentScreenBadge studentName={student?.fullName} />
        <div className="card overflow-hidden bg-gradient-to-br from-slate-900 to-brand-950 p-6 text-white">
          <div className="mb-4 flex items-center gap-2">
            <Swords className="h-6 w-6 text-cyan-400" />
            <h2 className="text-xl font-bold">Coding Showdown — Kết thúc</h2>
          </div>
          {myParticipant && (
            <div className="mb-4 rounded-xl bg-white/10 px-4 py-3">
              <p className="text-sm text-white/70">Kết quả của bạn</p>
              <p className="text-3xl font-bold text-amber-300">{myParticipant.totalScore} điểm</p>
              {myEntry && (
                <p className="text-sm text-white/80">Hạng {myEntry.rank} / {participants.length}</p>
              )}
            </div>
          )}
          <div style={{ height: '20rem' }}>
            <ShowdownLeaderboard participants={participants} highlightId={student?.id} title="Toàn lớp" />
          </div>
        </div>
        {onExit && (
          <Button
            variant="primary"
            size="lg"
            className="w-full gap-2 text-base font-bold shadow-lg"
            onClick={onExit}
          >
            <Home className="h-5 w-5" />
            Quay lại trang lớp học
          </Button>
        )}
      </div>
    );
  }

  if (session.status === 'lobby') {
    return (
      <div className="space-y-4">
        <StudentScreenBadge />
        <div className="card space-y-4 p-6">
          <div className="flex items-center gap-2 text-brand-600 dark:text-brand-300">
            <Swords className="h-6 w-6" />
            <h2 className="text-lg font-bold">Phòng chờ Coding Showdown</h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Bạn đã vào phòng. Chờ giáo viên bắt đầu vòng <strong>Khởi động</strong>.
          </p>
          <p className="text-center text-2xl font-bold text-slate-800 dark:text-slate-100">
            {participants.length} thí sinh đã sẵn sàng
          </p>
          <p className="text-center text-xs text-slate-400">
            Khi đã vào phòng, bạn sẽ ở lại đến hết trận. Chờ giáo viên bắt đầu nhé!
          </p>
        </div>
      </div>
    );
  }

  const deadlineMsValue = resolveQuestionDeadlineMs(session);
  const timerWaiting = isShowdownTimerWaiting(session);
  const timeExpired =
    session.status === 'playing' &&
    deadlineMsValue > 0 &&
    Date.now() > deadlineMsValue;

  return (
    <div className="space-y-4">
      <StudentScreenBadge studentName={student?.fullName} />
      <div className="card overflow-hidden border-2 border-brand-500/30 p-0">
        <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3 text-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isOral ? <Mic className="h-5 w-5" /> : <Swords className="h-5 w-5" />}
              <span className="font-bold">{roundLabel(session.currentRound)}</span>
            </div>
            {session.status === 'playing' && (
              <span className="flex items-center gap-1 font-mono text-lg font-bold tabular-nums">
                <Clock className="h-4 w-4" />
                {timerWaiting ? 'Chờ GV' : countdown}
              </span>
            )}
          </div>
          {myParticipant && (
            <p className="mt-1 text-sm text-brand-100">Điểm của bạn: {myParticipant.totalScore}</p>
          )}
        </div>

        <div className="relative p-4">
          <ShowdownSyncOverlay show={syncing} message={syncMessage} compact />
          {isOral ? (
            <OralStudentPanel session={session} student={student} question={currentQuestion} />
          ) : isFinishRound && !isMyTurn ? (
            <div className="rounded-xl bg-slate-100 px-4 py-6 text-center dark:bg-slate-800">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Đang đến lượt <strong>{session.activeStudentName || 'bạn khác'}</strong> về đích.
              </p>
              <p className="mt-1 text-xs text-slate-400">Chờ tới lượt của bạn...</p>
            </div>
          ) : isFinishRound && finishStage === 'choosing' && !myResponse ? (
            <div className="space-y-4 rounded-xl border-2 border-amber-300/60 bg-amber-50 px-4 py-6 text-center dark:bg-amber-500/10">
              <p className="text-base font-bold text-amber-800 dark:text-amber-200">
                Tới lượt bạn về đích!
              </p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Hãy công bố gói điểm bạn chọn cho giáo viên:
              </p>
              <div className="grid grid-cols-3 gap-2">
                {SHOWDOWN_ROUNDS.finish.pointChoices.map((pts) => (
                  <div
                    key={pts}
                    className="rounded-xl border-2 border-amber-300 bg-white py-4 text-center font-bold text-amber-700 dark:bg-slate-900 dark:text-amber-200"
                  >
                    {pts} đ
                    <span className="block text-[11px] font-normal text-slate-400">
                      {pts === 10 ? 'Dễ' : pts === 20 ? 'TB' : 'Khó'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400">
                Giáo viên sẽ phát đề và bắt đầu đếm giờ sau khi bạn chọn.
              </p>
            </div>
          ) : !currentQuestion ? (
            <p className="text-center text-sm text-slate-500">Đang chờ câu hỏi...</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {isFinishRound
                    ? `Gói ${sessionFinishChoice ?? '—'}đ`
                    : roundProgress
                      ? `Câu ${roundProgress.current}/${roundProgress.total}`
                      : `Câu ${session.questionIndex + 1}`}
                </p>
                {session.currentRound === 'startup' && roundProgress?.studentTotal ? (
                  <p className="text-xs text-slate-400">
                    HS {roundProgress.studentIndex}/{roundProgress.studentTotal}
                  </p>
                ) : null}
              </div>

              {currentQuestion && showQuestion && (
                <div className="mb-3">
                  <ShowdownQuestionMetaBar question={currentQuestion} variant="light" />
                </div>
              )}

              {isObstacleRound && session.status === 'playing' && !myResponse && hasSpeedBonus(obstacleSpeedBonusTiers) && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  <p className="font-semibold">⚡ Thưởng nộp nhanh (vòng 2)</p>
                  <p className="mt-1 text-amber-800/90 dark:text-amber-100/90">
                    Trả lời <strong>đúng</strong> và nộp sớm trong số cả lớp sẽ được cộng thêm điểm:{' '}
                    {formatSpeedBonusTierList(obstacleSpeedBonusTiers)}.
                  </p>
                </div>
              )}

              {showQuestion && (
                <>
                  <ShowdownQuestionBody question={currentQuestion} variant="light" />

                  {myResponse ? (
                    <div className="rounded-xl bg-slate-100 px-4 py-3 text-center dark:bg-slate-800">
                      {isCode ? (
                        <>
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            Đã nộp code của bạn — chờ giáo viên chấm.
                          </p>
                          {myResponse.textAnswer && (
                            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-900 p-3 text-left text-xs text-emerald-300">
                              <code>{myResponse.textAnswer}</code>
                            </pre>
                          )}
                          {myResponse.finishChoice ? (
                            <p className="mt-1 text-sm text-slate-500">Mức {myResponse.finishChoice} đ</p>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          {myResponse.textAnswer != null && myResponse.textAnswer !== ''
                            ? `Bạn đã trả lời: ${myResponse.textAnswer}`
                            : `Bạn đã chọn: ${String.fromCharCode(65 + myResponse.selectedOption)}`}
                          {myResponse.finishChoice ? ` · Mức ${myResponse.finishChoice} đ` : ''}
                        </p>
                      )}
                      {session.status === 'reveal' && myResponse.isCorrect !== null && (
                        <p
                          className={`mt-2 flex items-center justify-center gap-1 font-bold ${
                            myResponse.isCorrect ? 'text-green-600' : 'text-red-500'
                          }`}
                        >
                          {myResponse.isCorrect ? (
                            <>
                              <CheckCircle2 className="h-5 w-5" /> +{myResponse.pointsEarned} điểm
                            </>
                          ) : (
                            <>
                              <XCircle className="h-5 w-5" /> Sai — 0 điểm
                            </>
                          )}
                        </p>
                      )}
                      {session.status === 'reveal' && myResponse.isCorrect && isObstacleRound && (
                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">
                          {speedBonusEarned > 0
                            ? `Điểm cơ bản ${obstacleBasePoints} + thưởng tốc độ ${speedBonusEarned} = ${myResponse.pointsEarned} đ`
                            : `Điểm cơ bản ${obstacleBasePoints} (không có thưởng tốc độ)`}
                        </p>
                      )}
                      {session.status === 'reveal' && revealedIndex != null && (
                        <p className="mt-1 text-xs text-slate-500">
                          Đáp án đúng: {String.fromCharCode(65 + revealedIndex)}
                        </p>
                      )}
                      {session.status === 'reveal' && revealedIndex == null && revealedCorrectText && (
                        <p className="mt-1 text-xs text-slate-500">
                          Đáp án đúng: <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">{revealedCorrectText}</code>
                        </p>
                      )}
                      {session.status === 'playing' && myResponse && isObstacleRound && (
                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">
                          ✓ Đã nộp! Thưởng tốc độ sẽ được tính theo thứ hạng nộp bài trong số bạn trả lời đúng.
                        </p>
                      )}
                      {session.status === 'playing' && myResponse && !isObstacleRound && (
                        <p className="mt-1 text-xs text-slate-400">Chờ giáo viên công bố đáp án...</p>
                      )}
                    </div>
                  ) : session.status === 'playing' && timerWaiting ? (
                    <p className="rounded-xl bg-amber-50 px-4 py-6 text-center text-sm font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                      Chờ giáo viên bắt đầu đếm giờ...
                    </p>
                  ) : session.status === 'playing' && !timeExpired && isCode ? (
                    <div className="space-y-2">
                      <CodeQuestionPanel
                        value={codeAnswer}
                        onChange={setCodeAnswer}
                        editorHeight="240px"
                      />
                      <Button
                        className="w-full"
                        disabled={!codeAnswer.trim() || submitting || (isFinishRound && sessionFinishChoice == null)}
                        onClick={handleSubmit}
                      >
                        <Send className="h-4 w-4" />
                        {submitting ? 'Đang nộp...' : 'Nộp code'}
                      </Button>
                    </div>
                  ) : session.status === 'playing' && !timeExpired && isShortAnswer ? (
                    <div className="space-y-2">
                      <Input
                        value={textAnswer}
                        onChange={(e) => setTextAnswer(e.target.value)}
                        placeholder="Nhập câu trả lời..."
                        disabled={isFinishRound && sessionFinishChoice == null}
                      />
                      <Button
                        className="mt-1 w-full"
                        disabled={!textAnswer.trim() || submitting || (isFinishRound && sessionFinishChoice == null)}
                        onClick={handleSubmit}
                      >
                        <Send className="h-4 w-4" />
                        {submitting ? 'Đang nộp...' : 'Nộp câu trả lời'}
                      </Button>
                    </div>
                  ) : session.status === 'playing' && !timeExpired ? (
                    <div className="space-y-2">
                      {currentQuestion.options.map((opt, oi) => (
                        <button
                          key={oi}
                          type="button"
                          disabled={isFinishRound && sessionFinishChoice == null}
                          onClick={() => setSelectedOption(oi)}
                          className={`flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
                            selectedOption === oi
                              ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                              : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                          } ${isFinishRound && sessionFinishChoice == null ? 'opacity-50' : ''}`}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-sm font-bold dark:bg-slate-700">
                            {String.fromCharCode(65 + oi)}
                          </span>
                          <span className="text-sm">{opt}</span>
                        </button>
                      ))}
                      <Button
                        className="mt-3 w-full"
                        disabled={selectedOption === null || submitting || (isFinishRound && sessionFinishChoice == null)}
                        onClick={handleSubmit}
                      >
                        <Send className="h-4 w-4" />
                        {submitting ? 'Đang nộp...' : 'Nộp câu trả lời'}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-center text-sm text-amber-600 dark:text-amber-400">
                      {timeExpired ? 'Hết thời gian — chờ công bố đáp án' : 'Chờ giáo viên...'}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <ShowdownLeaderboard participants={participants} activeStudentId={session.activeStudentId} highlightId={student?.id} />
    </div>
  );
}

function StudentScreenBadge({ studentName }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border-2 border-brand-500/40 bg-brand-50 px-4 py-2.5 dark:bg-brand-500/10">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white">
        <Smartphone className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-brand-800 dark:text-brand-200">Màn hình HỌC SINH</p>
        <p className="truncate text-xs text-brand-700/80 dark:text-brand-300/80">
          {studentName ? `Bạn đang chơi với tên: ${studentName}` : 'Trả lời trên thiết bị của bạn'}
        </p>
      </div>
    </div>
  );
}

function OralStudentPanel({ session, student, question }) {
  const isActive = session.activeStudentId === student?.id;
  const reveal = session.revealedAnswer;
  const roundProgress = getRoundProgress(session);

  if (session.status === 'reveal' && reveal) {
    const forMe = reveal.activeStudentId === student?.id;
    return (
      <div className="space-y-2 rounded-xl bg-slate-100 px-4 py-6 text-center dark:bg-slate-800">
        {forMe && (
          <p
            className={`font-bold ${
              reveal.oralOutcome === 'correct' ? 'text-green-600' : reveal.oralOutcome === 'wrong' ? 'text-red-500' : 'text-amber-600'
            }`}
          >
            {reveal.oralOutcome === 'correct'
              ? `Chính xác! +${reveal.pointsEarned} điểm`
              : reveal.oralOutcome === 'wrong'
                ? 'Chưa đúng — không cộng điểm'
                : 'Đã bỏ qua câu này'}
          </p>
        )}
        {!forMe && reveal.activeStudentName && (
          <p className="text-sm text-slate-500">
            Vừa vấn đáp: <strong>{reveal.activeStudentName}</strong>
          </p>
        )}
        {reveal.correctText && (
          <p className="rounded-lg border border-green-400/40 bg-green-50 px-3 py-2 font-semibold text-green-700 dark:bg-green-500/10 dark:text-green-300">
            Đáp án đúng: {reveal.correctText}
          </p>
        )}
      </div>
    );
  }

  if (isActive) {
    return (
      <div className="space-y-3">
        {roundProgress?.total ? (
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            Câu {roundProgress.current}/{roundProgress.total}
            {roundProgress.studentTotal
              ? ` · HS ${roundProgress.studentIndex}/${roundProgress.studentTotal}`
              : ''}
          </p>
        ) : null}
        <div className="rounded-xl border-2 border-cyan-400/50 bg-cyan-50 px-4 py-6 text-center dark:bg-cyan-500/10">
          <Mic className="mx-auto mb-2 h-8 w-8 text-cyan-600 dark:text-cyan-300" />
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100">Đến lượt bạn trả lời!</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Nghe câu hỏi từ giáo viên và trả lời miệng. Giáo viên sẽ chấm điểm trực tiếp.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl bg-slate-100 px-4 py-6 text-center dark:bg-slate-800">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
        Vòng vấn đáp — giáo viên đang hỏi từng bạn.
      </p>
      {roundProgress?.total ? (
        <p className="text-xs text-slate-400">
          Câu {roundProgress.current}/{roundProgress.total}
          {roundProgress.studentTotal
            ? ` · HS ${roundProgress.studentIndex}/${roundProgress.studentTotal}`
            : ''}
        </p>
      ) : null}
      {session.activeStudentName && (
        <p className="text-sm text-slate-500">
          Đang trả lời: <strong>{session.activeStudentName}</strong>
        </p>
      )}
      {question && session.status === 'playing' && (
        <div className="mt-2 space-y-2 text-left">
          <ShowdownQuestionMetaBar question={question} variant="light" />
          <ShowdownQuestionBody question={question} variant="light" size="sm" />
        </div>
      )}
      <p className="text-xs text-slate-400">Chú ý theo dõi để tới lượt mình nhé!</p>
    </div>
  );
}
