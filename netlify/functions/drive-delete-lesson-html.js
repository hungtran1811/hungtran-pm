import { requireAdmin } from './_lib/adminAuth.js';
import { deleteDriveFile } from './_lib/driveFolders.js';
import { clientIp, json, parseJsonBody, preflight } from './_lib/http.js';
import { checkRateLimit, DRIVE_LIMITS } from './_lib/rateLimit.js';
import { functionErrorCode, logFunctionError } from './_lib/functionLog.js';

export async function handler(event) {
  const early = preflight(event);
  if (early) return early;

  if (!checkRateLimit(`lesson-html-delete:ip:${clientIp(event)}`, { max: DRIVE_LIMITS.lessonHtml.ip })) {
    return json(429, { error: 'Bạn thao tác quá nhanh. Thử lại sau vài phút.' });
  }

  const admin = await requireAdmin(event);
  if (!admin.ok) return json(admin.status, { error: admin.error });

  let body;
  try {
    body = parseJsonBody(event);
  } catch {
    return json(400, { error: 'Dữ liệu gửi lên không hợp lệ.' });
  }

  const driveFileId = String(body.driveFileId || '').trim();
  if (!driveFileId) return json(400, { error: 'Thiếu mã file.' });

  try {
    await deleteDriveFile(driveFileId);
    return json(200, { ok: true });
  } catch (error) {
    logFunctionError('drive-delete-lesson-html', functionErrorCode(error), error);
    return json(502, { error: 'Không xóa được file HTML cũ trên Drive.' });
  }
}
