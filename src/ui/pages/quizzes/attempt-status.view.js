import { formatDateTime } from '../../../utils/date.js';
import { escapeHtml } from '../../../utils/html.js';
import { QUIZ_ATTEMPT_STATUS_REOPENED } from '../../../utils/quiz.js';

export function hasAttemptRetakeAfterReopen(attempt) {
  if (!attempt?.reopenedAt || !attempt?.submittedAt) {
    return false;
  }

  const reopenedTime = attempt.reopenedAt instanceof Date ? attempt.reopenedAt.getTime() : 0;
  const submittedTime = attempt.submittedAt instanceof Date ? attempt.submittedAt.getTime() : 0;

  return submittedTime > reopenedTime && Number(attempt.submissionCount || 0) > 1;
}

export function getAttemptStatusMeta(attempt) {
  if (!attempt) {
    return {
      label: 'Chưa rõ',
      badgeClass: 'text-bg-secondary',
      detail: '',
    };
  }

  if (attempt.status === QUIZ_ATTEMPT_STATUS_REOPENED) {
    return {
      label: 'Đang chờ làm lại',
      badgeClass: 'text-bg-warning text-dark',
      detail: 'Học sinh này đã được mở lại và có thể vào làm lại ngay bây giờ.',
    };
  }

  if (hasAttemptRetakeAfterReopen(attempt)) {
    return {
      label: 'Đã nộp lại',
      badgeClass: 'text-bg-info',
      detail: `Học sinh đã nộp lại sau khi được mở vào ${formatDateTime(attempt.submittedAt)}.`,
    };
  }

  return {
    label: 'Đã nộp',
    badgeClass: 'text-bg-success',
    detail:
      Number(attempt.submissionCount || 0) > 1
        ? `Học sinh đã nộp tổng cộng ${attempt.submissionCount} lần. Hệ thống đang lấy điểm cao nhất để hiển thị.`
        : 'Học sinh đã nộp bài và chưa được mở lại.',
  };
}

export function getAttemptStatusBadge(attempt) {
  const statusMeta = getAttemptStatusMeta(attempt);
  return `<span class="badge ${statusMeta.badgeClass}">${escapeHtml(statusMeta.label)}</span>`;
}

export function getAttemptSourceBadge(attempt) {
  if (attempt?.source !== 'admin-preview') {
    return '';
  }

  return '<span class="badge text-bg-light text-dark border">Admin review</span>';
}

export function renderAttemptScore(attempt) {
  if (!attempt?.gradingReady) {
    return 'Chưa chấm được';
  }

  return `${attempt.correctCount}/${attempt.questionCount} (${attempt.score}%)`;
}
