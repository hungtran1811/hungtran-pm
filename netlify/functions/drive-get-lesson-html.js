import { LESSON_HTML_DRIVE_MAX_BYTES } from '../../src/config/lessonHtmlDrive.js';
import { isLessonHtmlDrivePart, normalizeLessonHtmlDrivePointer } from '../../src/lib/lessonHtmlDrive.js';
import { requireAdmin } from './_lib/adminAuth.js';
import { getDriveFileMedia } from './_lib/driveFolders.js';
import { getAdminDb } from './_lib/firebaseAdmin.js';
import { clientIp, json, parseJsonBody, preflight } from './_lib/http.js';
import { checkRateLimit, DRIVE_LIMITS } from './_lib/rateLimit.js';
import { functionErrorCode, logFunctionError } from './_lib/functionLog.js';

export async function handler(event) {
  const early = preflight(event);
  if (early) return early;

  if (!checkRateLimit(`lesson-html-get:ip:${clientIp(event)}`, { max: DRIVE_LIMITS.lessonHtml.ip })) {
    return json(429, { error: 'Bạn thao tác quá nhanh. Thử lại sau vài phút.' });
  }

  let body;
  try {
    body = parseJsonBody(event);
  } catch {
    return json(400, { error: 'Dữ liệu gửi lên không hợp lệ.' });
  }

  const programId = String(body.programId || '').trim();
  const lessonId = String(body.lessonId || '').trim();
  const part = String(body.part || '').trim();
  if (!programId || !lessonId || !isLessonHtmlDrivePart(part)) {
    return json(400, { error: 'Thiếu chương trình, bài giảng hoặc phần HTML.' });
  }

  const admin = await requireAdmin(event);
  const isAdmin = admin.ok;

  try {
    const db = getAdminDb();
    const programSnap = await db.collection('curriculumPrograms').doc(programId).get();
    if (!programSnap.exists) {
      return json(404, { error: 'Không tìm thấy bài giảng.' });
    }
    if (!isAdmin && programSnap.data()?.active !== true) {
      return json(404, { error: 'Không tìm thấy bài giảng.' });
    }

    const lessonSnap = await programSnap.ref.collection('lessons').doc(lessonId).get();
    if (!lessonSnap.exists) {
      return json(404, { error: 'Không tìm thấy bài giảng.' });
    }

    const lesson = lessonSnap.data() || {};
    const pointer = normalizeLessonHtmlDrivePointer(
      part === 'exercise' ? lesson.exerciseHtmlDrive : lesson.lectureHtmlDrive,
    );
    if (!pointer) {
      return json(404, { error: 'Bài này không lưu HTML trên Drive.' });
    }

    const html = await getDriveFileMedia(pointer.driveFileId);
    if (htmlUtf8TooLarge(html)) {
      return json(413, { error: 'HTML trên Drive vượt giới hạn hiển thị.' });
    }
    return json(200, { html: String(html || '') });
  } catch (error) {
    const code = functionErrorCode(error);
    logFunctionError('drive-get-lesson-html', code, error);
    if (code === 'CONFIG_MISSING') {
      return json(503, { error: 'Chưa cấu hình thư mục tài nguyên Drive.' });
    }
    return json(502, { error: 'Không tải được bài giảng. Thử lại.' });
  }
}

function htmlUtf8TooLarge(html) {
  return new TextEncoder().encode(String(html || '')).byteLength > LESSON_HTML_DRIVE_MAX_BYTES;
}
