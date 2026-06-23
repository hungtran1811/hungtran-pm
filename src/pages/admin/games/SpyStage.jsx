import { Badge } from '../../../ui/components/Badge.jsx';

export function SpyStage({
  session,
  participants = [],
  votes = [],
  tally = [],
  speakerName = '',
  civilianWord = '',
  spyWord = '',
  presenting = false,
  hideWords = false,
  spyNames = [],
}) {
  if (!session) return null;

  const voteCount = votes.length;
  const playerCount = participants.length;
  const showWords = session.status === 'reveal' && !hideWords;
  const revealCivilian = session.civilianWord || civilianWord;
  const revealSpy = session.spyWord || spyWord;
  const titleClass = presenting
    ? 'text-4xl font-black text-white sm:text-5xl md:text-6xl'
    : 'text-2xl font-bold text-slate-900 dark:text-white';

  return (
    <div className={`space-y-6 text-center ${presenting ? 'py-6' : ''}`}>
      <div>
        <p className={`mb-2 text-xs font-semibold uppercase tracking-[0.2em] ${presenting ? 'text-brand-300' : 'text-slate-500'}`}>
          Truy tìm gián điệp
        </p>
        <h2 className={titleClass}>
          {session.status === 'describe' && 'Vòng mô tả'}
          {session.status === 'vote' && 'Bỏ phiếu'}
          {session.status === 'reveal' && 'Kết quả'}
          {session.status === 'lobby' && 'Phòng chờ'}
        </h2>
      </div>

      {session.status === 'lobby' && (
        <p className={presenting ? 'text-xl text-slate-200' : 'text-slate-600 dark:text-slate-300'}>
          {playerCount} / {session.presentStudentIds.length} học sinh đã vào phòng
        </p>
      )}

      {session.status === 'describe' && (
        <div className="space-y-3">
          <p className={presenting ? 'text-2xl text-amber-200' : 'text-lg font-medium text-amber-700 dark:text-amber-300'}>
            Lượt mô tả: {speakerName || '—'}
          </p>
          <p className={presenting ? 'text-slate-300' : 'text-sm text-slate-500'}>
            {(session.describeIndex ?? 0) + 1} / {session.describeOrder?.length || 0}
          </p>
          <p className={presenting ? 'text-lg text-slate-300' : 'text-sm text-slate-500'}>
            Mô tả bằng lời — không nói trực tiếp cụm từ trên màn hình
          </p>
        </div>
      )}

      {session.status === 'vote' && (
        <div className="space-y-2">
          <p className={presenting ? 'text-xl text-slate-200' : 'text-slate-600'}>
            Đã vote: {voteCount} / {playerCount}
          </p>
        </div>
      )}

      {session.status === 'reveal' && showWords && (
        <div className="mx-auto max-w-xl space-y-4">
          <div className={`rounded-2xl border p-4 ${presenting ? 'border-emerald-500/40 bg-emerald-950/40' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">Dân thường</p>
            <p className={`mt-1 font-bold ${presenting ? 'text-3xl text-white' : 'text-xl'}`}>{revealCivilian}</p>
          </div>
          <div className={`rounded-2xl border p-4 ${presenting ? 'border-red-500/40 bg-red-950/40' : 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-300">Gián điệp</p>
            <p className={`mt-1 font-bold ${presenting ? 'text-3xl text-white' : 'text-xl'}`}>{revealSpy}</p>
          </div>
          {spyNames.length > 0 && (
            <p className={`text-center font-semibold ${presenting ? 'text-xl text-red-300' : 'text-red-600 dark:text-red-400'}`}>
              Gián điệp: {spyNames.join(', ')}
            </p>
          )}
          {tally.length > 0 && (
            <ul className="space-y-2 text-left">
              {tally.map((row) => (
                <li
                  key={row.studentId}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 ${presenting ? 'bg-slate-800/60 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
                >
                  <span>{row.studentName}</span>
                  <Badge tone="slate">{row.count} phiếu</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
