import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Mountain,
  Send,
  XCircle,
} from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Markdown } from '../../ui/components/Markdown.jsx';
import { Spinner } from '../../ui/components/Spinner.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { OLYMPIA_ROUNDS, responseDocId } from '../../lib/olympiaConstants.js';
import { formatMountainProgress } from '../../lib/olympiaRules.js';
import { getQuestionFromSession } from '../../lib/olympiaQuestions.js';
import { getErrorMessage, toDate } from '../../lib/firestore.js';
import { OlympiaRulesPanel, OlympiaRoundBanner } from '../../ui/components/OlympiaRulesPanel.jsx';
import {
  joinOlympiaSession,
  rankParticipants,
  submitOlympiaResponse,
  subscribeOlympiaParticipants,
  subscribeOlympiaResponse,
  subscribeOlympiaSession,
} from '../../services/olympia.service.js';
import { OlympiaMountainBoard, OlympiaPodium } from '../admin/games/OlympiaMountainBoard.jsx';

function submissionStorageKey(sessionId, studentId) {
  return `olympia-submission:${sessionId}:${studentId}`;
}

function readLocalSubmission(sessionId, studentId, round, questionIndex) {
  if (!sessionId || !studentId || round == null || questionIndex == null) return null;
  try {
    const raw = localStorage.getItem(submissionStorageKey(sessionId, studentId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    const expectedId = responseDocId(studentId, round, questionIndex);
    if (data.responseId !== expectedId) return null;
    return data;
  } catch {
    return null;
  }
}

function writeLocalSubmission(sessionId, studentId, round, questionIndex, payload) {
  localStorage.setItem(
    submissionStorageKey(sessionId, studentId),
    JSON.stringify({
      responseId: responseDocId(studentId, round, questionIndex),
      ...payload,
    }),
  );
}

function formatCountdown(deadline) {
  const end = toDate(deadline);
  if (!end) return '--:--';
  const sec = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function OlympiaStudentView({ sessionId, classCode, student, onExit }) {
  const toast = useToast();
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [serverResponse, setServerResponse] = useState(null);
  const [localSubmission, setLocalSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [finishChoice, setFinishChoice] = useState(null);
  const [finishLocked, setFinishLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState('--:--');
  const [roundBanner, setRoundBanner] = useState(null);

  useEffect(() => {
    if (!sessionId) return undefined;
    setLoading(true);
    const unsub = subscribeOlympiaSession(
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
    if (!sessionId) return undefined;
    return subscribeOlympiaParticipants(sessionId, setParticipants, () => {});
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
    return subscribeOlympiaResponse(sessionId, respId, setServerResponse, () => {});
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
    if (!sessionId || !student?.id) return;
    let cancelled = false;
    setJoining(true);
    joinOlympiaSession(sessionId, {
      studentId: student.id,
      studentName: student.fullName,
    })
      .catch((err) => {
        if (!cancelled) toast.error(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setJoining(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, student?.id, student?.fullName, toast]);

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
    setSelectedOption(null);
    setFinishChoice(null);
    setFinishLocked(false);
  }, [session?.currentRound, session?.questionIndex, session?.status]);

  useEffect(() => {
    if (!session || session.status !== 'playing' || session.questionIndex !== 0) return undefined;
    setRoundBanner(session.currentRound);
    const timer = setTimeout(() => setRoundBanner(null), 3500);
    return () => clearTimeout(timer);
  }, [session?.currentRound, session?.questionIndex, session?.status]);

  const stepThreshold = session?.config?.stepThreshold;

  const myParticipant = useMemo(
    () => participants.find((p) => p.id === student?.id) || null,
    [participants, student?.id],
  );

  const mountainProgress = useMemo(() => {
    if (!myParticipant) return null;
    return formatMountainProgress(myParticipant.totalScore, stepThreshold);
  }, [myParticipant, stepThreshold]);

  const currentQuestion = useMemo(() => {
    if (!session) return null;
    return getQuestionFromSession(session, session.currentRound, session.questionIndex);
  }, [session]);

  const myResponse = useMemo(() => {
    if (serverResponse) return serverResponse;
    if (!localSubmission) return null;
    return {
      id: localSubmission.responseId,
      selectedOption: localSubmission.selectedOption,
      finishChoice: localSubmission.finishChoice ?? null,
      isCorrect: null,
      pointsEarned: 0,
    };
  }, [serverResponse, localSubmission]);

  const revealedIndex = session?.revealedAnswer?.correctIndex;
  const isFinishRound = session?.currentRound === 'finish';
  const showQuestion = !isFinishRound || finishLocked;

  const myRank = useMemo(() => {
    const ranked = rankParticipants(participants);
    const idx = ranked.findIndex((p) => p.id === student?.id);
    return idx >= 0 ? idx + 1 : null;
  }, [participants, student?.id]);

  const handleSubmit = useCallback(async () => {
    if (!session || !student || selectedOption === null || submitting) return;
    if (isFinishRound && finishChoice == null) {
      toast.error('Chọn mức điểm trước khi trả lời.');
      return;
    }
    setSubmitting(true);
    try {
      await submitOlympiaResponse(sessionId, {
        studentId: student.id,
        studentName: student.fullName,
        round: session.currentRound,
        questionIndex: session.questionIndex,
        questionId: currentQuestion?.id,
        selectedOption,
        finishChoice: isFinishRound ? finishChoice : null,
        roundStartedAt: session.roundStartedAt,
      });
      writeLocalSubmission(sessionId, student.id, session.currentRound, session.questionIndex, {
        selectedOption,
        finishChoice: isFinishRound ? finishChoice : null,
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
  }, [
    session,
    student,
    selectedOption,
    submitting,
    isFinishRound,
    finishChoice,
    sessionId,
    currentQuestion?.id,
    toast,
  ]);

  if (loading || joining) {
    return (
      <div className="card flex items-center justify-center gap-3 p-8">
        <Spinner />
        <span className="text-sm text-slate-500">Đang vào phòng Olympia...</span>
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

  if (session.status === 'finished') {
    return (
      <div className="space-y-4">
        <div className="card overflow-hidden bg-gradient-to-br from-slate-900 to-brand-950 p-6 text-white">
          <div className="mb-4 flex items-center gap-2">
            <Mountain className="h-6 w-6 text-emerald-400" />
            <h2 className="text-xl font-bold">Olympia Python — Kết thúc</h2>
          </div>
          {myParticipant && (
            <div className="mb-4 rounded-xl bg-white/10 px-4 py-3">
              <p className="text-sm text-white/70">Kết quả của bạn</p>
              <p className="text-3xl font-bold text-amber-300">{myParticipant.totalScore} điểm</p>
              {myRank && (
                <p className="text-sm text-white/80">Hạng {myRank} / {participants.length}</p>
              )}
            </div>
          )}
          <OlympiaPodium participants={participants} />
        </div>
        {onExit && (
          <Button variant="secondary" className="w-full" onClick={onExit}>
            Quay lại bài học
          </Button>
        )}
      </div>
    );
  }

  if (session.status === 'lobby') {
    return (
      <div className="space-y-4">
        <div className="card space-y-4 p-6">
          <div className="flex items-center gap-2 text-brand-600 dark:text-brand-300">
            <Mountain className="h-6 w-6" />
            <h2 className="text-lg font-bold">Phòng chờ Olympia</h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Bạn đã vào phòng. Chờ giáo viên bắt đầu vòng <strong>Khởi động</strong>.
          </p>
          <p className="text-center text-2xl font-bold text-slate-800 dark:text-slate-100">
            {participants.length} thí sinh đã sẵn sàng
          </p>
          {onExit && (
            <Button variant="subtle" size="sm" onClick={onExit}>
              Rời phòng (quay lại bài học)
            </Button>
          )}
        </div>
        <OlympiaRulesPanel stepThreshold={stepThreshold} compact />
      </div>
    );
  }

  const roundLabel = OLYMPIA_ROUNDS[session.currentRound]?.label || session.currentRound;
  const timeExpired =
    session.status === 'playing' &&
    toDate(session.questionDeadlineAt) &&
    Date.now() > toDate(session.questionDeadlineAt).getTime();

  return (
    <div className="space-y-4">
      {roundBanner && (
        <OlympiaRoundBanner
          roundId={roundBanner}
          speedBonusEnabled={session.config?.speedBonusEnabled}
        />
      )}
      <div className="card overflow-hidden border-2 border-brand-500/30 p-0">
        <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3 text-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Mountain className="h-5 w-5" />
              <span className="font-bold">{roundLabel}</span>
            </div>
            {session.status === 'playing' && (
              <span className="flex items-center gap-1 font-mono text-lg font-bold tabular-nums">
                <Clock className="h-4 w-4" />
                {countdown}
              </span>
            )}
          </div>
          {myParticipant && (
            <p className="mt-1 text-sm text-brand-100">
              Điểm: {myParticipant.totalScore}
              {mountainProgress ? ` · ${mountainProgress.text}` : ''}
            </p>
          )}
        </div>

        <div className="p-4">
          {!currentQuestion ? (
            <p className="text-center text-sm text-slate-500">Đang chờ câu hỏi...</p>
          ) : (
            <>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Câu {session.questionIndex + 1}
              </p>

              {isFinishRound && !finishLocked && session.status === 'playing' && !myResponse && (
                <div className="mb-4 space-y-3">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Chọn mức điểm về đích:
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {OLYMPIA_ROUNDS.finish.pointChoices.map((pts) => (
                      <button
                        key={pts}
                        type="button"
                        onClick={() => {
                          setFinishChoice(pts);
                          setFinishLocked(true);
                        }}
                        className={`rounded-xl border-2 py-4 text-center font-bold transition ${
                          finishChoice === pts
                            ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
                            : 'border-slate-200 hover:border-brand-400 dark:border-slate-700'
                        }`}
                      >
                        {pts} đ
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showQuestion && (
                <>
                  <div className="card-prose mb-4 text-base">
                    <Markdown content={currentQuestion.prompt} />
                  </div>
                  {currentQuestion.code && (
                    <pre className="mb-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-emerald-300">
                      <code>{currentQuestion.code}</code>
                    </pre>
                  )}

                  {myResponse ? (
                    <div className="rounded-xl bg-slate-100 px-4 py-3 text-center dark:bg-slate-800">
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Bạn đã chọn: {String.fromCharCode(65 + myResponse.selectedOption)}
                        {myResponse.finishChoice ? ` · Mức ${myResponse.finishChoice} đ` : ''}
                      </p>
                      {session.status === 'reveal' && myResponse.isCorrect !== null && (
                        <div className="mt-2 space-y-1">
                          <p
                            className={`flex items-center justify-center gap-1 font-bold ${
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
                          {mountainProgress && (
                            <p className="text-xs text-slate-500">{mountainProgress.text}</p>
                          )}
                        </div>
                      )}
                      {session.status === 'reveal' && revealedIndex != null && (
                        <p className="mt-1 text-xs text-slate-500">
                          Đáp án đúng: {String.fromCharCode(65 + revealedIndex)}
                        </p>
                      )}
                      {session.status === 'playing' && (
                        <p className="mt-1 text-xs text-slate-400">Chờ giáo viên công bố đáp án...</p>
                      )}
                    </div>
                  ) : session.status === 'playing' && !timeExpired ? (
                    <div className="space-y-2">
                      {currentQuestion.options.map((opt, oi) => (
                        <button
                          key={oi}
                          type="button"
                          disabled={isFinishRound && !finishLocked}
                          onClick={() => setSelectedOption(oi)}
                          className={`flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
                            selectedOption === oi
                              ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                              : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                          } ${isFinishRound && !finishLocked ? 'opacity-50' : ''}`}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-sm font-bold dark:bg-slate-700">
                            {String.fromCharCode(65 + oi)}
                          </span>
                          <span className="text-sm">{opt}</span>
                        </button>
                      ))}
                      <Button
                        className="mt-3 w-full"
                        disabled={
                          selectedOption === null ||
                          submitting ||
                          (isFinishRound && finishChoice == null)
                        }
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

      {myParticipant && (
        <OlympiaMountainBoard
          participants={[myParticipant]}
          stepThreshold={session.config?.stepThreshold}
          compact
        />
      )}

      {onExit && session.status !== 'playing' && (
        <Button variant="subtle" size="sm" onClick={onExit}>
          Rời phòng
        </Button>
      )}
    </div>
  );
}
