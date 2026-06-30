export const buildInfo = {
  appVersion: import.meta.env.VITE_APP_VERSION || 'local-dev',
  mode: import.meta.env.MODE || 'development',
  firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  publicBaseUrl: import.meta.env.VITE_PUBLIC_BASE_URL || '',
  cloudinaryCloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '',
  cloudinaryUploadPresetConfigured: Boolean(import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET),
  cloudinaryCurriculumFolder: import.meta.env.VITE_CLOUDINARY_CURRICULUM_FOLDER || '',
  firestoreRulesDeployedAt: import.meta.env.VITE_FIREBASE_RULES_DEPLOYED_AT || '',
};
