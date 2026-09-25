import { describe, expect, it } from 'vitest';
import { driveHealthStatus } from './driveHealth.js';

describe('driveHealthStatus', () => {
  it('does not name missing variables', () => {
    expect(driveHealthStatus({})).toEqual({
      drive: 'missing_config',
      materials: 'missing_config',
    });
    expect(JSON.stringify(driveHealthStatus({}))).not.toMatch(/GOOGLE_|FIREBASE_/);
  });

  it('returns ok when required env is present', () => {
    expect(
      driveHealthStatus({
        GOOGLE_CLIENT_ID: 'id',
        GOOGLE_CLIENT_SECRET: 'secret',
        GOOGLE_REFRESH_TOKEN: 'refresh',
        GOOGLE_DRIVE_ROOT_FOLDER_ID: 'root',
        FIREBASE_SERVICE_ACCOUNT: '{}',
        GOOGLE_DRIVE_MATERIALS_ROOT_FOLDER_ID: 'materials',
      }),
    ).toEqual({ drive: 'ok', materials: 'ok' });
  });
});
