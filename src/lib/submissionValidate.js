import {
  ALLOWED_EXTENSIONS,
  BLOCKED_EXTENSIONS,
  BLOCKED_MIME_TYPES,
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
