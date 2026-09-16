import { FUNCTIONS_BASE } from '../config/submissionConfig.js';
import { validateCreateSessionInput } from '../lib/submissionValidate.js';

function functionsUrl(name) {
  const base = (import.meta.env.VITE_NETLIFY_FUNCTIONS_BASE || FUNCTIONS_BASE).replace(/\/$/, '');
  return `${base}/${name}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 429 || status === 502 || status === 503;
}

async function postJson(name, body, { retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response;
    try {
      response = await fetch(functionsUrl(name), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error(
        'Không kết nối được máy chủ nộp bài. Chạy npm run dev:functions rồi tải lại trang.',
      );
    }

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (response.ok) return payload;

    lastError = new Error(
      payload.error ||
        (response.status >= 500
          ? 'Máy chủ nộp bài đang lỗi. Nếu đang test local, chạy npm run dev:functions rồi thử lại.'
          : `Không xử lý được yêu cầu (${response.status}).`),
    );
    const localDown =
      typeof payload.error === 'string' && payload.error.includes('dev:functions');
    if (localDown || !isRetryableStatus(response.status) || attempt === retries) throw lastError;
    await sleep(400 * 2 ** attempt + Math.random() * 250);
  }
  throw lastError;
}

function putFileWithProgress(uploadUrl, file, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.responseType = 'json';

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress?.(percent, event.loaded, event.total);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = xhr.response && typeof xhr.response === 'object' ? xhr.response : {};
        if (!data.id) {
          reject(new Error('Drive không trả về mã file.'));
          return;
        }
        onProgress?.(100, file.size, file.size);
        resolve(data.id);
        return;
      }
      reject(new Error('Tải file lên Drive thất bại. Thử lại.'));
    };

    xhr.onerror = () => reject(new Error('Mất kết nối khi tải file lên Drive.'));
    xhr.onabort = () => reject(new DOMException('Đã hủy tải file.', 'AbortError'));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.send(file);
  });
}

export async function submitDriveFile({
  classCode,
  studentId,
  studentName,
  lessonKey,
  file,
  onStatus,
  onProgress,
  signal,
} = {}) {
  const input = validateCreateSessionInput({
    classCode,
    studentId,
    studentName,
    lessonKey,
    fileName: file?.name,
    fileSize: file?.size,
    mimeType: file?.type,
  });
  if (!input.ok) throw new Error(input.error);

  onStatus?.('creating_session');
  const session = await postJson('drive-create-upload-session', {
    classCode: input.classCode,
    studentId: input.studentId,
    studentName: input.studentName,
    lessonKey: input.lessonKey,
    fileName: input.fileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
  });

  if (!session.uploadUrl || !session.uploadToken) {
    throw new Error('Không tạo được phiên tải lên.');
  }

  onStatus?.('uploading');
  const driveFileId = await putFileWithProgress(session.uploadUrl, file, { onProgress, signal });

  onStatus?.('saving');
  const completed = await postJson('drive-complete-submission', {
    uploadToken: session.uploadToken,
    driveFileId,
  });
  invalidateMyDriveSubmissions(input.classCode, input.studentId);

  return {
    storedFileName: completed.storedFileName || session.storedFileName,
    originalFileName: completed.originalFileName || input.fileName,
    submittedAt: completed.submittedAt || new Date().toISOString(),
    submissionId: completed.submissionId || '',
    attempt: completed.attempt || 1,
  };
}

const listCache = new Map();
const LIST_TTL_MS = 15_000;
const LIST_FAIL_TTL_MS = 8_000;

function listCacheKey(classCode, studentId) {
  return `${classCode}:${studentId}`;
}

export function invalidateMyDriveSubmissions(classCode, studentId) {
  listCache.delete(listCacheKey(classCode, studentId));
}

export async function listMyDriveSubmissions({ classCode, studentId, studentName } = {}) {
  const key = listCacheKey(classCode, studentId);
  const hit = listCache.get(key);
  if (hit?.rows && Date.now() - hit.at < LIST_TTL_MS) return hit.rows;
  if (hit?.error && Date.now() - hit.at < LIST_FAIL_TTL_MS) throw hit.error;
  if (hit?.inflight) return hit.inflight;

  const inflight = postJson(
    'drive-list-my-submissions',
    {
      classCode,
      studentId,
      studentName,
    },
    { retries: 0 },
  )
    .then((payload) => {
      const rows = Array.isArray(payload.submissions) ? payload.submissions : [];
      listCache.set(key, { rows, at: Date.now() });
      return rows;
    })
    .catch((error) => {
      listCache.set(key, { error, at: Date.now() });
      throw error;
    });

  listCache.set(key, { inflight });
  return inflight;
}
