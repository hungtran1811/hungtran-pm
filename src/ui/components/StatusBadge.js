import { STATUS_BADGES } from '../../constants/statuses.js';
import { escapeHtml } from '../../utils/html.js';

export function renderStatusBadge(status) {
  const badgeClass = STATUS_BADGES[status] || 'secondary';
  return `<span class="badge text-bg-${badgeClass}">${escapeHtml(status || 'Chưa cập nhật')}</span>`;
}
