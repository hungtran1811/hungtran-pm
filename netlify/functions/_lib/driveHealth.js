const DRIVE_ENV = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN',
  'GOOGLE_DRIVE_ROOT_FOLDER_ID',
  'FIREBASE_SERVICE_ACCOUNT',
];

function hasEnv(env, name) {
  return Boolean(String(env?.[name] || '').trim());
}

export function driveHealthStatus(env = process.env) {
  return {
    drive: DRIVE_ENV.every((name) => hasEnv(env, name)) ? 'ok' : 'missing_config',
    materials: hasEnv(env, 'GOOGLE_DRIVE_MATERIALS_ROOT_FOLDER_ID') ? 'ok' : 'missing_config',
  };
}
