import { requireAdmin } from './_lib/adminAuth.js';
import { deleteDriveFile, getDriveFile } from './_lib/driveFolders.js';
import { getAdminDb } from './_lib/firebaseAdmin.js';
import { clientIp, json, parseJsonBody, preflight } from './_lib/http.js';
import { checkRateLimit, DRIVE_LIMITS } from './_lib/rateLimit.js';
import { functionErrorCode, logFunctionError } from './_lib/functionLog.js';

function sameSize(left, right) {
  return Number(left) === Number(right);
}

export async function handler(event) {
  const early = preflight(event);
  if (early) return early;

  if (!checkRateLimit(`lesson-html-complete:ip:${clientIp(event)}`, { max: DRIVE_LIMITS.lessonHtml.ip })) {
    return json(429, { error: 'Bạn thao tác quá nhanh. Thử lại sau vài phút.' });
  }

  const admin = await requireAdmin(event);
  if (!admin.ok) return json(admin.status, { error: admin.error });
  if (!checkRateLimit(`lesson-html-complete:admin:${admin.email}`, { max: DRIVE_LIMITS.lessonHtml.admin })) {
    return json(429, { error: 'Bạn thao tác quá nhanh. Thử lại sau vài phút.' });
  }

  let body;
  try {
    body = parseJsonBody(event);
  } catch {
    return json(400, { error: 'Dữ liệu gửi lên không hợp lệ.' });
  }

  const uploadToken = String(body.uploadToken || '').trim();
  const driveFileId = String(body.driveFileId || '').trim();
  const previousFileId = String(body.previousFileId || '').trim();
  if (!uploadToken || !driveFileId) {
    return json(400, { error: 'Thiếu thông tin hoàn tất HTML bài giảng.' });
  }

  try {
    const db = getAdminDb();
    const sessionRef = db.collection('materialUploadSessions').doc(uploadToken);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      return json(404, { error: 'Phiên lưu HTML đã hết hạn hoặc không tồn tại.' });
    }

    const session = sessionSnap.data() || {};
    if (session.kind !== 'lessonHtml') {
      return json(400, { error: 'Phiên tải không phải HTML bài giảng.' });
    }
    const expiresAt = session.expiresAt?.toMillis?.() || 0;
    if (expiresAt && expiresAt < Date.now()) {
      await sessionRef.delete().catch(() => {});
      return json(410, { error: 'Phiên lưu HTML đã hết hạn. Thử lại từ đầu.' });
    }

    const file = await getDriveFile(driveFileId);
    if (!file?.id || file.trashed) {
      return json(400, { error: 'Không tìm thấy file HTML vừa tải lên.' });
    }
    if (file.name !== session.storedFileName) {
      return json(400, { error: 'Tên file trên Drive không khớp phiên tải.' });
    }
    if (!sameSize(file.size, session.fileSize)) {
      return json(400, { error: 'Dung lượng file trên Drive không khớp.' });
    }
    if (!Array.isArray(file.parents) || !file.parents.includes(session.driveFolderId)) {
      return json(400, { error: 'File không nằm trong thư mục HTML bài giảng.' });
    }

    if (previousFileId && previousFileId !== file.id) {
      await deleteDriveFile(previousFileId).catch(() => {});
    }
    await sessionRef.delete().catch(() => {});

    return json(200, {
      ok: true,
      pointer: {
        driveFileId: file.id,
        fileName: session.storedFileName,
        byteSize: Number(session.fileSize) || Number(file.size) || 0,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const code = functionErrorCode(error);
    logFunctionError('drive-complete-lesson-html', code, error);
    if (code === 'CONFIG_MISSING') {
      return json(503, { error: 'Chưa cấu hình thư mục tài nguyên Drive.' });
    }
    return json(502, { error: 'Không hoàn tất được HTML bài giảng. Thử lại sau.' });
  }
}
