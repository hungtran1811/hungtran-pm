import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { getErrorMessage, toDate } from './firestore.js';

const SESSIONS = 'showdownSessions';

/** Shared settle delay for showdown step sync across admin, presentation, and student. */
export const SHOWDOWN_SETTLE_MS = 300;

function sessionRef(sessionId) {
  return doc(db, SESSIONS, sessionId);
}

/** Minimal session shape for sync checks (avoids importing showdown.service). */
export function normalizeSessionForSync(id, data) {
  if (!data) return null;
  return {
    id,
    classCode: data.classCode || '',
    stateVersion: Number(data.stateVersion) || 0,
    status: data.status || 'draft',
    currentRound: data.currentRound || 'startup',
    questionIndex: Number(data.questionIndex) || 0,
    activeStudentId: data.activeStudentId || null,
    finishStage: data.finishStage || null,
    finishChoice: data.finishChoice ?? null,
    finishQuestion: data.finishQuestion || null,
    questionDurationSeconds: Number(data.questionDurationSeconds) || 0,
    serverStartedAt: data.serverStartedAt || null,
    revealedAnswer: data.revealedAnswer ?? null,
  };
}

export function getShowdownStepKey(session) {
  if (!session) return '';
  return [
    session.stateVersion ?? 0,
    session.status,
    session.currentRound,
    session.questionIndex,
    session.activeStudentId ?? '',
    session.finishStage ?? '',
    session.finishChoice ?? '',
    session.finishQuestion?.id ?? '',
  ].join('|');
}

export function isShowdownStepReady(session) {
  if (!session) return false;
  if (session.status === 'playing') {
    const dur = Number(session.questionDurationSeconds) || 0;
    if (dur > 0) {
      return Boolean(toDate(session.serverStartedAt));
    }
    return true;
  }
  if (session.status === 'reveal') {
    return Boolean(session.revealedAnswer);
  }
  return true;
}

export function getShowdownSyncMessage(session, prevSession) {
  if (!session) return 'Đang đồng bộ với lớp…';
  if (session.status === 'reveal') return 'Đang công bố đáp án…';
  if (session.finishStage === 'answering') return 'Đang phát đề…';
  if (session.finishStage === 'choosing') return 'Đang chuyển lượt về đích…';
  if (prevSession?.activeStudentId !== session.activeStudentId && session.activeStudentId) {
    return 'Đang chuyển học sinh…';
  }
  if (prevSession?.currentRound !== session.currentRound) return 'Đang bắt đầu vòng mới…';
  if (session.status === 'playing' && prevSession?.status !== 'playing') return 'Đang bắt đầu…';
  if (prevSession?.questionIndex !== session.questionIndex) return 'Đang chuyển câu…';
  return 'Đang đồng bộ với lớp…';
}

export function mapShowdownJoinError(session, err, { classCode } = {}) {
  if (!session) return 'Không tìm thấy phòng thi.';
  if (classCode && session.classCode && session.classCode !== classCode) {
    return 'Phòng thi không thuộc lớp học này.';
  }
  if (session.status === 'draft') return 'Chờ giáo viên mở phòng…';
  if (session.status === 'finished') return 'Phòng thi đã kết thúc.';
  if (err?.code === 'permission-denied') {
    return 'Không thể vào phòng. Kiểm tra tên học sinh đã chọn đúng với danh sách lớp.';
  }
  return getErrorMessage(err);
}

/**
 * Wait until the session reaches minVersion, step is ready, and minMs has elapsed.
 * Resolves { ok: true, session } or { ok: false, timedOut: true }.
 */
export function waitForShowdownStep(
  sessionId,
  { minVersion = 0, minMs = SHOWDOWN_SETTLE_MS, timeoutMs = 8000 } = {},
) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    let unsub = () => {};
    let settleTimer = null;

    const finish = (session) => {
      clearTimeout(failTimer);
      clearTimeout(settleTimer);
      unsub();
      resolve({ ok: true, timedOut: false, session });
    };

    const failTimer = setTimeout(() => {
      clearTimeout(settleTimer);
      unsub();
      resolve({ ok: false, timedOut: true, session: null });
    }, timeoutMs);

    const tryResolve = (session) => {
      if (session.stateVersion < minVersion || !isShowdownStepReady(session)) return;
      const elapsed = Date.now() - startedAt;
      clearTimeout(settleTimer);
      if (elapsed >= minMs) {
        finish(session);
        return;
      }
      settleTimer = setTimeout(() => finish(session), minMs - elapsed);
    };

    unsub = onSnapshot(
      sessionRef(sessionId),
      (snap) => {
        if (!snap.exists()) return;
        tryResolve(normalizeSessionForSync(snap.id, snap.data()));
      },
      () => {
        clearTimeout(failTimer);
        clearTimeout(settleTimer);
        unsub();
        resolve({ ok: false, timedOut: true, session: null });
      },
    );
  });
}
