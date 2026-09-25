import {
  LESSON_RESOURCE_BLOCKED_EXTENSIONS,
  LESSON_RESOURCE_BLOCKED_MIME_TYPES,
  LESSON_RESOURCE_EXTENSIONS,
  MAX_LESSON_RESOURCE_SIZE,
  MAX_LESSON_RESOURCE_SIZE_MB,
  MAX_LESSON_RESOURCES,
} from '../config/lessonResourceConfig.js';
import { getFileExtension, isValidLessonKey, normalizeLessonKey } from './submissionFileName.js';
import { formatUploadSize } from './submissionValidate.js';

export { formatUploadSize };

const PROGRAM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

export function isValidProgramId(programId) {
  return PROGRAM_ID_PATTERN.test(String(programId || '').trim());
}

export function validateLessonResourceFile({ fileName, fileSize, mimeType } = {}) {
  const name = String(fileName || '').trim();
  if (!name) return { ok: false, error: 'Chưa chọn file.' };

  const extension = getFileExtension(name);
  if (!extension) {
    return { ok: false, error: 'File phải có phần mở rộng (ví dụ .zip, .py).' };
  }
  if (LESSON_RESOURCE_BLOCKED_EXTENSIONS.includes(extension)) {
    return { ok: false, error: 'Loại file này không được phép làm tài nguyên bài giảng.' };
  }
  if (!LESSON_RESOURCE_EXTENSIONS.includes(extension)) {
    return {
      ok: false,
      error: `Chỉ nhận ${LESSON_RESOURCE_EXTENSIONS.join(', ')}.`,
    };
  }

  const size = Number(fileSize);
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: 'File rỗng hoặc không đọc được dung lượng.' };
  }
  if (size > MAX_LESSON_RESOURCE_SIZE) {
    return {
      ok: false,
      error: `File vượt quá ${MAX_LESSON_RESOURCE_SIZE_MB}MB. Nén .zip hoặc tách file nhỏ hơn.`,
    };
  }

  const mime = String(mimeType || '').trim().toLowerCase();
  if (mime && LESSON_RESOURCE_BLOCKED_MIME_TYPES.includes(mime)) {
    return { ok: false, error: 'Loại file này không được phép làm tài nguyên bài giảng.' };
  }

  return { ok: true, extension };
}

export function canAddLessonResource(resources = []) {
  return normalizeLessonResources(resources).length < MAX_LESSON_RESOURCES;
}

export function findExistingLessonResource(resources, fileName) {
  const name = String(fileName || '').trim().toLowerCase();
  if (!name) return null;
  return (
    normalizeLessonResources(resources).find((row) => row.fileName.toLowerCase() === name) || null
  );
}

export function sanitizeMaterialFileName(fileName) {
  const ext = getFileExtension(fileName);
  const base = String(fileName || '').replace(/\\/g, '/').split('/').pop() || 'file';
  const withoutExt = ext ? base.slice(0, -ext.length) : base;
  const cleaned = withoutExt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${cleaned || 'file'}${ext}`;
}

export function materialDownloadUrl(fileId) {
  const id = String(fileId || '').trim();
  if (!id) return '';
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
}

export function normalizeLessonResource(item) {
  if (!item || typeof item !== 'object') return null;
  const fileName = String(item.fileName || '').trim();
  const downloadUrl = String(item.downloadUrl || '').trim();
  const id = String(item.id || item.driveFileId || '').trim();
  if (!fileName || !downloadUrl || !id) return null;
  if (!/^https:\/\//i.test(downloadUrl)) return null;

  const size = Number(item.size);
  return {
    id,
    title: String(item.title || fileName).trim() || fileName,
    fileName,
    size: Number.isFinite(size) && size > 0 ? size : 0,
    mimeType: String(item.mimeType || '').trim(),
    driveFileId: String(item.driveFileId || '').trim(),
    downloadUrl,
    addedAt: item.addedAt || '',
  };
}

export function normalizeLessonResources(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const rows = [];
  input.forEach((item) => {
    const row = normalizeLessonResource(item);
    if (!row || seen.has(row.id)) return;
    seen.add(row.id);
    rows.push(row);
  });
  return rows.slice(0, MAX_LESSON_RESOURCES);
}

export function validateCreateMaterialInput(body = {}) {
  const programId = String(body.programId || '').trim();
  const sessionNumber = Number(body.sessionNumber);
  const fileName = String(body.fileName || '').trim();
  const fileSize = Number(body.fileSize);
  const mimeType = String(body.mimeType || '').trim();

  if (!isValidProgramId(programId)) return { ok: false, error: 'Mã chương trình không hợp lệ.' };
  if (!Number.isInteger(sessionNumber) || sessionNumber < 1 || sessionNumber > 50) {
    return { ok: false, error: 'Buổi học không hợp lệ.' };
  }

  const lessonKey = normalizeLessonKey(sessionNumber);
  if (!isValidLessonKey(lessonKey)) return { ok: false, error: 'Buổi học không hợp lệ.' };

  const file = validateLessonResourceFile({ fileName, fileSize, mimeType });
  if (!file.ok) return file;

  return {
    ok: true,
    programId,
    sessionNumber,
    lessonKey,
    fileName,
    storedFileName: sanitizeMaterialFileName(fileName),
    fileSize,
    mimeType,
  };
}
