import { describe, expect, it } from 'vitest';
import { adminGameCards } from './adminGames.js';

describe('adminGameCards', () => {
  it('lists the five class games and hides Coding Showdown while the flag is off', () => {
    const titles = adminGameCards().map((card) => card.title);
    expect(titles).toEqual(['Quay tên', 'Lật bài', 'Hộp bí ẩn', 'Đoán số', 'Truy tìm gián điệp']);
    expect(titles).not.toContain('Coding Showdown');
  });

  it('includes Coding Showdown only when the flag is on', () => {
    expect(adminGameCards({ showdownEnabled: true }).map((card) => card.id)).toContain('coding-showdown');
  });
});
