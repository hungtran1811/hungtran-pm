import {
  ALLOWED_EXTENSIONS,
  BLOCKED_EXTENSIONS,
  BLOCKED_MIME_TYPES,
  MAX_FILES_PER_SUBMIT,
  MAX_UPLOAD_SIZE,
  MAX_UPLOAD_SIZE_MB,
} from '../config/submissionConfig.js';
import { getFileExtension, isValidLessonKey, normalizeLessonKey } from './submissionFileName.js';

export function formatUploadSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateSubmissionFile({ fileName, fileSize, mimeType } = {}) {
  const name = String(fileName || '').trim();
  if (!name) {
    return { ok: false, error: 'Chưa chọn file.' };
  }

  const extension = getFileExtension(name);
  if (!extension) {
    return { ok: false, error: 'File phải có phần mở rộng (ví dụ .zip, .py).' };
  }
  if (BLOCKED_EXTENSIONS.includes(extension)) {
    return { ok: false, error: 'Loại file này không được phép nộp.' };
  }
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      ok: false,
      error: `Chỉ nhận ${ALLOWED_EXTENSIONS.join(', ')}.`,
    };
  }

  const size = Number(fileSize);
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: 'File rỗng hoặc không đọc được dung lượng.' };
  }
  if (size > MAX_UPLOAD_SIZE) {
    return {
      ok: false,
      error: `File vượt quá ${MAX_UPLOAD_SIZE_MB}MB. Nén .zip, xóa thư mục không cần (ví dụ node_modules), hoặc nhờ giáo viên nhận ngoài form.`,
    };
  }

  const mime = String(mimeType || '').trim().toLowerCase();
  if (mime && BLOCKED_MIME_TYPES.includes(mime)) {
    return { ok: false, error: 'Loại file này không được phép nộp.' };
  }

  return { ok: true, extension };
}

function fileDisplayName(file = {}) {
  return String(file.name || file.fileName || '').trim();
}

export function validateSubmissionFiles(files = []) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (!list.length) {
    return { ok: false, error: 'Chưa chọn file.' };
  }
  if (list.length > MAX_FILES_PER_SUBMIT) {
    return { ok: false, error: `Mỗi lần nộp tối đa ${MAX_FILES_PER_SUBMIT} file.` };
  }

  const names = new Set();
  const validated = [];
  for (const file of list) {
    const fileName = fileDisplayName(file);
    const check = validateSubmissionFile({
      fileName,
      fileSize: file.size ?? file.fileSize,
      mimeType: file.type ?? file.mimeType,
    });
    if (!check.ok) return check;
    const key = fileName.toLowerCase();
    if (names.has(key)) {
      return { ok: false, error: 'Không nộp hai file trùng tên.' };
    }
    names.add(key);
    validated.push({ fileName, extension: check.extension });
  }

  return { ok: true, files: validated };
}

export function normalizeCompleteSubmissionItems(body = {}, maxFiles = MAX_FILES_PER_SUBMIT) {
  const raw = Array.isArray(body.items)
    ? body.items
    : body.uploadToken || body.driveFileId
      ? [{ uploadToken: body.uploadToken, driveFileId: body.driveFileId }]
      : [];

  const items = [];
  const tokens = new Set();
  const driveIds = new Set();
  for (const row of raw) {
    const uploadToken = String(row?.uploadToken || '').trim();
    const driveFileId = String(row?.driveFileId || '').trim();
    if (!uploadToken || !driveFileId) {
      return { ok: false, error: 'Thiếu thông tin hoàn tất nộp bài.' };
    }
    if (tokens.has(uploadToken) || driveIds.has(driveFileId)) {
      return { ok: false, error: 'Danh sách file nộp bị trùng.' };
    }
    tokens.add(uploadToken);
    driveIds.add(driveFileId);
    items.push({ uploadToken, driveFileId });
  }

  if (!items.length) {
    return { ok: false, error: 'Thiếu thông tin hoàn tất nộp bài.' };
  }
  if (items.length > maxFiles) {
    return { ok: false, error: `Mỗi lần nộp tối đa ${maxFiles} file.` };
  }
  return { ok: true, items };
}

export function validateStudentIdentityInput(body = {}) {
  const classCode = String(body.classCode || '').trim();
  const studentId = String(body.studentId || '').trim();
  const studentName = String(body.studentName || '').trim();
  if (!classCode) return { ok: false, error: 'Thiếu mã lớp.' };
  if (!studentId) return { ok: false, error: 'Thiếu học sinh.' };
  if (!studentName) return { ok: false, error: 'Thiếu tên học sinh.' };
  return { ok: true, classCode, studentId, studentName };
}

export function validateCreateSessionInput(body = {}) {
  const identity = validateStudentIdentityInput(body);
  if (!identity.ok) return identity;
  const { classCode, studentId, studentName } = identity;
  const lessonKey = normalizeLessonKey(body.lessonKey || body.lesson);
  const fileName = String(body.fileName || '').trim();
  const fileSize = Number(body.fileSize);
  const mimeType = String(body.mimeType || '').trim();

  if (!isValidLessonKey(lessonKey)) return { ok: false, error: 'Buổi học không hợp lệ.' };

  const file = validateSubmissionFile({ fileName, fileSize, mimeType });
  if (!file.ok) return file;

  return {
    ok: true,
    classCode,
    studentId,
    studentName,
    lessonKey,
    fileName,
    fileSize,
    mimeType,
  };
}
