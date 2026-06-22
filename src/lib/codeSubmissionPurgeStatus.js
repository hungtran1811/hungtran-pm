import { CODE_SUBMISSION_RETENTION_DAYS } from './codeSubmissionLimits.js';
import { isArchivedClassStatus } from '../services/classes.service.js';
import { isClassEligibleForCodePurge, resolveClassCompletedAt } from '../services/codeSubmissions.service.js';

export function getClassCodePurgeStatus(classDoc, fileCount = 0) {
  if (!classDoc) return { state: 'unknown', fileCount };

  if (classDoc.codeSubmissionsPurgedAt) {
    return {
      state: 'purged',
      fileCount: 0,
      purgedAt: classDoc.codeSubmissionsPurgedAt,
    };
  }

  if (!isArchivedClassStatus(classDoc.status)) {
    return {
      state: 'active',
      fileCount,
    };
  }

  const completedAt = resolveClassCompletedAt(classDoc);
  const purgeAt = completedAt
    ? new Date(completedAt.getTime() + CODE_SUBMISSION_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    : null;
  const eligible = isClassEligibleForCodePurge(classDoc);

  if (fileCount === 0 && !eligible) {
    return {
      state: 'empty',
      fileCount: 0,
      completedAt,
      purgeAt,
      daysLeft: purgeAt ? Math.max(0, Math.ceil((purgeAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : null,
    };
  }

  if (eligible) {
    return {
      state: 'eligible',
      fileCount,
      completedAt,
      purgeAt,
      daysLeft: 0,
    };
  }

  const daysLeft = purgeAt
    ? Math.max(0, Math.ceil((purgeAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  return {
    state: fileCount > 0 ? 'waiting' : 'empty',
    fileCount,
    completedAt,
    purgeAt,
    daysLeft,
  };
}

export function formatPurgeStatusLabel(status) {
  switch (status.state) {
    case 'purged':
      return 'Đã dọn file code';
    case 'eligible':
      return status.fileCount > 0
        ? `Sẵn sàng dọn · ${status.fileCount} file`
        : 'Sẵn sàng dọn (không còn file)';
    case 'waiting':
      return status.fileCount > 0
        ? `Còn ${status.daysLeft} ngày · ${status.fileCount} file`
        : `Còn ${status.daysLeft} ngày đến hạn dọn`;
    case 'empty':
      return 'Không có file code';
    case 'active':
      return status.fileCount > 0 ? `${status.fileCount} file đang lưu` : 'Lớp đang hoạt động';
    default:
      return '—';
  }
}

export function purgeStatusTone(state) {
  switch (state) {
    case 'purged':
      return 'slate';
    case 'eligible':
      return 'amber';
    case 'waiting':
      return 'blue';
    case 'active':
      return 'green';
    default:
      return 'slate';
  }
}
