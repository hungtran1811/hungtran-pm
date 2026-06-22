export const CODE_SUBMISSION_MAX_FILE_BYTES = 512 * 1024;
export const CODE_SUBMISSION_MAX_FILES_PER_SESSION = 10;
/** Số ngày giữ file code sau khi lớp hoàn thành / lưu trữ. */
export const CODE_SUBMISSION_RETENTION_DAYS = 30;

export const CODE_SUBMISSION_EXTENSIONS = ['.py', '.html', '.css', '.js', '.ui'];

const EXT_SET = new Set(CODE_SUBMISSION_EXTENSIONS);

export function codeSubmissionDocId(classCode, studentId, sessionNumber) {
  return `${classCode}__${studentId}__${sessionNumber}`;
}

export function getCodeFileExtension(name = '') {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return '';
  return lower.slice(dot);
}

export function validateCodeSubmissionFile(file) {
  if (!file) return { error: 'Không có file.' };
  if (file.size > CODE_SUBMISSION_MAX_FILE_BYTES) {
    return { error: `File tối đa ${Math.round(CODE_SUBMISSION_MAX_FILE_BYTES / 1024)} KB.` };
  }
  const ext = getCodeFileExtension(file.name);
  if (!EXT_SET.has(ext)) {
    return { error: `Chỉ chấp nhận: ${CODE_SUBMISSION_EXTENSIONS.join(', ')}` };
  }
  return { ext };
}

export function sanitizeCodeFileName(name = '') {
  return name.replace(/[^\w.\-()+\u00C0-\u1EF9 ]+/g, '_').slice(0, 120);
}
