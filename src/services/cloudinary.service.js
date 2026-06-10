import { cloudinaryConfig } from '../config/firebase.js';

export async function uploadImage(file) {
  const { cloudName, uploadPreset, curriculumFolder } = cloudinaryConfig;
  if (!cloudName || !uploadPreset) {
    throw new Error('Chưa cấu hình Cloudinary trong .env');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  if (curriculumFolder) {
    formData.append('folder', curriculumFolder);
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Tải ảnh lên thất bại. Vui lòng thử lại.');
  }

  const data = await response.json();
  return {
    secureUrl: data.secure_url,
    publicId: data.public_id ?? '',
    width: Number(data.width ?? 0),
    height: Number(data.height ?? 0),
  };
}
