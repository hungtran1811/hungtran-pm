import { DEFAULT_FALLBACK_ERROR, FIREBASE_ERROR_MESSAGES } from '../constants/messages.js';

function normalizeErrorCode(error) {
  const rawCode = String(error?.code ?? '').trim();

  if (rawCode) {
    return rawCode;
  }

  const message = String(error?.message ?? '').trim().toLowerCase();

  if (!message) {
    return '';
  }

  if (message === 'internal') {
    return 'internal';
  }

  if (message.includes('missing or insufficient permissions')) {
    return 'permission-denied';
  }

  if (message.includes('index') && (message.includes('building') || message.includes('create it here'))) {
    return 'index-building';
  }

  return '';
}

export function mapFirebaseError(error, fallbackMessage = DEFAULT_FALLBACK_ERROR) {
  const code = normalizeErrorCode(error);

  if (code === 'index-building') {
    return 'Firestore đang tạo index cho truy vấn này. Vui lòng chờ thêm ít phút rồi thử lại.';
  }

  if (code && FIREBASE_ERROR_MESSAGES[code]) {
    return FIREBASE_ERROR_MESSAGES[code];
  }

  const rawMessage = String(error?.message ?? '').trim();

  if (rawMessage && rawMessage.toLowerCase().includes('index') && rawMessage.toLowerCase().includes('building')) {
    return 'Firestore đang tạo index cho truy vấn này. Vui lòng chờ thêm ít phút rồi thử lại.';
  }

  if (
    rawMessage &&
    rawMessage.toLowerCase() !== 'internal' &&
    rawMessage.toLowerCase() !== code.toLowerCase()
  ) {
    return rawMessage;
  }

  return fallbackMessage;
}

export function toAppError(error, fallbackMessage = DEFAULT_FALLBACK_ERROR) {
  const appError = new Error(mapFirebaseError(error, fallbackMessage));
  appError.code = error?.code || '';
  appError.cause = error;
  return appError;
}
