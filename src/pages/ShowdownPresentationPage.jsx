import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Maximize2, Minimize2, Swords, Tv } from 'lucide-react';
import { FullPageLoader } from '../ui/components/Spinner.jsx';
import { Button } from '../ui/components/Button.jsx';
import { ShowdownSyncOverlay } from '../ui/components/games/ShowdownSyncOverlay.jsx';
import { ShowdownStage } from './admin/games/ShowdownStage.jsx';
import { useGamePresentation } from './admin/games/GamePresentationShell.jsx';
import { roundLabel } from '../lib/showdownConstants.js';
import { getQuestionFromSession } from '../lib/showdownQuestionEngine.js';
import { useShowdownStepSync } from '../lib/useShowdownStepSync.js';
import {
  getRoundProgress,
  resolveQuestionDeadlineMs,
  subscribeShowdownParticipants,
  subscribeShowdownSession,
} from '../services/showdown.service.js';

export function ShowdownPresentationPage() {
  const { sessionId } = useParams();
  const { shellRef, presenting, togglePresentation } = useGamePresentation();
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!sessionId) return undefined;
    setLoading(true);
    return subscribeShowdownSession(
      sessionId,
      (data) => {
        setSession(data);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return undefined;
    return subscribeShowdownParticipants(sessionId, setParticipants, () => {});
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

  const currentQuestion = useMemo(() => {
    if (!session) return null;
    return getQuestionFromSession(session, session.currentRound, session.questionIndex);
  }, [session]);

  const roundProgress = useMemo(() => (session ? getRoundProgress(session) : null), [session]);
  const { syncing, syncMessage } = useShowdownStepSync(session);

  if (loading) return <FullPageLoader label="Đang tải màn trình chiếu..." />;

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-white">
        <Swords className="h-10 w-10 text-cyan-400" />
        <p className="text-lg">Không tìm thấy phòng trình chiếu.</p>
      </div>
    );
  }

  return (
    <div
      ref={shellRef}
      className={`game-presenting flex flex-col overflow-hidden bg-black ${
        presenting ? 'h-screen' : 'min-h-screen'
      }`}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-sm font-bold uppercase tracking-wide text-amber-300">
          <Tv className="h-4 w-4" />
          Trình chiếu
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-300">
          <Swords className="h-4 w-4" />
          Coding Showdown
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-white/60">
          {session.classCode} · {participants.length} HS · {roundLabel(session.currentRound)}
          {session.config?.matrixName ? ` · ${session.config.matrixName}` : ''}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 border border-white/10 bg-white/5 text-white/90 hover:bg-white/10 hover:text-white"
          onClick={togglePresentation}
          title={presenting ? 'Thoát toàn màn hình (Esc)' : 'Trình chiếu toàn màn hình'}
        >
          {presenting ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          <span className="ml-1.5 hidden sm:inline">
            {presenting ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
          </span>
        </Button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">
        <div className="game-stage-aurora pointer-events-none absolute inset-0" />
        <div className="game-stage-vignette pointer-events-none absolute inset-0" />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <ShowdownSyncOverlay show={syncing} message={syncMessage} />
          <ShowdownStage
            session={session}
            question={currentQuestion}
            participants={participants}
            roundProgress={roundProgress}
            countdown={countdown}
            submittedCount={null}
            totalCount={session.currentRound === 'finish' ? 1 : participants.length}
            presenting
          />
        </div>
      </div>
    </div>
  );
}
