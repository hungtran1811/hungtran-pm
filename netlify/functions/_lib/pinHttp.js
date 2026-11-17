import { requireAdmin } from './adminAuth.js';
import { getAdminDb } from './firebaseAdmin.js';
import { clientIp, json, parseJsonBody, preflight } from './http.js';
import { checkRateLimit } from './rateLimit.js';
import { logFunctionError } from './functionLog.js';

export function pinHandler(name, action, { admin = false, max = 30 } = {}) {
  return async function handler(event) {
    const early = preflight(event);
    if (early) return early;
    if (!checkRateLimit(`${name}:ip:${clientIp(event)}`, { max })) {
      return json(429, { error: 'Bạn thao tác quá nhanh. Thử lại sau vài phút.' });
    }

    let body = {};
    try {
      body = parseJsonBody(event);
    } catch {
      return json(400, { error: 'Dữ liệu gửi lên không hợp lệ.' });
    }

    if (admin) {
      const authResult = await requireAdmin(event);
      if (!authResult.ok) return json(authResult.status, { error: authResult.error });
      body.email = authResult.email;
    }

    try {
      const result = await action(getAdminDb(), body, event);
      if (!result?.ok) return json(result?.status || 400, { error: result?.error || 'Không xử lý được yêu cầu.' });
      return json(200, result.body || { ok: true });
    } catch (error) {
      logFunctionError(name, error?.code || 'PIN_FAILED', error?.code === 'PIN_PEPPER_MISSING' ? error : new Error(name));
      if (error?.code === 'PIN_PEPPER_MISSING') {
        return json(500, { error: 'Máy chủ chưa cấu hình PIN.' });
      }
      return json(500, { error: 'Không xử lý được yêu cầu.' });
    }
  };
}
