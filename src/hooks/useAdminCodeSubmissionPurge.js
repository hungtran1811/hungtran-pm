import { useEffect, useRef } from 'react';
import { purgeExpiredCodeSubmissions } from '../services/codeSubmissions.service.js';

const PURGE_STORAGE_KEY = 'hungtran-pm-code-purge-ts';
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Chạy dọn file code lớp đã hoàn thành > 30 ngày (tối đa 1 lần / 24h khi admin đăng nhập).
 */
export function useAdminCodeSubmissionPurge(isAdmin, toast) {
  const running = useRef(false);

  useEffect(() => {
    if (!isAdmin || running.current) return;

    const lastRun = Number(localStorage.getItem(PURGE_STORAGE_KEY) || 0);
    if (Date.now() - lastRun < PURGE_INTERVAL_MS) return;

    running.current = true;
    purgeExpiredCodeSubmissions()
      .then((results) => {
        localStorage.setItem(PURGE_STORAGE_KEY, String(Date.now()));
        if (results.length && toast) {
          const totalDeleted = results.reduce((sum, r) => sum + r.deletedFiles, 0);
          toast.success(
            `Tự dọn: đã xóa ${totalDeleted} file code của ${results.length} lớp (${results.map((r) => r.classCode).join(', ')}).`,
          );
        }
      })
      .catch((error) => {
        console.warn('[code-purge] Không thể dọn file code:', error);
      })
      .finally(() => {
        running.current = false;
      });
  }, [isAdmin, toast]);
}

export function getLastAutoPurgeTimestamp() {
  const ts = Number(localStorage.getItem(PURGE_STORAGE_KEY) || 0);
  return ts > 0 ? new Date(ts) : null;
}
