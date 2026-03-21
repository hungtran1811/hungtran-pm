export const APP_CONFIG = {
  functionsRegion: import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'asia-southeast1',
  useEmulators: import.meta.env.VITE_USE_EMULATORS === 'true',
  enableAdminDebugActions: import.meta.env.VITE_ENABLE_ADMIN_DEBUG_ACTIONS === 'true',
};
