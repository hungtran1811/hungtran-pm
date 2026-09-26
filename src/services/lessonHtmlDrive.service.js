import { FEATURE_DRIVE_LESSON_HTML_ENABLED } from '../config/features.js';
import { FUNCTIONS_BASE } from '../config/submissionConfig.js';
import { auth } from '../config/firebase.js';
import { reportDriveFunctionError } from '../lib/driveFunctionErrors.js';
import {
  htmlUtf8Size,
  isLessonHtmlDrivePart,
  normalizeLessonHtmlDrivePointer,
} from '../lib/lessonHtmlDrive.js';

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

async function postJson(name, body, { admin = false } = {}) {
  let response;
  try {
    response = await fetch(functionsUrl(name), {
      method: 'POST',
      headers: admin ? await adminHeaders() : { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      'Không kết nối được máy chủ bài giảng. Nếu đang test local hãy chạy npm run dev:functions.',
    );
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (response.ok) return payload;
  const error = new Error(payload.error || `Không xử lý được yêu cầu (${response.status}).`);
  if (response.status >= 500 || response.status === 429) {
    reportDriveFunctionError(error, { function: name, status: response.status });
  }
  throw error;
}

function putHtmlWithProgress(uploadUrl, html) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', 'text/html; charset=UTF-8');
    xhr.responseType = 'json';
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = xhr.response && typeof xhr.response === 'object' ? xhr.response : {};
        if (!data.id) {
          reject(new Error('Drive không trả về mã file.'));
          return;
        }
        resolve(data.id);
        return;
      }
      reject(new Error('Tải HTML lên Drive thất bại. Thử lại.'));
    };
    xhr.onerror = () => reject(new Error('Mất kết nối khi tải HTML lên Drive.'));
    xhr.send(new Blob([html], { type: 'text/html' }));
  });
}

export async function uploadLessonHtmlPart({
  programId,
  lessonId,
  sessionNumber,
  part,
  html,
  previousFileId = '',
} = {}) {
  if (!isLessonHtmlDrivePart(part)) throw new Error('Phần HTML không hợp lệ.');
  const session = await postJson(
    'drive-create-lesson-html-session',
    {
      programId,
      lessonId,
      sessionNumber,
      part,
      fileSize: htmlUtf8Size(html),
    },
    { admin: true },
  );
  if (!session.uploadUrl || !session.uploadToken) {
    throw new Error('Không tạo được phiên lưu HTML.');
  }
  const driveFileId = await putHtmlWithProgress(session.uploadUrl, html);
  const completed = await postJson(
    'drive-complete-lesson-html',
    {
      uploadToken: session.uploadToken,
      driveFileId,
      previousFileId,
    },
    { admin: true },
  );
  const pointer = normalizeLessonHtmlDrivePointer(completed.pointer);
  if (!pointer) throw new Error('Không nhận được thông tin file HTML trên Drive.');
  return pointer;
}

export async function deleteLessonHtmlFile(driveFileId) {
  const id = String(driveFileId || '').trim();
  if (!id) return;
  await postJson('drive-delete-lesson-html', { driveFileId: id }, { admin: true }).catch(() => {});
}

export async function fetchLessonHtml({ programId, lessonId, part }) {
  const payload = await postJson(
    'drive-get-lesson-html',
    { programId, lessonId, part },
    { admin: Boolean(auth.currentUser) },
  );
  return String(payload.html || '');
}

export async function hydrateLessonHtml(lesson, { programId } = {}) {
  if (!FEATURE_DRIVE_LESSON_HTML_ENABLED || !lesson) return lesson;
  const next = { ...lesson, htmlHydrationError: '' };
  const tasks = [];
  if (lesson.lectureHtmlDrive && !String(lesson.content || '').trim()) {
    tasks.push(
      fetchLessonHtml({ programId, lessonId: lesson.id, part: 'lecture' })
        .then((html) => {
          next.content = html;
        })
        .catch((error) => {
          next.htmlHydrationError = error.message || 'Không tải được bài giảng. Thử lại.';
        }),
    );
  }
  if (lesson.exerciseHtmlDrive && !String(lesson.exercise || '').trim()) {
    tasks.push(
      fetchLessonHtml({ programId, lessonId: lesson.id, part: 'exercise' })
        .then((html) => {
          next.exercise = html;
        })
        .catch((error) => {
          next.htmlHydrationError = error.message || 'Không tải được bài giảng. Thử lại.';
        }),
    );
  }
  if (tasks.length) await Promise.all(tasks);
  return next;
}
