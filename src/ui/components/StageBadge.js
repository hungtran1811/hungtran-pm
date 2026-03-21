import { escapeHtml } from '../../utils/html.js';

export function renderStageBadge(stage) {
  return `<span class="badge bg-light text-dark border">${escapeHtml(stage || 'Chưa cập nhật')}</span>`;
}
