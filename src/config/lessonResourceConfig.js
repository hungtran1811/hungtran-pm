/** Trần và allowlist tài nguyên bài giảng — đồng bộ với Netlify Functions. */

export const MAX_LESSON_RESOURCE_SIZE_MB = 100;
export const MAX_LESSON_RESOURCE_SIZE = MAX_LESSON_RESOURCE_SIZE_MB * 1024 * 1024;
export const MAX_LESSON_RESOURCES = 5;
export const MATERIAL_UPLOAD_SESSION_TTL_MS = 30 * 60 * 1000;

export const LESSON_RESOURCE_EXTENSIONS = ['.zip', '.py', '.html', '.pdf', '.txt'];

export const LESSON_RESOURCE_BLOCKED_EXTENSIONS = [
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

export const LESSON_RESOURCE_BLOCKED_MIME_TYPES = [
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-ms-installer',
  'application/x-bat',
  'application/vnd.microsoft.portable-executable',
];
