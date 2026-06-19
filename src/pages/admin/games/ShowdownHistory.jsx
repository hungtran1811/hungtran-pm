import { useEffect, useState } from 'react';
import { Crown, History } from 'lucide-react';
import { Modal } from '../../../ui/components/Modal.jsx';
import { useToast } from '../../../ui/components/Toast.jsx';
import { getErrorMessage, toDate } from '../../../lib/firestore.js';
import {
  getShowdownSessionResults,
  listFinishedSessions,
} from '../../../services/showdown.service.js';

function formatDate(value) {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ShowdownHistory({ classCode, onClose }) {
  const toast = useToast();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [results, setResults] = useState({});
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    if (!classCode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    listFinishedSessions(classCode)
      .then(setSessions)
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [classCode, toast]);

  const toggle = async (sessionId) => {
    if (openId === sessionId) {
      setOpenId(null);
      return;
    }
    setOpenId(sessionId);
    if (results[sessionId]) return;
    setLoadingResults(true);
    try {
      const list = await getShowdownSessionResults(sessionId);
      setResults((prev) => ({ ...prev, [sessionId]: list }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingResults(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Lịch sử phiên Coding Showdown" size="lg">
      {!classCode ? (
        <p className="py-8 text-center text-sm text-slate-500">Chọn lớp để xem lịch sử.</p>
      ) : loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Đang tải lịch sử...</p>
      ) : sessions.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          <History className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          Chưa có phiên nào kết thúc cho lớp {classCode}.
        </p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const isOpen = openId === s.id;
            const winners = results[s.id] || [];
            return (
              <div key={s.id} className="rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {formatDate(s.finishedAt) || formatDate(s.createdAt)}
                    </p>
                    <p className="text-xs text-slate-400">{s.config?.matrixName || 'Ma trận mặc định'}</p>
                  </div>
                  <span className="text-xs text-brand-600 dark:text-brand-300">
                    {isOpen ? 'Ẩn' : 'Xem kết quả'}
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                    {loadingResults && !results[s.id] ? (
                      <p className="text-center text-sm text-slate-500">Đang tải kết quả...</p>
                    ) : winners.length === 0 ? (
                      <p className="text-center text-sm text-slate-500">Không có dữ liệu thí sinh.</p>
                    ) : (
                      <ol className="space-y-1.5">
                        {winners.map((p, i) => (
                          <li
                            key={p.id}
                            className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
                          >
                            <span className="flex h-6 w-6 items-center justify-center font-bold text-slate-400">
                              {i === 0 ? <Crown className="h-4 w-4 text-amber-400" /> : i + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{p.studentName}</span>
                            <span className="font-bold tabular-nums">{p.totalScore}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
