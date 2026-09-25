import { requireAdmin } from './_lib/adminAuth.js';
import { driveHealthStatus } from './_lib/driveHealth.js';
import { json, preflight } from './_lib/http.js';
import { functionErrorCode, logFunctionError } from './_lib/functionLog.js';

export async function handler(event) {
  const early = preflight(event);
  if (early) return early;

  try {
    const admin = await requireAdmin(event);
    if (!admin.ok) return json(admin.status, { error: admin.error });
    return json(200, driveHealthStatus());
  } catch (error) {
    logFunctionError('drive-health', functionErrorCode(error), error);
    return json(502, { error: 'Không kiểm tra được cấu hình Drive.' });
  }
}
