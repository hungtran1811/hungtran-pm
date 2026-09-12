/** Phase 1: giới hạn trong process. TODO: chuyển Redis/Upstash nếu scale. */

const buckets = new Map();
const WINDOW_MS = 10 * 60 * 1000;

/** Một lớp ~12 máy cùng NAT/WiFi dùng chung IP — trần IP phải đủ rộng. */
export const DRIVE_LIMITS = {
  list: { ip: 120, student: 30 },
  create: { ip: 80, student: 10 },
  complete: { ip: 80, student: 12 },
};

export function checkRateLimit(key, { max = 12, windowMs = WINDOW_MS } = {}) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= max;
}
