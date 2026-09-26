import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./adminAuth.js', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('./firebaseAdmin.js', () => ({
  getAdminDb: vi.fn(),
}));

vi.mock('./driveFolders.js', () => ({
  findOrCreateLessonHtmlFolder: vi.fn(),
  createResumableUpload: vi.fn(),
  getDriveFileMedia: vi.fn(),
  getDriveFile: vi.fn(),
  deleteDriveFile: vi.fn(),
}));

vi.mock('./rateLimit.js', () => ({
  checkRateLimit: () => true,
  DRIVE_LIMITS: { lessonHtml: { ip: 80, student: 40, admin: 20 } },
}));

vi.mock('./functionLog.js', () => ({
  functionErrorCode: (error) => {
    const message = String(error?.message || '');
    return message.includes('Missing') ? 'CONFIG_MISSING' : 'UPSTREAM_FAILED';
  },
  logFunctionError: vi.fn(),
}));

import { requireAdmin } from './adminAuth.js';
import { findOrCreateLessonHtmlFolder, getDriveFileMedia } from './driveFolders.js';
import { getAdminDb } from './firebaseAdmin.js';
import { handler as createLessonHtmlSession } from '../drive-create-lesson-html-session.js';
import { handler as getLessonHtml } from '../drive-get-lesson-html.js';

function postEvent(body, headers = {}) {
  return {
    httpMethod: 'POST',
    headers,
    body: JSON.stringify(body),
  };
}

function parse(result) {
  return { status: result.statusCode, body: JSON.parse(result.body || '{}') };
}

function mockDb({ program, lesson } = {}) {
  return {
    collection(name) {
      if (name === 'materialUploadSessions') {
        return { doc: () => ({ set: vi.fn(async () => {}) }) };
      }
      return {
        doc() {
          return {
            async get() {
              return {
                exists: Boolean(program),
                data: () => program,
                ref: {
                  collection() {
                    return {
                      doc() {
                        return {
                          async get() {
                            return {
                              exists: Boolean(lesson),
                              data: () => lesson || {},
                            };
                          },
                        };
                      },
                    };
                  },
                },
              };
            },
          };
        },
      };
    },
  };
}

describe('drive lesson HTML functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ ok: true, email: 'gv@example.com' });
  });

  it('rejects an upload larger than 2 MiB', async () => {
    const result = parse(
      await createLessonHtmlSession(
        postEvent({
          programId: 'web-basic',
          lessonId: 'lesson-1',
          sessionNumber: 1,
          part: 'lecture',
          fileSize: 2 * 1024 * 1024 + 20,
        }),
      ),
    );
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/2 MiB/);
    expect(findOrCreateLessonHtmlFolder).not.toHaveBeenCalled();
  });

  it('returns 503 when Drive materials env is missing', async () => {
    getAdminDb.mockReturnValue(mockDb({ program: { active: true } }));
    findOrCreateLessonHtmlFolder.mockRejectedValue(
      new Error('Missing GOOGLE_DRIVE_MATERIALS_ROOT_FOLDER_ID'),
    );

    const result = parse(
      await createLessonHtmlSession(
        postEvent({
          programId: 'web-basic',
          lessonId: 'lesson-1',
          sessionNumber: 1,
          part: 'lecture',
          fileSize: 1200,
        }),
      ),
    );
    expect(result.status).toBe(503);
    expect(result.body.error).toMatch(/cấu hình/);
  });

  it('hides inactive programs from public get', async () => {
    requireAdmin.mockResolvedValue({ ok: false, status: 401, error: 'Cần đăng nhập quản trị.' });
    getAdminDb.mockReturnValue(
      mockDb({
        program: { active: false },
        lesson: { lectureHtmlDrive: { driveFileId: 'file-1' } },
      }),
    );

    const result = parse(
      await getLessonHtml(
        postEvent({
          programId: 'web-basic',
          lessonId: 'lesson-1',
          part: 'lecture',
        }),
      ),
    );
    expect(result.status).toBe(404);
    expect(getDriveFileMedia).not.toHaveBeenCalled();
  });

  it('returns 503 when get cannot read Drive because env is missing', async () => {
    requireAdmin.mockResolvedValue({ ok: false, status: 401, error: 'Cần đăng nhập quản trị.' });
    getAdminDb.mockReturnValue(
      mockDb({
        program: { active: true },
        lesson: {
          lectureHtmlDrive: {
            driveFileId: 'file-1',
            fileName: 'L01-lecture.html',
            byteSize: 100,
          },
        },
      }),
    );
    getDriveFileMedia.mockRejectedValue(new Error('Missing Google OAuth env'));

    const result = parse(
      await getLessonHtml(
        postEvent({
          programId: 'web-basic',
          lessonId: 'lesson-1',
          part: 'lecture',
        }),
      ),
    );
    expect(result.status).toBe(503);
    expect(result.body).not.toHaveProperty('driveFileId');
  });
});
