import { APP_CONFIG } from '../config/app-config.js';

const MAX_CURRICULUM_IMAGE_SIZE_MB = 8;

export function isCloudinaryConfigured() {
  return Boolean(APP_CONFIG.cloudinaryCloudName && APP_CONFIG.cloudinaryUploadPreset);
}

function ensureImageFile(file) {
  if (!file) {
    throw new Error('Chưa chọn ảnh để tải lên.');
  }

  if (!String(file.type || '').startsWith('image/')) {
    throw new Error('Chỉ có thể tải lên tệp hình ảnh.');
  }

  const maxBytes = MAX_CURRICULUM_IMAGE_SIZE_MB * 1024 * 1024;

  if (Number(file.size || 0) > maxBytes) {
    throw new Error(`Ảnh không được vượt quá ${MAX_CURRICULUM_IMAGE_SIZE_MB}MB.`);
  }
}

export async function uploadCurriculumLessonImage(file) {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary chưa được cấu hình cho môi trường này.');
  }

  ensureImageFile(file);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', APP_CONFIG.cloudinaryUploadPreset);
  formData.append('folder', APP_CONFIG.cloudinaryCurriculumFolder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${APP_CONFIG.cloudinaryCloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    },
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      'Không thể tải ảnh minh họa lên Cloudinary.';

    throw new Error(message);
  }

  return {
    secureUrl: String(payload.secure_url || '').trim(),
    publicId: String(payload.public_id || '').trim(),
    width: Number(payload.width || 0),
    height: Number(payload.height || 0),
    alt: '',
  };
}
