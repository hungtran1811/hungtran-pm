let cached = { token: '', expiresAt: 0 };

export async function getAccessToken() {
  const now = Date.now();
  if (cached.token && now < cached.expiresAt - 60_000) {
    return cached.token;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Google OAuth env');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error('Google token refresh failed');
  }

  cached = {
    token: payload.access_token,
    expiresAt: now + Number(payload.expires_in || 3600) * 1000,
  };
  return cached.token;
}

export function driveRootFolderId() {
  const id = String(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '').trim();
  if (!id) throw new Error('Missing GOOGLE_DRIVE_ROOT_FOLDER_ID');
  return id;
}

export function driveMaterialsRootFolderId() {
  const id = String(process.env.GOOGLE_DRIVE_MATERIALS_ROOT_FOLDER_ID || '').trim();
  if (!id) throw new Error('Missing GOOGLE_DRIVE_MATERIALS_ROOT_FOLDER_ID');
  return id;
}
