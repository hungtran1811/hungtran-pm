import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { MATERIAL_UPLOAD_SESSION_TTL_MS } from '../../src/config/lessonResourceConfig.js';
import { validateCreateLessonHtmlInput } from '../../src/lib/lessonHtmlDrive.js';
import { requireAdmin } from './_lib/adminAuth.js';
import { createResumableUpload, findOrCreateLessonHtmlFolder } from './_lib/driveFolders.js';
import { getAdminDb } from './_lib/firebaseAdmin.js';
import { clientIp, json, parseJsonBody, preflight, requestOrigin } from './_lib/http.js';
import { checkRateLimit, DRIVE_LIMITS } from './_lib/rateLimit.js';
import { functionErrorCode, logFunctionError } from './_lib/functionLog.js';

export async function handler(event) {
  const early = preflight(event);
  if (early) return early;

  if (!checkRateLimit(`lesson-html-create:ip:${clientIp(event)}`, { max: DRIVE_LIMITS.lessonHtml.ip })) {
    return json(429, { error: 'Bạn thao tác quá nhanh. Thử lại sau vài phút.' });
  }

  const admin = await requireAdmin(event);
  if (!admin.ok) return json(admin.status, { error: admin.error });
  if (!checkRateLimit(`lesson-html-create:admin:${admin.email}`, { max: DRIVE_LIMITS.lessonHtml.admin })) {
    return json(429, { error: 'Bạn thao tác quá nhanh. Thử lại sau vài phút.' });
  }

  let body;
  try {
    body = parseJsonBody(event);
  } catch {
    return json(400, { error: 'Dữ liệu gửi lên không hợp lệ.' });
  }

  const input = validateCreateLessonHtmlInput(body);
  if (!input.ok) return json(400, { error: input.error });

  try {
    const db = getAdminDb();
    const programSnap = await db.collection('curriculumPrograms').doc(input.programId).get();
    if (!programSnap.exists) {
      return json(404, { error: 'Không tìm thấy chương trình học.' });
    }

    const driveFolderId = await findOrCreateLessonHtmlFolder(input.programId);
    const uploadUrl = await createResumableUpload({
      storedFileName: input.storedFileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      folderId: driveFolderId,
      origin: requestOrigin(event),
    });

    const uploadToken = randomUUID();
    await db.collection('materialUploadSessions').doc(uploadToken).set({
      kind: 'lessonHtml',
      programId: input.programId,
      lessonId: input.lessonId,
      sessionNumber: input.sessionNumber,
      part: input.part,
      storedFileName: input.storedFileName,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      driveFolderId,
      adminEmail: admin.email,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + MATERIAL_UPLOAD_SESSION_TTL_MS),
    });

    return json(200, { uploadUrl, storedFileName: input.storedFileName, uploadToken });
  } catch (error) {
    const code = functionErrorCode(error);
    logFunctionError('drive-create-lesson-html-session', code, error);
    if (code === 'CONFIG_MISSING') {
      return json(503, { error: 'Chưa cấu hình thư mục tài nguyên Drive.' });
    }
    return json(502, { error: 'Không tạo được phiên lưu HTML. Thử lại sau.' });
  }
}
