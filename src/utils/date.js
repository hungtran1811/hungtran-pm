import { EMPTY_VALUE } from '../constants/messages.js';

const TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function toDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }

  return null;
}

export function formatDate(value) {
  const date = toDate(value);

  if (!date) {
    return EMPTY_VALUE;
  }

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value) {
  const date = toDate(value);

  if (!date) {
    return EMPTY_VALUE;
  }

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function toDateKey(value = new Date()) {
  const date = toDate(value) ?? new Date();

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isToday(value) {
  return toDateKey(value) === toDateKey(new Date());
}

export function daysSince(value) {
  const date = toDate(value);

  if (!date) {
    return Number.POSITIVE_INFINITY;
  }

  const diff = Date.now() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function startOfToday() {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
