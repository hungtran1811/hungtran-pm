/** Đọc claim Firebase ID token đã được Google xác minh (không dùng firebase-admin/auth). */

export function readFirebaseIdTokenClaims(payload, projectId) {
  const project = String(projectId || '').trim();
  const audience = String(payload?.aud || '').trim();
  const issuer = String(payload?.iss || '').trim();
  const email = String(payload?.email || '').trim().toLowerCase();
  const uid = String(payload?.user_id || payload?.sub || '').trim();

  if (!project || !uid || !email) return null;
  if (audience !== project) return null;
  if (issuer !== `https://securetoken.google.com/${project}`) return null;

  return { uid, email };
}
