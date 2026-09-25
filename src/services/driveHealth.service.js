import { FUNCTIONS_BASE } from '../config/submissionConfig.js';
import { auth } from '../config/firebase.js';
import { reportDriveFunctionError } from '../lib/driveFunctionErrors.js';

function functionsUrl(name) {
  const base = (import.meta.env.VITE_NETLIFY_FUNCTIONS_BASE || FUNCTIONS_BASE).replace(/\/$/, '');
  return `${base}/${name}`;
}

export async function checkDriveHealth() {
  const user = auth.currentUser;
  if (!user) throw new Error('Cần đăng nhập quản trị.');

  let response;
  try {
    const token = await user.getIdToken();
    response = await fetch(functionsUrl('drive-health'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: '{}',
    });
  } catch {
    throw new Error(
      'Không kết nối được máy chủ Drive. Nếu đang test local hãy chạy npm run dev:functions.',
    );
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const error = new Error(payload.error || `Không kiểm tra được Drive (${response.status}).`);
    reportDriveFunctionError(error, { function: 'drive-health', status: response.status });
    throw error;
  }

  return {
    drive: payload.drive === 'ok' ? 'ok' : 'missing_config',
    materials: payload.materials === 'ok' ? 'ok' : 'missing_config',
  };
}
