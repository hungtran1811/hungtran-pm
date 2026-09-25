import { describe, expect, it } from 'vitest';
import { functionErrorCode } from './functionLog.js';

describe('functionErrorCode', () => {
  it('prefers an explicit error code', () => {
    expect(functionErrorCode({ code: 'SESSION_GONE', message: 'gone' })).toBe('SESSION_GONE');
  });

  it('maps missing env and unknown failures', () => {
    expect(functionErrorCode(new Error('Missing GOOGLE_DRIVE_ROOT_FOLDER_ID'))).toBe('CONFIG_MISSING');
    expect(functionErrorCode(new Error('Drive timeout'))).toBe('UPSTREAM_FAILED');
  });
});
