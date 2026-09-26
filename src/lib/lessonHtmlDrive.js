import { LESSON_HTML_DRIVE_MAX_BYTES, LESSON_HTML_DRIVE_PARTS } from '../config/lessonHtmlDrive.js';
import { LESSON_DOCUMENT_MAX_BYTES, lessonDocumentSizeBytes } from './curriculumSize.js';
import { isValidProgramId } from './lessonResources.js';
import { normalizeLessonKey } from './submissionFileName.js';

export function htmlUtf8Size(value) {
  return new TextEncoder().encode(String(value || '')).byteLength;
}

export function normalizeLessonHtmlDrivePointer(value) {
  if (!value || typeof value !== 'object') return null;
  const driveFileId = String(value.driveFileId || '').trim();
  if (!driveFileId) return null;
  return {
    driveFileId,
    fileName: String(value.fileName || '').trim(),
    byteSize: Number(value.byteSize) || 0,
    updatedAt: String(value.updatedAt || '').trim(),
  };
}

export function isLessonHtmlDrivePart(part) {
  return LESSON_HTML_DRIVE_PARTS.includes(String(part || ''));
}

export function lessonHtmlDriveFileName(sessionNumber, part) {
  return `${normalizeLessonKey(sessionNumber) || 'L00'}-${part}.html`;
}

export function validateCreateLessonHtmlInput(body = {}) {
  const programId = String(body.programId || '').trim();
  const lessonId = String(body.lessonId || '').trim();
  const part = String(body.part || '').trim();
  const sessionNumber = Number(body.sessionNumber) || 0;
  const fileSize = Number(body.fileSize);
  if (!isValidProgramId(programId)) {
    return { ok: false, error: 'Mã chương trình không hợp lệ.' };
  }
  if (!lessonId) return { ok: false, error: 'Thiếu mã bài giảng.' };
  if (!isLessonHtmlDrivePart(part)) return { ok: false, error: 'Phần HTML không hợp lệ.' };
  if (sessionNumber <= 0) return { ok: false, error: 'Buổi học không hợp lệ.' };
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return { ok: false, error: 'File rỗng hoặc không đọc được dung lượng.' };
  }
  if (fileSize > LESSON_HTML_DRIVE_MAX_BYTES) {
    return { ok: false, error: 'Nội dung HTML vượt 2 MiB. Hãy rút gọn hoặc bỏ ảnh nhúng base64.' };
  }
  return {
    ok: true,
    programId,
    lessonId,
    part,
    sessionNumber,
    fileSize,
    storedFileName: lessonHtmlDriveFileName(sessionNumber, part),
    mimeType: 'text/html',
  };
}

export function formatLessonHtmlDriveBadge(pointer) {
  const normalized = normalizeLessonHtmlDrivePointer(pointer);
  if (!normalized) return '';
  const kb = Math.max(1, Math.round(normalized.byteSize / 1024));
  if (kb >= 1024) {
    return `Lưu trên Drive · ${(kb / 1024).toFixed(1)} MiB`;
  }
  return `Lưu trên Drive · ${kb} KiB`;
}

export function planLessonHtmlOverflow(document, { maxBytes = LESSON_DOCUMENT_MAX_BYTES } = {}) {
  const lectureHtml = String(document?.lectureHtml || '');
  const exerciseHtml = String(document?.exerciseHtml || '');
  const lectureBytes = htmlUtf8Size(lectureHtml);
  const exerciseBytes = htmlUtf8Size(exerciseHtml);

  if (lectureBytes > LESSON_HTML_DRIVE_MAX_BYTES) {
    return { ok: false, error: 'Nội dung bài giảng vượt 2 MiB. Hãy rút gọn HTML hoặc bỏ ảnh nhúng base64.' };
  }
  if (exerciseBytes > LESSON_HTML_DRIVE_MAX_BYTES) {
    return { ok: false, error: 'Nội dung bài tập vượt 2 MiB. Hãy rút gọn HTML hoặc bỏ ảnh nhúng base64.' };
  }

  const fullSize = lessonDocumentSizeBytes(document);
  if (fullSize <= maxBytes) {
    return { ok: true, overflowLecture: false, overflowExercise: false };
  }

  const strip = (stripLecture, stripExercise) => {
    const next = { ...document };
    if (stripLecture) next.lectureHtml = '';
    if (stripExercise) next.exerciseHtml = '';
    return lessonDocumentSizeBytes(next) <= maxBytes;
  };

  const lectureFirst = lectureBytes >= exerciseBytes;
  if (lectureFirst && lectureBytes > 0 && strip(true, false)) {
    return { ok: true, overflowLecture: true, overflowExercise: false };
  }
  if (!lectureFirst && exerciseBytes > 0 && strip(false, true)) {
    return { ok: true, overflowLecture: false, overflowExercise: true };
  }
  if (strip(true, true)) {
    return { ok: true, overflowLecture: lectureBytes > 0, overflowExercise: exerciseBytes > 0 };
  }

  return {
    ok: false,
    overflowLecture: true,
    overflowExercise: true,
    error: 'Bài giảng vẫn vượt 750 KiB sau khi tách HTML. Hãy bớt metadata hoặc tài nguyên đính kèm.',
  };
}
