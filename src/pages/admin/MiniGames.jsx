import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { CircleDot, Gift, Hash, Layers, Mountain, Search, Swords } from 'lucide-react';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { SkeletonRows } from '../../ui/components/Skeleton.jsx';
import { Spinner } from '../../ui/components/Spinner.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { ClassFilterBar } from '../../ui/components/ClassFilterBar.jsx';
import { GameAttendanceRoster } from '../../ui/components/games/GameAttendanceRoster.jsx';
import { subscribeClasses } from '../../services/classes.service.js';
import { listCurriculumPrograms } from '../../services/curriculum.service.js';
import { listActiveStudentsByClass } from '../../services/students.service.js';
import {
  fetchMinigameAttendance,
  saveMinigameAttendance,
  subscribeMinigameAttendance,
} from '../../services/minigameAttendance.service.js';
import { getErrorMessage } from '../../lib/firestore.js';
import {
  filterPresentStudents,
  loadPresentStudentIds,
  normalizePresentIds,
  savePresentStudentIds,
} from '../../lib/minigameAttendance.js';
import {
  FEATURE_CODING_SHOWDOWN_ENABLED,
  FEATURE_OLYMPIA_ENABLED,
  FEATURE_SPY_GAME_ENABLED,
  FEATURE_WHEEL_OF_FORTUNE_ENABLED,
} from '../../config/features.js';

const NumberGuessGame = lazy(() =>
  import('./games/NumberGuessGame.jsx').then((m) => ({ default: m.NumberGuessGame })),
);
const CardFlipGame = lazy(() =>
  import('./games/CardFlipGame.jsx').then((m) => ({ default: m.CardFlipGame })),
);
const MysteryBoxGame = lazy(() =>
  import('./games/MysteryBoxGame.jsx').then((m) => ({ default: m.MysteryBoxGame })),
);
const WheelOfFortuneGame = lazy(() =>
  import('./games/WheelOfFortuneGame.jsx').then((m) => ({ default: m.WheelOfFortuneGame })),
);
const SpyGame = lazy(() => import('./games/SpyGame.jsx').then((m) => ({ default: m.SpyGame })));
const CodingShowdownGame = lazy(() =>
  import('./games/CodingShowdownGame.jsx').then((m) => ({ default: m.CodingShowdownGame })),
);
const OlympiaGame = lazy(() =>
  import('./games/OlympiaGame.jsx').then((m) => ({ default: m.OlympiaGame })),
);

const BASE_GAMES = [
  { id: 'number-guess', title: 'Đoán số', icon: Hash },
  { id: 'card-flip', title: 'Lật bài', icon: Layers },
  { id: 'mystery-box', title: 'Hộp bí ẩn', icon: Gift },
  ...(FEATURE_WHEEL_OF_FORTUNE_ENABLED
    ? [{ id: 'wheel-of-fortune', title: 'Chiếc nón kỳ diệu', icon: CircleDot }]
    : []),
  ...(FEATURE_SPY_GAME_ENABLED
    ? [{ id: 'spy-game', title: 'Truy tìm gián điệp', icon: Search }]
    : []),
  ...(FEATURE_CODING_SHOWDOWN_ENABLED
    ? [{ id: 'coding-showdown', title: 'Coding Showdown', icon: Swords }]
    : []),
];

const OLYMPIA_GAME = { id: 'olympia', title: 'Olympia Python', icon: Mountain };

const GAMES = FEATURE_OLYMPIA_ENABLED ? [...BASE_GAMES, OLYMPIA_GAME] : BASE_GAMES;

const GAMES_WITH_ATTENDANCE = new Set([
  'number-guess',
  'card-flip',
  'mystery-box',
  'wheel-of-fortune',
  'spy-game',
]);

const hubGameProps = (ctx) => ({
  classes: ctx.classes,
  programs: ctx.programs,
  selectedClass: ctx.selectedClass,
  onSelectClass: ctx.setSelectedClass,
  students: ctx.students,
  presentStudents: ctx.presentStudents,
  presentStudentIds: ctx.presentStudentIds,
  onPresentChange: ctx.handlePresentChange,
  loadingStudents: ctx.loadingStudents,
  loadError: ctx.loadError,
});

function GameSuspense({ label, children }) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
          <Spinner className="h-8 w-8" />
          {label ? <p className="text-sm">{label}</p> : null}
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export function MiniGamesPage() {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGame, setActiveGame] = useState('number-guess');
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [presentStudentIds, setPresentStudentIds] = useState(() => new Set());
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadError, setLoadError] = useState('');

  const activeClasses = useMemo(
    () => classes.filter((c) => c.status === 'active'),
    [classes],
  );

  const showAttendance = GAMES_WITH_ATTENDANCE.has(activeGame) && Boolean(selectedClass);

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
      setPresentStudentIds(new Set());
      return undefined;
    }

    let cancelled = false;
    setLoadingStudents(true);
    setLoadError('');

    listActiveStudentsByClass(selectedClass)
      .then(async (list) => {
        if (cancelled) return;
        setStudents(list);
        const allIds = list.map((s) => s.id);
        const server = await fetchMinigameAttendance(selectedClass);
        const ids = server?.presentStudentIds?.length
          ? normalizePresentIds(allIds, server.presentStudentIds)
          : loadPresentStudentIds(selectedClass, allIds);
        setPresentStudentIds(ids);
        savePresentStudentIds(selectedClass, ids);
        setLoadingStudents(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(getErrorMessage(error));
        setStudents([]);
        setPresentStudentIds(new Set());
        setLoadingStudents(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedClass || !students.length) return undefined;
    const allIds = students.map((s) => s.id);
    return subscribeMinigameAttendance(
      selectedClass,
      (data) => {
        if (!data?.presentStudentIds?.length) return;
        setPresentStudentIds(normalizePresentIds(allIds, data.presentStudentIds));
        savePresentStudentIds(selectedClass, normalizePresentIds(allIds, data.presentStudentIds));
      },
      () => {},
    );
  }, [selectedClass, students]);

  const handlePresentChange = useCallback(
    (nextIds) => {
      setPresentStudentIds(nextIds);
      if (selectedClass) {
        savePresentStudentIds(selectedClass, nextIds);
        saveMinigameAttendance(selectedClass, nextIds).catch((error) => {
          toast.error(getErrorMessage(error));
        });
      }
    },
    [selectedClass, toast],
  );

  const presentStudents = useMemo(
    () => filterPresentStudents(students, presentStudentIds),
    [students, presentStudentIds],
  );

  const hubCtx = {
    classes,
    programs,
    selectedClass,
    setSelectedClass,
    students,
    presentStudents,
    presentStudentIds,
    handlePresentChange,
    loadingStudents,
    loadError,
  };

  const gameProps = hubGameProps(hubCtx);

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
              aria-selected={active}
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
      ) : (
        <div className="space-y-4">
          {loadError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
            >
              {loadError}
            </div>
          )}

          {GAMES_WITH_ATTENDANCE.has(activeGame) && (
            <>
              <ClassFilterBar
                classes={activeClasses}
                programs={programs}
                value={selectedClass}
                onChange={setSelectedClass}
              />
              {showAttendance && (
                <GameAttendanceRoster
                  students={students}
                  presentStudentIds={presentStudentIds}
                  onPresentChange={handlePresentChange}
                  minPresent={activeGame === 'spy-game' ? 3 : 2}
                  minPresentHint={
                    activeGame === 'spy-game'
                      ? 'Cần ít nhất 3 học sinh có mặt (2 dân thường + 1 gián điệp).'
                      : undefined
                  }
                  disabled={loadingStudents}
                />
              )}
            </>
          )}

          {activeGame === 'number-guess' && (
            <GameSuspense label="Đang tải Đoán số...">
              <NumberGuessGame {...gameProps} />
            </GameSuspense>
          )}
          {activeGame === 'card-flip' && (
            <GameSuspense label="Đang tải Lật bài...">
              <CardFlipGame {...gameProps} />
            </GameSuspense>
          )}
          {activeGame === 'mystery-box' && (
            <GameSuspense label="Đang tải Hộp bí ẩn...">
              <MysteryBoxGame {...gameProps} />
            </GameSuspense>
          )}
          {activeGame === 'wheel-of-fortune' && FEATURE_WHEEL_OF_FORTUNE_ENABLED && (
            <GameSuspense label="Đang tải Chiếc nón kỳ diệu...">
              <WheelOfFortuneGame {...gameProps} />
            </GameSuspense>
          )}
          {activeGame === 'spy-game' && FEATURE_SPY_GAME_ENABLED && (
            <GameSuspense label="Đang tải Truy tìm gián điệp...">
              <SpyGame {...gameProps} />
            </GameSuspense>
          )}
          {activeGame === 'coding-showdown' && FEATURE_CODING_SHOWDOWN_ENABLED && (
            <GameSuspense label="Đang tải Coding Showdown...">
              <CodingShowdownGame
                classes={classes}
                programs={programs}
                loadError={loadError}
              />
            </GameSuspense>
          )}
          {activeGame === 'olympia' && FEATURE_OLYMPIA_ENABLED && (
            <GameSuspense label="Đang tải Olympia Python...">
              <OlympiaGame classes={classes} programs={programs} />
            </GameSuspense>
          )}
        </div>
      )}
    </AppShell>
  );
}
