import { driveRootFolderId, getAccessToken } from './googleAuth.js';

function escapeDriveQuery(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function driveJson(url, { method = 'GET', body, origin } = {}) {
  const token = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (origin) headers.Origin = origin;

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload?.error?.message || `Drive API ${response.status}`);
    err.status = response.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

export async function findOrCreateChildFolder(parentId, name) {
  const folderName = String(name || '').trim();
  if (!parentId || !folderName) {
    throw new Error('Missing Drive folder parent or name');
  }

  const q = [
    `'${escapeDriveQuery(parentId)}' in parents`,
    `name = '${escapeDriveQuery(folderName)}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ].join(' and ');

  const listed = await driveJson(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`,
  );
  const existing = listed.files?.[0]?.id;
  if (existing) return existing;

  const created = await driveJson('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    body: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
  });
  if (!created.id) throw new Error(`Could not create Drive folder ${folderName}`);
  return created.id;
}

export async function findOrCreateClassFolder(classCode, cachedFolderId) {
  if (cachedFolderId) return cachedFolderId;
  return findOrCreateChildFolder(driveRootFolderId(), classCode);
}

export async function findOrCreateSubmissionFolder({
  classCode,
  cachedClassFolderId,
  studentFolderName,
  lessonFolderName,
}) {
  const classFolderId = await findOrCreateClassFolder(classCode, cachedClassFolderId);
  const studentFolderId = await findOrCreateChildFolder(classFolderId, studentFolderName);
  const lessonFolderId = await findOrCreateChildFolder(studentFolderId, lessonFolderName);
  return { classFolderId, studentFolderId, lessonFolderId };
}

export async function createResumableUpload({
  storedFileName,
  mimeType,
  fileSize,
  folderId,
  origin,
}) {
  const token = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': mimeType || 'application/octet-stream',
    'X-Upload-Content-Length': String(fileSize),
  };
  if (origin) headers.Origin = origin;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: storedFileName,
        parents: [folderId],
      }),
    },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const err = new Error(payload?.error?.message || 'Could not start Drive upload');
    err.status = response.status;
    throw err;
  }

  const uploadUrl = response.headers.get('location');
  if (!uploadUrl) throw new Error('Drive did not return upload URL');
  return uploadUrl;
}

export async function getDriveFile(fileId) {
  return driveJson(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,size,mimeType,parents,trashed`,
  );
}
