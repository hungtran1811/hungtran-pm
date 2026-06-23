import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Maximize2, Minimize2, Search, Tv } from 'lucide-react';
import { FullPageLoader } from '../ui/components/Spinner.jsx';
import { Button } from '../ui/components/Button.jsx';
import { SpyStage } from './admin/games/SpyStage.jsx';
import { useGamePresentation } from './admin/games/GamePresentationShell.jsx';
import {
  getCurrentSpeaker,
  getSpySessionResults,
  subscribeSpyParticipants,
  subscribeSpySession,
  subscribeSpyVotes,
  tallySpyVotes,
} from '../services/spy.service.js';

export function SpyPresentationPage() {
  const { sessionId } = useParams();
  const { shellRef, presenting, togglePresentation } = useGamePresentation();
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revealData, setRevealData] = useState(null);

  useEffect(() => {
    if (!sessionId) return undefined;
    setLoading(true);
    return subscribeSpySession(
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
    return subscribeSpyParticipants(sessionId, setParticipants, () => {});
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return undefined;
    return subscribeSpyVotes(sessionId, setVotes, () => {});
  }, [sessionId]);

  useEffect(() => {
    if (session?.status !== 'reveal' || !sessionId) {
      setRevealData(null);
      return;
    }
    getSpySessionResults(sessionId).then(setRevealData).catch(() => {});
  }, [session?.status, sessionId]);

  const speakerId = getCurrentSpeaker(session);
  const speakerName = participants.find((p) => p.id === speakerId)?.studentName || '';
  const tally = useMemo(() => tallySpyVotes(votes, participants), [votes, participants]);
  const spyNames = useMemo(() => {
    if (session?.status === 'reveal' && revealData?.spies) {
      return revealData.spies.map((p) => p.studentName);
    }
    return [];
  }, [session?.status, revealData]);

  if (loading) return <FullPageLoader label="Đang tải màn trình chiếu..." />;

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-white">
        <Search className="h-10 w-10 text-violet-400" />
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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/20 px-3 py-1 text-sm font-bold uppercase tracking-wide text-violet-300">
          <Tv className="h-4 w-4" />
          Trình chiếu
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-300">
          <Search className="h-4 w-4" />
          Truy tìm gián điệp
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-white/60">
          {session.classCode} · {participants.length} HS
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
        <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center">
          <SpyStage
            session={session}
            participants={participants}
            votes={votes}
            tally={tally}
            speakerName={speakerName}
            presenting
            hideWords={false}
            spyNames={spyNames}
          />
        </div>
      </div>
    </div>
  );
}
