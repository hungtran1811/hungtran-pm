import { getAdminDb } from './_lib/firebaseAdmin.js';
import { listPublicRoster } from './_lib/classRoster.js';
import { checkRateLimit } from './_lib/rateLimit.js';
import { clientIp, json, parseJsonBody, preflight } from './_lib/http.js';
import { logFunctionError } from './_lib/functionLog.js';

export async function handler(event) {
  const early = preflight(event);
  if (early) return early;
  if (!checkRateLimit(`class-roster:ip:${clientIp(event)}`, { max: 40 })) {
    return json(429, { error: 'Bạn thao tác quá nhanh. Thử lại sau vài phút.' });
  }

  let body;
  try {
    body = parseJsonBody(event);
  } catch {
    return json(400, { error: 'Dữ liệu gửi lên không hợp lệ.' });
  }

  try {
    const result = await listPublicRoster(getAdminDb(), body.classCode);
    if (!result.ok) return json(result.status || 400, { error: result.error });
    return json(200, result.body);
  } catch (error) {
    logFunctionError('class-roster', 'CLASS_ROSTER_FAILED', error);
    return json(500, { error: 'Không tải được danh sách lớp.' });
  }
}
