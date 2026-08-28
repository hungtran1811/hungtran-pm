export const SPY_SESSION_STATUSES = [
  'draft',
  'lobby',
  'describe',
  'playing',
  'sabotage_alert',
  'vote',
  'tie_debate',
  'tie_revote',
  'reveal',
  'finished',
];

export const SPY_ACTIVE_STATUSES = [
  'lobby',
  'describe',
  'playing',
  'sabotage_alert',
  'vote',
  'tie_debate',
  'tie_revote',
  'reveal',
];

export const SPY_TIE_DEBATE_SECONDS = 60;
export const SPY_SABOTAGE_COOLDOWN_MIN_SECONDS = 30;
export const SPY_SABOTAGE_COOLDOWN_MAX_SECONDS = 45;
/** Giá trị mặc định khi cần ước lượng (thực tế random 30–45 mỗi lần phá). */
export const SPY_SABOTAGE_COOLDOWN_SECONDS = 40;
export const SPY_CREW_VOTE_RESOLVE_SECONDS = 5;
export const SPY_CREW_TASK_FAIL_COOLDOWN_MIN_SECONDS = 5;
export const SPY_CREW_TASK_FAIL_COOLDOWN_MAX_SECONDS = 10;
/** Thời gian hiệu ứng đúng/sai mini-game (ms) — đồng bộ toast + CSS animation. */
export const SPY_CREW_FEEDBACK_SUCCESS_MS = 500;
export const SPY_CREW_FEEDBACK_FAIL_MS = 400;
/** Delay khi chuyển mini-game để tránh overload / đơ UI. */
export const SPY_CREW_GAME_SWITCH_MS = 550;
export const SPY_MAX_SPY_ASSIGNMENTS_PER_PLAYER = 3;
/** Giới hạn trên cho completedCount cá nhân — không còn quota, chỉ để rules validate. */
export const SPY_CREW_TASK_PROGRESS_CAP = 999;
/** ID đặc biệt cho phiếu trắng (bỏ qua vòng vote). */
export const SPY_BLANK_VOTE_ID = '__blank__';
export const SPY_MODES = {
  word: 'Đoán từ',
  crew: 'Phi hành đoàn',
};

export const SPY_STATUS_LABELS = {
  draft: 'Nháp',
  lobby: 'Phòng chờ',
  describe: 'Mô tả',
  playing: 'Đang làm nhiệm vụ',
  sabotage_alert: 'Hệ thống bị xâm nhập',
  vote: 'Bỏ phiếu',
  tie_debate: 'Biện luận hòa',
  tie_revote: 'Đổi phiếu',
  reveal: 'Công bố',
  finished: 'Kết thúc',
};

export function spyStatusLabel(status) {
  return SPY_STATUS_LABELS[status] || status;
}

export const SPY_OUTCOME_LABELS = {
  civilians: 'Dân thường thắng',
  spies: 'Gián điệp thắng',
};

export const SPY_CREW_OUTCOME_LABELS = {
  civilians: 'Phi hành đoàn thắng',
  spies: 'Gián điệp thắng',
};

export function spyOutcomeLabel(outcome, mode = 'word') {
  const labels = mode === 'crew' ? SPY_CREW_OUTCOME_LABELS : SPY_OUTCOME_LABELS;
  return labels[outcome] || '';
}

/** Nhãn vai trò thống nhất trên Stage / Roster / học sinh. */
export function spyRoleLabel(mode, isSpy, { short = false } = {}) {
  if (isSpy) return 'Gián điệp';
  if (mode === 'crew') return 'Phi hành đoàn';
  return short ? 'Dân' : 'Dân thường';
}
