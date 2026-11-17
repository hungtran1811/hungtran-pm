import { resolveClassLookup } from '../../src/lib/classAccessCode.js';
import { getAdminDb } from './_lib/firebaseAdmin.js';
import { checkRateLimit } from './_lib/rateLimit.js';
import { clientIp, json, parseJsonBody, preflight } from './_lib/http.js';
import { logFunctionError } from './_lib/functionLog.js';

export async function handler(event) {
  const early = preflight(event);
  if (early) return early;
  if (!checkRateLimit(`class-resolve:ip:${clientIp(event)}`, { max: 40 })) {
    return json(429, { error: 'Bạn thao tác quá nhanh. Thử lại sau vài phút.' });
  }

  let body;
  try {
    body = parseJsonBody(event);
  } catch {
    return json(400, { error: 'Dữ liệu gửi lên không hợp lệ.' });
  }

  try {
    const snap = await getAdminDb().collection('classes').get();
    const classes = snap.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        classCode: data.classCode || doc.id,
        className: data.className || '',
        status: data.status || '',
        hidden: data.hidden === true,
        studentAccessCode: data.studentAccessCode || '',
      };
    });
    const result = resolveClassLookup(body.input, classes);
    if (result.status === 'ambiguous') {
      return json(200, { status: 'ambiguous', message: result.message });
    }
    return json(200, result);
  } catch (error) {
    logFunctionError('class-resolve', 'CLASS_RESOLVE_FAILED', error);
    return json(500, { error: 'Không tra được mã lớp.' });
  }
}
