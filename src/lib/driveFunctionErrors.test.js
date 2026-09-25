import { describe, expect, it } from 'vitest';
import { isLocalFunctionsHint } from './driveFunctionErrors.js';

describe('isLocalFunctionsHint', () => {
  it('detects the local functions message', () => {
    expect(isLocalFunctionsHint(new Error('Chạy npm run dev:functions rồi tải lại trang.'))).toBe(true);
    expect(isLocalFunctionsHint(new Error('Máy chủ nộp bài đang lỗi.'))).toBe(false);
  });
});
