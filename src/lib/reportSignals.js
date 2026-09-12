import { toDate } from './firestore.js';

export const FRESH_ACTIVITY_MS = 4 * 60 * 60 * 1000;

export function activityTimestamp(value) {
  return toDate(value)?.getTime() || 0;
}

export function lastActivityTime(item) {
  const times = [
    activityTimestamp(item?.report?.submittedAt),
    activityTimestamp(item?.student?.lastReportedAt),
    activityTimestamp(item?.drive?.latest?.submittedAt),
  ];
  for (const file of item?.drive?.files || []) {
    times.push(activityTimestamp(file.submittedAt));
  }
  return Math.max(0, ...times);
}

export function completionSignal(item, { showReport = true, showDrive = false } = {}) {
  if (item?.isComplete) return 'green';
  if (showReport && showDrive) {
    if (item?.hasReport || item?.hasFile) return 'yellow';
    return 'red';
  }
  if (showDrive) return item?.hasFile ? 'green' : 'red';
  return item?.hasReport ? 'green' : 'red';
}

export function signalLabel(signal, { showReport = true, showDrive = false } = {}) {
  if (signal === 'green') {
    if (showReport && showDrive) return 'Đủ';
    return showDrive ? 'Đã nộp' : 'Đã gửi';
  }
  if (signal === 'yellow') return 'Thiếu một phần';
  if (showReport && showDrive) return 'Chưa có';
  return showDrive ? 'Chưa nộp' : 'Chưa gửi';
}

export function isFreshActivity(item, now = Date.now()) {
  const time = lastActivityTime(item);
  return time > 0 && now - time <= FRESH_ACTIVITY_MS;
}

export function formatActivityLabel(value, now = Date.now()) {
  const time = activityTimestamp(value);
  if (!time) return '';
  const diff = Math.max(0, now - time);
  if (diff < 60 * 1000) return 'Vừa xong';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} phút trước`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} giờ trước`;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

export function sortByRecentActivity(items = []) {
  return [...items].sort((left, right) => {
    const timeDiff = lastActivityTime(right) - lastActivityTime(left);
    if (timeDiff) return timeDiff;
    return String(left.student?.fullName || '').localeCompare(String(right.student?.fullName || ''), 'vi');
  });
}
