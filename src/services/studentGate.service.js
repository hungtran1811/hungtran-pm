import { FUNCTIONS_BASE } from '../config/submissionConfig.js';
import { auth } from '../config/firebase.js';

function functionsUrl(name) {
  const base = (import.meta.env.VITE_NETLIFY_FUNCTIONS_BASE || FUNCTIONS_BASE).replace(/\/$/, '');
  return `${base}/${name}`;
}

async function postGate(name, body, { admin = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (admin) {
    const token = await auth.currentUser?.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let response;
  try {
    response = await fetch(functionsUrl(name), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Không kết nối được máy chủ. Chạy npm run dev:functions rồi tải lại trang.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Không xử lý được yêu cầu.');
  return payload;
}

export function resolveClassCode(input) {
  return postGate('class-resolve', { input });
}

export function fetchClassRoster(classCode) {
  return postGate('class-roster', { classCode });
}

export function fetchPinGate({ classCode, studentId }) {
  return postGate('pin-gate', { classCode, studentId });
}

export function claimPin({ classCode, studentId, pin, confirmPin }) {
  return postGate('pin-claim', { classCode, studentId, pin, confirmPin });
}

export function verifyPin({ classCode, studentId, pin }) {
  return postGate('pin-verify', { classCode, studentId, pin });
}

export function requestPinReset({ classCode, studentId }) {
  return postGate('pin-reset-request', { classCode, studentId });
}

export function setResetPin({ classCode, studentId, pin, confirmPin }) {
  return postGate('pin-reset-set', { classCode, studentId, pin, confirmPin });
}

export function fetchPinStatus(studentId) {
  return postGate('pin-status', { studentId }, { admin: true });
}

export function countPendingPinResets() {
  return postGate('pin-status', { countPending: true }, { admin: true });
}

export function fetchPinBoard(classCode = '') {
  return postGate('pin-status', { listBoard: true, classCode }, { admin: true });
}

export function approvePinReset(requestId) {
  return postGate('pin-reset-approve', { requestId }, { admin: true });
}

export function lockStudentPin(studentId) {
  return postGate('pin-lock', { studentId }, { admin: true });
}

export function auditClassAccessCode({ classCode, studentAccessCode }) {
  return postGate('class-access-audit', { classCode, studentAccessCode }, { admin: true });
}

export function commitUpLevel(body) {
  return postGate('up-level', body, { admin: true });
}
