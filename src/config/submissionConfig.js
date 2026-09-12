/** Giới hạn và allowlist nộp file Drive — giữ đồng bộ với Netlify Functions. */

/** Trần form: đủ cho zip/project nặng (~100MB). File lớn hơn → nén hoặc nhận ngoài form. */
export const MAX_UPLOAD_SIZE_MB = 150;
export const MAX_UPLOAD_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export const ALLOWED_EXTENSIONS = ['.zip', '.py', '.html', '.css', '.js', '.pdf', '.txt'];

export const BLOCKED_EXTENSIONS = [
  '.exe',
  '.msi',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.ps1',
  '.dll',
  '.vbs',
  '.jsb',
  '.vbe',
  '.wsf',
  '.wsh',
];

export const BLOCKED_MIME_TYPES = [
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-ms-installer',
  'application/x-bat',
  'application/vnd.microsoft.portable-executable',
];

export const UPLOAD_SESSION_TTL_MS = 60 * 60 * 1000;

export const FUNCTIONS_BASE = '/.netlify/functions';
