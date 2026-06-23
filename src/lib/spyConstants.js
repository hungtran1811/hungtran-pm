export const SPY_SESSION_STATUSES = ['draft', 'lobby', 'describe', 'vote', 'reveal', 'finished'];

export const SPY_ACTIVE_STATUSES = ['lobby', 'describe', 'vote', 'reveal'];

export const SPY_STATUS_LABELS = {
  draft: 'Nháp',
  lobby: 'Phòng chờ',
  describe: 'Mô tả',
  vote: 'Bỏ phiếu',
  reveal: 'Công bố',
  finished: 'Kết thúc',
};

export function spyStatusLabel(status) {
  return SPY_STATUS_LABELS[status] || status;
}
