import { Clock, Mic, Trophy, Users } from 'lucide-react';
import { ShowdownLeaderboard } from '../../../ui/components/games/ShowdownLeaderboard.jsx';
import {
  ShowdownQuestionBody,
  ShowdownQuestionMetaBar,
  ShowdownRoundIntroCards,
} from '../../../ui/components/games/ShowdownSessionUi.jsx';
import { assignParticipantRanks } from '../../../services/showdown.service.js';
import { roundLabel } from '../../../lib/showdownConstants.js';

function QuestionPanel({
  session,
  question,
  roundProgress,
  countdown,
  presenting,
  submittedCount,
  totalCount,
}) {
  const isOral = session.roundMode === 'oral';
  const isCode = question?.questionType === 'code';
  const reveal = session.revealedAnswer;
  const isReveal = session.status === 'reveal';
  const isFinish = session.currentRound === 'finish';
  const finishChoosing = isFinish && session.finishStage === 'choosing';
  const finishChoice = session.finishChoice;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-bold text-white ${
            presenting ? 'text-lg' : 'text-sm'
          }`}
        >
          {isOral ? <Mic className="h-4 w-4 text-cyan-300" /> : <Trophy className="h-4 w-4 text-amber-300" />}
          {roundLabel(session.currentRound)}
        </span>
        {roundProgress && (
          <span className={`font-semibold text-white/70 ${presenting ? 'text-base' : 'text-sm'}`}>
            {roundProgress.studentTotal ? `HS ${roundProgress.studentIndex}/${roundProgress.studentTotal} · ` : ''}
            Câu {roundProgress.current}/{roundProgress.total}
          </span>
        )}
        {session.status === 'playing' && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 font-mono font-bold tabular-nums text-white ${
              presenting ? 'text-2xl' : 'text-lg'
            }`}
          >
            <Clock className={presenting ? 'h-6 w-6' : 'h-4 w-4'} />
            {countdown}
          </span>
        )}
      </div>

      {isOral && session.activeStudentName && (
        <div
          className={`mb-3 rounded-2xl border border-cyan-300/40 bg-cyan-400/10 px-4 py-3 text-center ${
            presenting ? '' : ''
          }`}
        >
          <p className={`font-semibold uppercase tracking-wide text-cyan-200 ${presenting ? 'text-base' : 'text-xs'}`}>Học sinh đang trả lời</p>
          <p className={`font-black text-white ${presenting ? 'text-5xl leading-tight' : 'text-2xl'}`}>
            {session.activeStudentName}
          </p>
        </div>
      )}

      {isOral && !session.activeStudentName && session.status === 'playing' && (
        <div className="mb-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-center">
          <p className={`text-white/70 ${presenting ? 'text-xl' : 'text-base'}`}>
            Chọn học sinh để bắt đầu lượt vấn đáp
          </p>
        </div>
      )}

      {isFinish && finishChoice ? (
        <div
          className={`mx-auto mb-3 inline-flex items-center gap-2 rounded-full border-2 border-amber-300/60 bg-amber-400/20 font-black text-amber-200 ${
            presenting ? 'px-6 py-2 text-2xl' : 'px-4 py-1 text-base'
          }`}
        >
          Gói {finishChoice}đ
          <span className={`font-semibold text-amber-100/80 ${presenting ? 'text-lg' : 'text-xs'}`}>
            ({finishChoice === 10 ? 'Dễ' : finishChoice === 20 ? 'Trung bình' : 'Khó'})
          </span>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        {finishChoosing ? (
          <div className="text-center">
            <p className={`text-white/70 ${presenting ? 'text-2xl' : 'text-lg'}`}>Lượt về đích của</p>
            <p className={`font-black text-amber-200 ${presenting ? 'text-6xl leading-tight' : 'text-4xl'}`}>
              {session.activeStudentName || '...'}
            </p>
            <p className={`mt-4 text-white/60 ${presenting ? 'text-xl' : 'text-base'}`}>
              Đang chọn gói điểm: <span className="font-bold text-white">10đ · 20đ · 30đ</span>
            </p>
          </div>
        ) : question ? (
          <div className={`text-center ${presenting ? 'space-y-6' : 'space-y-4'}`}>
            <ShowdownQuestionMetaBar
              question={question}
              variant="dark"
              size={presenting ? 'lg' : 'md'}
            />
            <p
              className={`mx-auto font-bold uppercase tracking-[0.2em] text-cyan-300/80 ${
                presenting ? 'text-base' : 'text-xs'
              }`}
            >
              {isCode ? 'Đề bài' : 'Câu hỏi'}
            </p>
            <ShowdownQuestionBody
              question={question}
              variant="dark"
              size={presenting ? 'lg' : 'md'}
            />
            {!isOral && isCode && session.status === 'playing' && (
              <div className={`mx-auto max-w-3xl rounded-2xl border border-cyan-300/40 bg-cyan-400/10 px-5 py-4 font-semibold text-cyan-100 ${presenting ? 'text-2xl' : 'text-base'}`}>
                Học sinh đang viết code trên thiết bị...
              </div>
            )}

            {!isOral && isCode && isReveal && reveal?.referenceSolution && (
              <div className="mx-auto max-w-2xl text-left">
                <p className={`mb-1 font-semibold text-green-300 ${presenting ? 'text-xl' : 'text-sm'}`}>
                  Lời giải tham khảo
                </p>
                <pre
                  className={`overflow-x-auto rounded-xl bg-black/60 text-emerald-300 ${presenting ? 'p-6 text-lg' : 'p-4 text-sm'}`}
                >
                  <code>{reveal.referenceSolution}</code>
                </pre>
              </div>
            )}

            {!isOral && question.options?.length > 0 && (
              <div className={`mx-auto grid gap-3 ${presenting ? 'max-w-4xl sm:grid-cols-2' : 'max-w-2xl'}`}>
                {question.options.map((opt, i) => {
                  const isCorrect = isReveal && reveal?.correctIndex === i;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 rounded-2xl border text-left ${
                        presenting ? 'px-6 py-4 text-2xl' : 'px-4 py-2.5 text-sm'
                      } ${
                        isCorrect
                          ? 'border-green-400 bg-green-400/25 text-white shadow-lg'
                          : 'border-white/15 bg-white/5 text-white/85'
                      }`}
                    >
                      <span
                        className={`flex shrink-0 items-center justify-center rounded-full font-black ${
                          presenting ? 'h-10 w-10 text-xl' : 'h-6 w-6 text-sm'
                        } ${isCorrect ? 'bg-green-400 text-slate-900' : 'bg-white/15 text-white/70'}`}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="min-w-0 flex-1">{opt}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {isReveal && isOral && reveal && (
              <div className="space-y-2">
                <p
                  className={`font-bold ${
                    reveal.oralOutcome === 'correct'
                      ? 'text-green-400'
                      : reveal.oralOutcome === 'wrong'
                        ? 'text-red-400'
                        : 'text-amber-300'
                  } ${presenting ? 'text-2xl' : 'text-base'}`}
                >
                  {reveal.oralOutcome === 'correct'
                    ? `Chính xác! +${reveal.pointsEarned} điểm`
                    : reveal.oralOutcome === 'wrong'
                      ? 'Chưa đúng — không cộng điểm'
                      : 'Bỏ qua câu này'}
                </p>
                {reveal.correctText && (
                  <div
                    className={`mx-auto max-w-3xl rounded-2xl border-2 border-green-400/60 bg-green-400/15 text-green-100 shadow-lg ${
                      presenting ? 'px-8 py-5' : 'px-4 py-3'
                    }`}
                  >
                    <p className={`font-bold uppercase tracking-wide text-green-300/90 ${presenting ? 'text-base' : 'text-xs'}`}>
                      Đáp án đúng
                    </p>
                    <p className={`font-black text-white ${presenting ? 'text-4xl leading-tight' : 'text-xl'}`}>
                      {reveal.correctText}
                    </p>
                  </div>
                )}
              </div>
            )}

            {isReveal && !isOral && reveal && (
              <p className={`font-bold text-green-400 ${presenting ? 'text-2xl' : 'text-base'}`}>
                Đáp án:{' '}
                {reveal.correctIndex != null && question.options
                  ? `${String.fromCharCode(65 + reveal.correctIndex)} — ${question.options[reveal.correctIndex]}`
                  : reveal.correctText}
              </p>
            )}

            {!isOral && session.status === 'playing' && submittedCount != null && (
              <p className={`inline-flex items-center gap-1.5 text-white/60 ${presenting ? 'text-lg' : 'text-sm'}`}>
                <Users className={presenting ? 'h-5 w-5' : 'h-4 w-4'} />
                Đã nộp: {submittedCount}/{totalCount}
              </p>
            )}
          </div>
        ) : (
          <p className="text-center text-white/50">Đang chờ câu hỏi...</p>
        )}
      </div>
    </div>
  );
}

export function ShowdownStage({
  session,
  question,
  participants,
  roundProgress,
  countdown,
  submittedCount,
  totalCount,
  presenting,
}) {
  if (session.status === 'finished') {
    const ranked = assignParticipantRanks(participants);
    const top = ranked.slice(0, 3);
    const podiumHeights = (score, rank) => {
      const tiedAtTop = top.filter((p) => p.totalScore === score).length > 1;
      if (tiedAtTop && rank <= 2) return 'h-36';
      if (rank === 1) return 'h-40';
      if (rank === 2) return 'h-32';
      return 'h-24';
    };
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6">
        <h2 className={`font-black text-white ${presenting ? 'text-5xl' : 'text-2xl'}`}>
          Kết quả chung cuộc
        </h2>
        <div className="flex items-end justify-center gap-4">
          {top.map((p, i) => {
            const colors = ['bg-amber-400/30 border-amber-300', 'bg-slate-300/20 border-slate-200', 'bg-orange-400/20 border-orange-300'];
            const order = [1, 0, 2];
            const pos = order.indexOf(i);
            return (
              <div key={p.id} style={{ order: pos }} className="flex flex-col items-center gap-2">
                <span className={`font-bold text-white ${presenting ? 'text-2xl' : 'text-base'}`}>
                  {p.studentName}
                </span>
                <div
                  className={`flex w-24 items-end justify-center rounded-t-xl border-2 pb-2 ${podiumHeights(p.totalScore, p.rank)} ${colors[i]}`}
                >
                  <span className={`font-black text-white ${presenting ? 'text-3xl' : 'text-xl'}`}>
                    {p.totalScore}
                  </span>
                </div>
                <span className="font-bold text-white/60">Hạng {p.rank}</span>
              </div>
            );
          })}
        </div>
        <div className={`w-full ${presenting ? 'max-w-md' : 'max-w-sm'}`} style={{ height: presenting ? '40vh' : '16rem' }}>
          <ShowdownLeaderboard participants={participants} presenting={presenting} title="Toàn lớp" />
        </div>
      </div>
    );
  }

  if (session.status === 'lobby') {
    return (
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className={`text-white/80 ${presenting ? 'text-2xl' : 'text-lg'}`}>
            Phòng chờ — Coding Showdown
          </p>
          <p className={`font-black text-cyan-300 ${presenting ? 'text-7xl' : 'text-5xl'}`}>
            {participants.length}
          </p>
          <p className={`text-white/60 ${presenting ? 'text-xl' : 'text-base'}`}>
            học sinh đã sẵn sàng
          </p>
          <div className={`w-full ${presenting ? 'max-w-4xl' : 'max-w-lg'}`}>
            <ShowdownRoundIntroCards session={session} presenting={presenting} />
          </div>
        </div>
        <div className={presenting ? 'w-[320px]' : 'w-[260px]'}>
          <ShowdownLeaderboard participants={participants} presenting={presenting} title="Đã vào phòng" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <QuestionPanel
        session={session}
        question={question}
        roundProgress={roundProgress}
        countdown={countdown}
        presenting={presenting}
        submittedCount={submittedCount}
        totalCount={totalCount}
      />
      <div className={`shrink-0 ${presenting ? 'w-[320px]' : 'w-[260px]'}`}>
        <ShowdownLeaderboard
          participants={participants}
          activeStudentId={session.activeStudentId}
          presenting={presenting}
        />
      </div>
    </div>
  );
}
