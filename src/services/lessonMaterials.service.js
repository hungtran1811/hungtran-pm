import { FUNCTIONS_BASE } from '../config/submissionConfig.js';
import { auth } from '../config/firebase.js';
import { canAddLessonResource, validateCreateMaterialInput } from '../lib/lessonResources.js';

function functionsUrl(name) {
  const base = (import.meta.env.VITE_NETLIFY_FUNCTIONS_BASE || FUNCTIONS_BASE).replace(/\/$/, '');
  return `${base}/${name}`;
}

async function adminHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error('Cần đăng nhập quản trị.');
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function postAdminJson(name, body) {
  let response;
  try {
    response = await fetch(functionsUrl(name), {
      method: 'POST',
      headers: await adminHeaders(),
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      'Không kết nối được máy chủ tài nguyên. Chạy npm run dev:functions rồi tải lại trang.',
    );
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (response.ok) return payload;
  throw new Error(
    payload.error ||
      (response.status >= 500
        ? 'Máy chủ tài nguyên đang lỗi. Nếu đang test local, chạy npm run dev:functions rồi thử lại.'
        : `Không xử lý được yêu cầu (${response.status}).`),
  );
}

function putFileWithProgress(uploadUrl, file, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.responseType = 'json';

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress?.(percent);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = xhr.response && typeof xhr.response === 'object' ? xhr.response : {};
        if (!data.id) {
          reject(new Error('Drive không trả về mã file.'));
          return;
        }
        onProgress?.(100);
        resolve(data.id);
        return;
      }
      reject(new Error('Tải file lên Drive thất bại. Thử lại.'));
    };

    xhr.onerror = () => reject(new Error('Mất kết nối khi tải file lên Drive.'));
    xhr.send(file);
  });
}

export async function uploadLessonMaterial({
  programId,
  sessionNumber,
  file,
  existingResources = [],
  onProgress,
} = {}) {
  if (!canAddLessonResource(existingResources)) {
    throw new Error('Mỗi buổi tối đa 5 file tài nguyên.');
  }

  const input = validateCreateMaterialInput({
    programId,
    sessionNumber,
    fileName: file?.name,
    fileSize: file?.size,
    mimeType: file?.type,
  });
  if (!input.ok) throw new Error(input.error);

  const session = await postAdminJson('drive-create-material-session', {
    programId: input.programId,
    sessionNumber: input.sessionNumber,
    fileName: input.fileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
  });
  if (!session.uploadUrl || !session.uploadToken) {
    throw new Error('Không tạo được phiên tải tài nguyên.');
  }

  const driveFileId = await putFileWithProgress(session.uploadUrl, file, { onProgress });
  const completed = await postAdminJson('drive-complete-material', {
    uploadToken: session.uploadToken,
    driveFileId,
  });
  if (!completed.resource?.downloadUrl) {
    throw new Error('Không nhận được link tải tài nguyên.');
  }
  return completed.resource;
}
