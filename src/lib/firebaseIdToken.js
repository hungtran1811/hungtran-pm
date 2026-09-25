import { createVerify } from 'node:crypto';

const SECURE_TOKEN_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let certsCache = { certs: null, expiresAt: 0 };

export function decodeFirebaseIdToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  try {
    return {
      header: JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')),
      payload: JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')),
      signingInput: `${parts[0]}.${parts[1]}`,
      signature: parts[2],
    };
  } catch {
    return null;
  }
}

export function verifyJwtRs256(signingInput, signature, pem) {
  try {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(signingInput);
    verifier.end();
    return verifier.verify(pem, signature, 'base64url');
  } catch {
    return false;
  }
}

export function readFirebaseIdTokenClaims(payload, projectId) {
  const project = String(projectId || '').trim();
  const audience = String(payload?.aud || '').trim();
  const issuer = String(payload?.iss || '').trim();
  const email = String(payload?.email || '').trim().toLowerCase();
  const uid = String(payload?.user_id || payload?.sub || '').trim();
  const exp = Number(payload?.exp);

  if (!project || !uid || !email) return null;
  if (audience !== project) return null;
  if (issuer !== `https://securetoken.google.com/${project}`) return null;
  if (Number.isFinite(exp) && exp <= Math.floor(Date.now() / 1000)) return null;

  return { uid, email };
}

export async function getSecureTokenCerts(fetchImpl = fetch) {
  if (certsCache.certs && Date.now() < certsCache.expiresAt) {
    return certsCache.certs;
  }
  const response = await fetchImpl(SECURE_TOKEN_CERTS_URL);
  if (!response.ok) throw new Error('Không tải được chứng chỉ Firebase.');
  const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') || '')?.[1] || 3600);
  certsCache = {
    certs: await response.json(),
    expiresAt: Date.now() + Math.max(60, maxAge - 60) * 1000,
  };
  return certsCache.certs;
}

export async function verifyFirebaseIdToken(token, projectId, fetchImpl = fetch) {
  const decoded = decodeFirebaseIdToken(token);
  if (!decoded || decoded.header?.alg !== 'RS256' || !decoded.header?.kid) {
    return null;
  }
  const certs = await getSecureTokenCerts(fetchImpl);
  const pem = certs[decoded.header.kid];
  if (!pem || !verifyJwtRs256(decoded.signingInput, decoded.signature, pem)) {
    return null;
  }
  return readFirebaseIdTokenClaims(decoded.payload, projectId);
}

export function resetSecureTokenCertsCache() {
  certsCache = { certs: null, expiresAt: 0 };
}
