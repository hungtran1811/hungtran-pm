import { randomUUID } from 'node:crypto';
import { materialDownloadUrl } from '../../src/lib/lessonResources.js';
import { requireAdmin } from './_lib/adminAuth.js';
import { getDriveFile, shareFileAnyoneWithLink } from './_lib/driveFolders.js';
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

  if (!checkRateLimit(`material-complete:ip:${clientIp(event)}`, { max: DRIVE_LIMITS.material.ip })) {
    return json(429, { error: 'Bạn thao tác quá nhanh. Thử lại sau vài phút.' });
  }

  const admin = await requireAdmin(event);
  if (!admin.ok) return json(admin.status, { error: admin.error });
  if (!checkRateLimit(`material-complete:admin:${admin.email}`, { max: DRIVE_LIMITS.material.admin })) {
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
  if (!uploadToken || !driveFileId) {
    return json(400, { error: 'Thiếu thông tin hoàn tất tải tài nguyên.' });
  }

  try {
    const db = getAdminDb();
    const sessionRef = db.collection('materialUploadSessions').doc(uploadToken);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      return json(404, { error: 'Phiên tải tài nguyên đã hết hạn hoặc không tồn tại.' });
    }

    const session = sessionSnap.data() || {};
    const expiresAt = session.expiresAt?.toMillis?.() || 0;
    if (expiresAt && expiresAt < Date.now()) {
      await sessionRef.delete().catch(() => {});
      return json(410, { error: 'Phiên tải tài nguyên đã hết hạn. Thử lại từ đầu.' });
    }

    const file = await getDriveFile(driveFileId);
    if (!file?.id || file.trashed) {
      return json(400, { error: 'Không tìm thấy file vừa tải lên.' });
    }
    if (file.name !== session.storedFileName) {
      return json(400, { error: 'Tên file trên Drive không khớp phiên tải.' });
    }
    if (!sameSize(file.size, session.fileSize)) {
      return json(400, { error: 'Dung lượng file trên Drive không khớp.' });
    }
    if (!Array.isArray(file.parents) || !file.parents.includes(session.driveFolderId)) {
      return json(400, { error: 'File không nằm trong thư mục tài nguyên buổi học.' });
    }

    await shareFileAnyoneWithLink(file.id);
    await sessionRef.delete().catch(() => {});

    const fileName = session.originalFileName || session.storedFileName;
    return json(200, {
      ok: true,
      resource: {
        id: randomUUID(),
        title: fileName,
        fileName,
        size: Number(session.fileSize) || Number(file.size) || 0,
        mimeType: session.mimeType || file.mimeType || '',
        driveFileId: file.id,
        downloadUrl: materialDownloadUrl(file.id),
        addedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const code = functionErrorCode(error);
    logFunctionError('drive-complete-material', code, error);
    if (code === 'CONFIG_MISSING') {
      return json(503, { error: 'Chưa cấu hình thư mục tài nguyên Drive.' });
    }
    return json(502, { error: 'Không hoàn tất được tài nguyên. Thử lại sau.' });
  }
}
