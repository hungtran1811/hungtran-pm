import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Dices, Gift, Hash, Layers, Search, Sparkles } from 'lucide-react';
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
  FEATURE_SPY_GAME_ENABLED,
} from '../../config/features.js';
import { adminGameCards } from '../../lib/adminGames.js';

const RandomStudentPicker = lazy(() =>
  import('./games/RandomStudentPicker.jsx').then((m) => ({ default: m.RandomStudentPicker })),
);
const NumberGuessGame = lazy(() =>
  import('./games/NumberGuessGame.jsx').then((m) => ({ default: m.NumberGuessGame })),
);
const CardFlipGame = lazy(() =>
  import('./games/CardFlipGame.jsx').then((m) => ({ default: m.CardFlipGame })),
);
const MysteryBoxGame = lazy(() =>
  import('./games/MysteryBoxGame.jsx').then((m) => ({ default: m.MysteryBoxGame })),
);
const SpyGame = lazy(() => import('./games/SpyGame.jsx').then((m) => ({ default: m.SpyGame })));
const CodingShowdownGame = FEATURE_CODING_SHOWDOWN_ENABLED
  ? lazy(() =>
    import('./games/CodingShowdownGame.jsx').then((m) => ({ default: m.CodingShowdownGame })),
  )
  : null;

const GAME_ICONS = {
  'random-student': Dices,
  'card-flip': Layers,
  'mystery-box': Gift,
  'number-guess': Hash,
  'spy-game': Search,
  'coding-showdown': Search,
};

const GAMES_WITH_ATTENDANCE = new Set([
  'random-student',
  'number-guess',
  'card-flip',
  'mystery-box',
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
  const [activeGame, setActiveGame] = useState('random-student');
  const gameCards = useMemo(
    () => adminGameCards({ showdownEnabled: FEATURE_CODING_SHOWDOWN_ENABLED }),
    [],
  );
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
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {gameCards.map((game) => {
          const Icon = GAME_ICONS[game.id] || Sparkles;
          const active = game.id === activeGame;
          return (
            <button
              key={game.id}
              type="button"
              aria-pressed={active}
              onClick={() => setActiveGame(game.id)}
              className={`rounded-2xl border p-3 text-left ${
                active
                  ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/10'
                  : 'border-slate-200 bg-white hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900'
              }`}
            >
              <Icon className="h-5 w-5 text-brand-600" aria-hidden="true" />
              <span className="mt-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">{game.title}</span>
              <span className="mt-1 block text-xs text-slate-500">{game.detail}</span>
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
                      ? (presentStudentIds.size === 0
                        ? 'Chọn đủ học sinh có mặt trước khi tạo phòng (ít nhất 3).'
                        : 'Cần ít nhất 3 học sinh có mặt (2 dân thường + 1 gián điệp).')
                      : undefined
                  }
                  lockedHint={
                    activeGame === 'spy-game'
                      ? 'Sau khi tạo phòng, điểm danh khóa vào session — sửa trong Lobby nếu cần.'
                      : undefined
                  }
                  disabled={loadingStudents}
                />
              )}
            </>
          )}

          {activeGame === 'random-student' && (
            <GameSuspense label="Đang tải Quay tên...">
              <RandomStudentPicker {...gameProps} />
            </GameSuspense>
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
          {activeGame === 'spy-game' && FEATURE_SPY_GAME_ENABLED && (
            <GameSuspense label="Đang tải Truy tìm gián điệp...">
              <SpyGame {...gameProps} />
            </GameSuspense>
          )}
          {activeGame === 'coding-showdown' && FEATURE_CODING_SHOWDOWN_ENABLED && CodingShowdownGame && (
            <GameSuspense label="Đang tải Coding Showdown...">
              <CodingShowdownGame
                classes={classes}
                programs={programs}
                loadError={loadError}
              />
            </GameSuspense>
          )}
        </div>
      )}
    </AppShell>
  );
}
