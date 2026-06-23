import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Home, Search, UserX } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { Spinner } from '../../ui/components/Spinner.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { spyStatusLabel } from '../../lib/spyConstants.js';
import { getErrorMessage } from '../../lib/firestore.js';
import {
  joinSpySession,
  subscribeSpyParticipant,
  subscribeSpySession,
  submitSpyVote,
} from '../../services/spy.service.js';

export function SpyStudentView({ sessionId, classCode, student, classStudents = [], onExit }) {
  const toast = useToast();
  const [session, setSession] = useState(null);
  const [self, setSelf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [voted, setVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sessionId) return undefined;
    setLoading(true);
    const unsub = subscribeSpySession(
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
    if (!sessionId || !student?.id) return undefined;
    return subscribeSpyParticipant(sessionId, student.id, setSelf, () => {});
  }, [sessionId, student?.id]);

  useEffect(() => {
    if (session?.status === 'lobby' || session?.status === 'describe') {
      setVoted(false);
    }
  }, [session?.status]);

  useEffect(() => {
    if (!sessionId || !student?.id || session?.status !== 'lobby') return;
    setJoining(true);
    joinSpySession(sessionId, { studentId: student.id, studentName: student.fullName })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setJoining(false));
  }, [sessionId, student?.id, student?.fullName, session?.status, toast]);

  const voteTargets = useMemo(() => {
    if (!session?.presentStudentIds) return [];
    const nameById = new Map(classStudents.map((s) => [s.id, s.fullName]));
    return session.presentStudentIds
      .filter((id) => id !== student?.id)
      .map((id) => ({ id, name: nameById.get(id) || id }));
  }, [session?.presentStudentIds, student?.id, classStudents]);

  const handleVote = async (targetStudentId) => {
    if (submitting || voted) return;
    setSubmitting(true);
    try {
      await submitSpyVote(sessionId, { voterId: student.id, targetStudentId });
      setVoted(true);
      toast.success('Đã bỏ phiếu.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner label="Đang tải phòng chơi..." />
      </div>
    );
  }

  const isSpyRevealed = session.status === 'reveal' && session.revealedSpyIds?.includes(student.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Truy tìm gián điệp</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{student.fullName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="brand">{spyStatusLabel(session.status)}</Badge>
          <Button type="button" variant="subtle" size="sm" onClick={onExit}>
            <Home className="h-4 w-4" />
            Thoát
          </Button>
        </div>
      </div>

      {session.status === 'lobby' && (
        <div className="card p-6 text-center">
          <Search className="mx-auto h-10 w-10 text-brand-500" />
          <p className="mt-3 font-medium text-slate-800 dark:text-slate-100">
            {joining ? 'Đang vào phòng...' : self ? 'Đã trong phòng' : 'Đang chờ vào phòng...'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {self
              ? 'Chờ giáo viên bắt đầu ván — không cần thoát khi chơi ván tiếp theo.'
              : 'Chờ giáo viên mở phòng.'}
          </p>
        </div>
      )}

      {(session.status === 'describe' || session.status === 'vote') && self?.assignedWord && (
        <div className="card border-2 border-brand-200 bg-gradient-to-br from-brand-50 to-violet-50 p-6 text-center dark:border-brand-500/30 dark:from-brand-500/10 dark:to-violet-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cụm từ của bạn</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white sm:text-4xl">
            {self.assignedWord}
          </p>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            {session.status === 'describe'
              ? 'Hãy mô tả cụm từ này bằng lời — không nói trực tiếp từ trên màn hình.'
              : 'Vòng mô tả đã xong. Hãy bỏ phiếu ai là gián điệp.'}
          </p>
        </div>
      )}

      {session.status === 'vote' && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Chọn người nghi là gián điệp:</p>
          {voted ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              <CheckCircle2 className="h-4 w-4" />
              Đã gửi phiếu — chờ giáo viên công bố.
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {voteTargets.map((target) => (
                <li key={target.id}>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-start"
                    disabled={submitting}
                    onClick={() => handleVote(target.id)}
                  >
                    <UserX className="h-4 w-4" />
                    {target.name}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {session.status === 'reveal' && (
        <div className="card space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Dân thường</p>
              <p className="mt-1 text-lg font-bold">{session.civilianWord}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10">
              <p className="text-xs font-semibold text-red-700 dark:text-red-300">Gián điệp</p>
              <p className="mt-1 text-lg font-bold">{session.spyWord}</p>
            </div>
          </div>
          {isSpyRevealed && (
            <p className="text-center text-sm font-medium text-red-600 dark:text-red-400">
              Bạn là gián điệp trong ván này.
            </p>
          )}
          {!isSpyRevealed && session.revealedSpyIds?.length > 0 && (
            <p className="text-center text-sm text-slate-600 dark:text-slate-300">
              Gián điệp đã được công bố trên màn hình lớp.
            </p>
          )}
        </div>
      )}

      {session.status === 'finished' && (
        <div className="card p-5 text-center text-sm text-slate-600 dark:text-slate-300">
          Phòng đã đóng. Nhờ giáo viên mở phòng mới nếu muốn chơi tiếp.
        </div>
      )}
    </div>
  );
}
