import { describe, expect, it } from 'vitest';
import { namesMatch, normalizeStudentName } from './normalizeStudentName.js';

describe('normalizeStudentName', () => {
  it('turns Vietnamese names into PascalCase without spaces', () => {
    expect(normalizeStudentName('Nguyễn Văn An')).toBe('NguyenVanAn');
    expect(normalizeStudentName('Trần Thị Đào')).toBe('TranThiDao');
  });

  it('ignores punctuation and extra spaces', () => {
    expect(normalizeStudentName('  Lê   Minh-Khoa ')).toBe('LeMinhKhoa');
  });

  it('returns empty for blank input', () => {
    expect(normalizeStudentName('')).toBe('');
    expect(normalizeStudentName('   ')).toBe('');
  });
});

describe('namesMatch', () => {
  it('matches identical and accent-normalized names', () => {
    expect(namesMatch('Nguyễn Văn An', 'Nguyen Van An')).toBe(true);
    expect(namesMatch('An', 'Binh')).toBe(false);
  });
});
