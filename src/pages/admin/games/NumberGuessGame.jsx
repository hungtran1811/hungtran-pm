import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Hash, RotateCcw, Users } from 'lucide-react';
import { Button } from '../../../ui/components/Button.jsx';
import { EmptyState } from '../../../ui/components/EmptyState.jsx';
import { Field, Input } from '../../../ui/components/Field.jsx';
import { SelectClassPrompt, LoadingCatState } from '../../../ui/components/WaitingCatIllustration.jsx';
import { GameConfetti } from '../../../ui/components/games/GameConfetti.jsx';
import { GameSoundToggle } from '../../../ui/components/games/GameSoundToggle.jsx';
import { useGameSound } from '../../../hooks/useGameSound.js';
import { GamePresentationShell, useGamePresentation } from './GamePresentationShell.jsx';

const ABS_MIN = 0;
const ABS_MAX = 9999;

const RESULT_TONE = {
  'Chính xác!': 'font-semibold text-amber-600 dark:text-amber-300',
  'Cao hơn!': 'text-brand-600 dark:text-brand-300',
  'Thấp hơn!': 'text-violet-600 dark:text-violet-300',
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleStudents(students) {
  return [...students].sort(() => Math.random() - 0.5);
}

function parseBound(value, fallback) {
  const n = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function NumberGuessGame({
  classes = [],
  selectedClass = '',
  students = [],
  presentStudents = [],
  loadingStudents = false,
  loadError = '',
}) {

  const [rangeMin, setRangeMin] = useState('0');
  const [rangeMax, setRangeMax] = useState('100');
  const [secret, setSecret] = useState(null);
  const [roundMin, setRoundMin] = useState(0);
  const [roundMax, setRoundMax] = useState(100);
  const [low, setLow] = useState(0);
  const [high, setHigh] = useState(100);
  const [turnIndex, setTurnIndex] = useState(0);
  const [turnOrder, setTurnOrder] = useState([]);
  const [draftByStudent, setDraftByStudent] = useState({});
  const [lastResultByStudent, setLastResultByStudent] = useState({});
  const [feedback, setFeedback] = useState('');
  const [lastGuesser, setLastGuesser] = useState(null);
  const [winner, setWinner] = useState(null);
  const [history, setHistory] = useState([]);
  const [won, setWon] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef({});
  const { shellRef, presenting, togglePresentation } = useGamePresentation();
  const sound = useGameSound();

  const activeClasses = useMemo(
    () => classes.filter((c) => c.status === 'active'),
    [classes],
  );

  const selectedClassDoc = useMemo(
    () => activeClasses.find((c) => c.classCode === selectedClass) || null,
    [activeClasses, selectedClass],
  );

  const focusStudentInput = useCallback((studentId) => {
    if (!studentId) return;
    requestAnimationFrame(() => {
      inputRefs.current[studentId]?.focus();
    });
  }, []);

  const resetRoundState = () => {
    setSecret(null);
    setDraftByStudent({});
    setLastResultByStudent({});
    setTurnIndex(0);
    setTurnOrder([]);
    setFeedback('');
    setLastGuesser(null);
    setWinner(null);
    setHistory([]);
    setWon(false);
    setError('');
  };

  useEffect(() => {
    resetRoundState();
  }, [selectedClass, presentStudents]);

  const playing = secret !== null;
  const roundStudents = playing && turnOrder.length ? turnOrder : presentStudents;
  const activeStudent = roundStudents[turnIndex] || null;

  const rangeSpan = Math.max(high - low, 0);
  const totalSpan = Math.max(roundMax - roundMin, 1);

  const startRound = () => {
    if (!selectedClass) {
      setError('Chọn lớp trước khi bắt đầu.');
      return;
    }
    if (!presentStudents.length) {
      setError('Chưa có học sinh có mặt.');
      return;
    }

    const min = parseBound(rangeMin, 0);
    const max = parseBound(rangeMax, 100);

    if (min < ABS_MIN || max > ABS_MAX) {
      setError(`Phạm vi phải nằm trong ${ABS_MIN}–${ABS_MAX}.`);
      return;
    }
    if (min >= max) {
      setError('Số «Từ» phải nhỏ hơn số «Đến».');
      return;
    }

    sound.enableSound();
    const picked = randomInt(min, max);
    const shuffled = shuffleStudents(presentStudents);
    setSecret(picked);
    setRoundMin(min);
    setRoundMax(max);
    setLow(min);
    setHigh(max);
    setDraftByStudent({});
    setLastResultByStudent({});
    setTurnOrder(shuffled);
    setTurnIndex(0);
    setFeedback('');
    setLastGuesser(null);
    setWinner(null);
    setHistory([]);
    setWon(false);
    setError('');
    focusStudentInput(shuffled[0]?.id);
  };

  const resetAll = () => {
    resetRoundState();
  };

  const submitGuess = (studentId) => {
    if (!playing || won) return;

    const student = presentStudents.find((s) => s.id === studentId);
    if (!student) return;

    const guess = Number.parseInt(String(draftByStudent[studentId] ?? '').trim(), 10);
    if (!Number.isFinite(guess)) {
      setError('Nhập một số nguyên hợp lệ.');
      sound.play('buzz');
      focusStudentInput(studentId);
      return;
    }
    if (guess < low || guess > high) {
      setError(`Số phải nằm trong phạm vi ${low} – ${high}.`);
      sound.play('buzz');
      focusStudentInput(studentId);
      return;
    }

    setError('');
    const entry = {
      studentId: student.id,
      studentName: student.fullName,
      guess,
      at: Date.now(),
    };

    if (guess === secret) {
      const result = 'Chính xác!';
      sound.play('cheer');
      setFeedback(result);
      setWon(true);
      setWinner(student);
      setLastGuesser(student);
      setLastResultByStudent((prev) => ({
        ...prev,
        [student.id]: { guess, result },
      }));
      setDraftByStudent((prev) => ({ ...prev, [student.id]: '' }));
      setHistory((prev) => [{ ...entry, result }, ...prev]);
      return;
    }

    const result = guess < secret ? 'Cao hơn!' : 'Thấp hơn!';
    sound.play('tap');
    if (guess < secret) setLow(guess);
    else setHigh(guess);

    setFeedback(result);
    setLastGuesser(student);
    setLastResultByStudent((prev) => ({
      ...prev,
      [student.id]: { guess, result },
    }));
    setDraftByStudent((prev) => ({ ...prev, [student.id]: '' }));
    setHistory((prev) => [{ ...entry, result }, ...prev]);

    const nextIdx = (turnIndex + 1) % roundStudents.length;
    setTurnIndex(nextIdx);
    focusStudentInput(roundStudents[nextIdx]?.id);
  };

  const handleRowSubmit = (e, studentId) => {
    e.preventDefault();
    if (activeStudent?.id !== studentId) return;
    submitGuess(studentId);
  };

  const stageBorder = won
    ? 'border-amber-400/80 shadow-[0_0_40px_rgba(251,191,36,0.35)]'
    : playing && feedback
      ? 'border-brand-400/60 shadow-[0_0_30px_rgba(49,111,253,0.4)]'
      : 'border-slate-700/80';

  const rangeDisplayClass = presenting
    ? 'text-6xl sm:text-7xl md:text-8xl lg:text-9xl'
    : 'text-4xl sm:text-5xl md:text-6xl';

  const nameDisplayClass = presenting
    ? 'text-4xl sm:text-5xl md:text-6xl'
    : 'text-2xl sm:text-3xl';

  const feedbackDisplayClass = presenting
    ? 'text-5xl sm:text-6xl md:text-7xl'
    : 'text-2xl sm:text-3xl';

  const barLeft = playing ? ((low - roundMin) / totalSpan) * 100 : 0;
  const barWidth = playing ? (rangeSpan / totalSpan) * 100 : 100;

  const canStart = selectedClass && presentStudents.length > 0 && (!playing || won);

  const renderStudentTable = (dark = false) => (
    <div className={`overflow-x-auto ${dark ? 'max-h-[40vh]' : ''}`}>
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr
            className={
              dark
                ? 'border-b border-slate-700 bg-slate-800/80 text-xs font-semibold uppercase tracking-wide text-slate-400'
                : 'border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400'
            }
          >
            <th className="w-10 px-3 py-2.5">#</th>
            <th className="px-3 py-2.5">Học sinh</th>
            <th className="w-36 px-3 py-2.5">Số đoán</th>
            <th className="w-32 px-3 py-2.5">Kết quả</th>
          </tr>
        </thead>
        <tbody className={dark ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100 dark:divide-slate-800'}>
          {roundStudents.map((student, index) => {
            const isTurn = playing && !won && index === turnIndex;
            const lastResult = lastResultByStudent[student.id];
            const inputDisabled = !playing || won || !isTurn;

            return (
              <tr
                key={student.id}
                className={`transition ${
                  isTurn
                    ? dark
                      ? 'bg-brand-500/15'
                      : 'bg-brand-50 dark:bg-brand-500/10'
                    : ''
                }`}
              >
                <td className={`px-3 py-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{index + 1}</td>
                <td className={`px-3 py-2 font-medium ${dark ? 'text-slate-100' : 'text-slate-800 dark:text-slate-100'}`}>
                  <span className="flex items-center gap-2">
                    {isTurn && (
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    )}
                    {student.fullName}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <form onSubmit={(e) => handleRowSubmit(e, student.id)}>
                    <input
                      ref={(el) => {
                        inputRefs.current[student.id] = el;
                      }}
                      type="number"
                      value={draftByStudent[student.id] ?? ''}
                      onChange={(e) => {
                        setDraftByStudent((prev) => ({
                          ...prev,
                          [student.id]: e.target.value,
                        }));
                        if (error) setError('');
                      }}
                      placeholder={playing && !won ? `${low}–${high}` : '—'}
                      disabled={inputDisabled}
                      className={`input-base w-full py-1.5 text-center ${dark ? 'border-slate-700 bg-slate-900 text-slate-100' : ''}`}
                    />
                  </form>
                </td>
                <td className="px-3 py-2">
                  {lastResult ? (
                    <span className={RESULT_TONE[lastResult.result] || ''}>
                      {lastResult.guess}
                      {' '}
                      →
                      {' '}
                      {lastResult.result}
                    </span>
                  ) : (
                    <span className={dark ? 'text-slate-600' : 'text-slate-300 dark:text-slate-600'}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const presentationToolbar = (
    <>
      <GameSoundToggle
        muted={sound.muted}
        onToggle={sound.toggleMuted}
        onUnlock={sound.unlock}
        onTestSound={() => sound.play('tap')}
        presenting={presenting}
      />
      {playing && !won && activeStudent && (
        <form
          onSubmit={(e) => handleRowSubmit(e, activeStudent.id)}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {!presenting && (
            <span className="max-w-[10rem] truncate text-sm font-medium text-slate-300 sm:max-w-xs">
              {activeStudent.fullName}
            </span>
          )}
          <input
            type="number"
            value={draftByStudent[activeStudent.id] ?? ''}
            onChange={(e) => {
              setDraftByStudent((prev) => ({
                ...prev,
                [activeStudent.id]: e.target.value,
              }));
              if (error) setError('');
            }}
            placeholder={`${low}–${high}`}
            className={`input-base border-slate-700 bg-slate-900 text-center text-slate-100 ${
              presenting ? 'w-36 py-2.5 text-xl font-bold' : 'w-28 py-1.5'
            }`}
          />
          <Button type="submit" size={presenting ? 'lg' : 'sm'}>
            {presenting ? '→' : 'Kiểm tra'}
          </Button>
        </form>
      )}
      {playing && won && (
        <Button size={presenting ? 'lg' : 'sm'} onClick={startRound} disabled={!canStart}>
          <Hash className="h-4 w-4" />
          {!presenting && 'Vòng mới'}
        </Button>
      )}
      {playing && (
        <Button variant="secondary" size={presenting ? 'lg' : 'sm'} onClick={resetAll}>
          <RotateCcw className="h-4 w-4" />
          {!presenting && 'Dừng'}
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="card overflow-visible p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid flex-1 grid-cols-2 gap-3 sm:max-w-xs">
            <Field label="Từ">
              <Input
                type="number"
                value={rangeMin}
                onChange={(e) => setRangeMin(e.target.value)}
                disabled={playing && !won}
                min={ABS_MIN}
                max={ABS_MAX}
              />
            </Field>
            <Field label="Đến">
              <Input
                type="number"
                value={rangeMax}
                onChange={(e) => setRangeMax(e.target.value)}
                disabled={playing && !won}
                min={ABS_MIN}
                max={ABS_MAX}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={startRound} disabled={!canStart}>
              <Hash className="h-4 w-4" />
              {playing && !won ? 'Đang chơi...' : 'Bắt đầu vòng mới'}
            </Button>
            {playing && (
              <Button variant="secondary" onClick={resetAll}>
                <RotateCcw className="h-4 w-4" />
                Dừng
              </Button>
            )}
          </div>
        </div>
        {(error || loadError) && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error || loadError}</p>
        )}
      </div>

      {loadingStudents ? (
        <LoadingCatState message="Đang tải học sinh..." />
      ) : !selectedClass ? (
        activeClasses.length === 0 ? (
          <EmptyState icon={<Users className="h-7 w-7" />} title="Chưa có lớp đang hoạt động" />
        ) : (
          <SelectClassPrompt title="Chọn lớp để chơi đoán số" />
        )
      ) : students.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title="Lớp chưa có học sinh"
          description="Thêm học sinh trong mục Học sinh trước khi chơi."
        />
      ) : presentStudents.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title="Chưa chọn học sinh có mặt"
          description="Tick học sinh trong mục điểm danh phía trên."
        />
      ) : (
        <>
          <GamePresentationShell
            shellRef={shellRef}
            presenting={presenting}
            onTogglePresentation={togglePresentation}
            stageBorder={stageBorder}
            stageMinHeight="min-h-[280px] sm:min-h-[320px]"
            toolbar={presentationToolbar}
          >
            <div
              className={`relative ${
                presenting ? 'min-h-[min(70vh,560px)]' : 'min-h-[240px] sm:min-h-[280px]'
              }`}
            >
              {playing && !won && feedback && (
                <div className="game-marquee absolute inset-x-0 top-0 h-1" />
              )}

              {won && <GameConfetti intense={presenting} />}

              <div className="relative flex min-h-[inherit] flex-col items-center justify-center px-4 text-center">
                {!playing ? (
                  <>
                    {!presenting && selectedClassDoc && (
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-300/70">
                        {selectedClassDoc.className || selectedClassDoc.classCode}
                      </p>
                    )}
                    <span
                      className={`font-black text-white/20 ${
                        presenting
                          ? 'game-idle-mark text-[8rem] leading-none sm:text-[10rem]'
                          : 'text-6xl'
                      }`}
                      aria-hidden
                    >
                      ?
                    </span>
                    {!presenting && (
                      <p className="mt-4 text-sm text-slate-500">Bắt đầu vòng mới</p>
                    )}
                  </>
                ) : won && winner ? (
                  <div className="space-y-4 sm:space-y-6">
                    <p className={`game-name-reveal font-black text-white ${nameDisplayClass}`}>
                      {winner.fullName}
                    </p>
                    <p className={`game-name-reveal font-black text-amber-300 ${rangeDisplayClass}`}>
                      {secret}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className={`font-black tabular-nums text-white ${rangeDisplayClass}`}>
                      {low}
                      <span
                        className={`mx-2 text-brand-400/50 sm:mx-4 ${
                          presenting ? 'text-5xl sm:text-6xl' : ''
                        }`}
                      >
                        —
                      </span>
                      {high}
                    </p>

                    {playing && !won && (
                      <div
                        className={`w-full ${presenting ? 'mt-8 max-w-lg' : 'mt-5 max-w-md'}`}
                      >
                        <div
                          className={`overflow-hidden rounded-full bg-slate-800/80 ${
                            presenting ? 'h-3' : 'h-2'
                          }`}
                        >
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-500"
                            style={{
                              marginLeft: `${barLeft}%`,
                              width: `${Math.max(barWidth, 2)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {feedback && !won && (
                      <p
                        key={feedback + (history[0]?.at ?? '')}
                        className={`game-feedback-burst mt-6 font-black text-brand-300 ${feedbackDisplayClass}`}
                      >
                        {feedback}
                      </p>
                    )}

                    {presenting && playing && !won && activeStudent && (
                      <p className="mt-6 max-w-lg truncate text-lg font-semibold text-white/50">
                        {activeStudent.fullName}
                      </p>
                    )}

                    {!presenting && playing && !won && activeStudent && (
                      <p className="mt-4 text-xs text-slate-500">
                        Lượt:
                        {' '}
                        <span className="font-semibold text-brand-300">{activeStudent.fullName}</span>
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </GamePresentationShell>

          {!presenting && playing && !won && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Thứ tự lượt đoán được xáo ngẫu nhiên mỗi vòng — nhập số ở bảng bên dưới, Enter để kiểm tra.
            </p>
          )}

          {!presenting && playing && (
            <div className="card overflow-hidden">{renderStudentTable(false)}</div>
          )}

          {history.length > 0 && (
            <div className="card p-3">
              <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Lịch sử theo thứ tự (
                {history.length}
                )
              </p>
              <div className="space-y-1.5">
                {history.map((item, index) => (
                  <div
                    key={item.at}
                    className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60"
                  >
                    <span className="min-w-0 font-medium text-slate-700 dark:text-slate-200">
                      <span className="mr-2 text-xs font-bold text-brand-600 dark:text-brand-300">
                        #
                        {history.length - index}
                      </span>
                      <span className="truncate">{item.studentName}</span>
                      <span className="mx-1.5 text-slate-400">·</span>
                      <span className="font-semibold">{item.guess}</span>
                    </span>
                    <span className={`shrink-0 ${RESULT_TONE[item.result] || ''}`}>
                      {item.result}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
