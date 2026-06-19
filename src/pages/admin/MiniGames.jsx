import { useEffect, useState } from 'react';
import { CircleDot, Dices, Gift, Hash, Layers, Mountain, Swords } from 'lucide-react';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { SkeletonRows } from '../../ui/components/Skeleton.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { subscribeClasses } from '../../services/classes.service.js';
import { listCurriculumPrograms } from '../../services/curriculum.service.js';
import { getErrorMessage } from '../../lib/firestore.js';
import {
  FEATURE_CODING_SHOWDOWN_ENABLED,
  FEATURE_OLYMPIA_ENABLED,
  FEATURE_WHEEL_OF_FORTUNE_ENABLED,
} from '../../config/features.js';
import { RandomStudentPicker } from './games/RandomStudentPicker.jsx';
import { NumberGuessGame } from './games/NumberGuessGame.jsx';
import { CardFlipGame } from './games/CardFlipGame.jsx';
import { MysteryBoxGame } from './games/MysteryBoxGame.jsx';
import { WheelOfFortuneGame } from './games/WheelOfFortuneGame.jsx';
import { CodingShowdownGame } from './games/CodingShowdownGame.jsx';

const BASE_GAMES = [
  { id: 'random-student', title: 'Quay tên', icon: Dices },
  { id: 'number-guess', title: 'Đoán số', icon: Hash },
  { id: 'card-flip', title: 'Lật bài', icon: Layers },
  { id: 'mystery-box', title: 'Hộp bí ẩn', icon: Gift },
  ...(FEATURE_WHEEL_OF_FORTUNE_ENABLED
    ? [{ id: 'wheel-of-fortune', title: 'Chiếc nón kỳ diệu', icon: CircleDot }]
    : []),
  ...(FEATURE_CODING_SHOWDOWN_ENABLED
    ? [{ id: 'coding-showdown', title: 'Coding Showdown', icon: Swords }]
    : []),
];

const OLYMPIA_GAME = { id: 'olympia', title: 'Olympia Python', icon: Mountain };

const GAMES = FEATURE_OLYMPIA_ENABLED ? [...BASE_GAMES, OLYMPIA_GAME] : BASE_GAMES;

export function MiniGamesPage() {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGame, setActiveGame] = useState('random-student');

  useEffect(() => {
    const unsubscribe = subscribeClasses(
      (list) => {
        setClasses(list);
        setLoading(false);
      },
      (error) => {
        toast.error(getErrorMessage(error));
        setLoading(false);
      },
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listCurriculumPrograms()
      .then(setPrograms)
      .catch(() => setPrograms([]));
  }, []);

  return (
    <AppShell title="Mini game">
      <div className="mb-5 flex flex-wrap gap-2">
        {GAMES.map((game) => {
          const Icon = game.icon;
          const active = game.id === activeGame;
          return (
            <button
              key={game.id}
              type="button"
              onClick={() => setActiveGame(game.id)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                active
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-500/40 dark:hover:text-brand-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {game.title}
            </button>
          );
        })}
      </div>

      {loading ? (
        <SkeletonRows count={5} />
      ) : activeGame === 'random-student' ? (
        <RandomStudentPicker classes={classes} programs={programs} />
      ) : activeGame === 'number-guess' ? (
        <NumberGuessGame classes={classes} programs={programs} />
      ) : activeGame === 'card-flip' ? (
        <CardFlipGame classes={classes} programs={programs} />
      ) : activeGame === 'mystery-box' ? (
        <MysteryBoxGame classes={classes} programs={programs} />
      ) : activeGame === 'wheel-of-fortune' ? (
        <WheelOfFortuneGame classes={classes} programs={programs} />
      ) : activeGame === 'coding-showdown' ? (
        <CodingShowdownGame classes={classes} programs={programs} />
      ) : null}
    </AppShell>
  );
}
