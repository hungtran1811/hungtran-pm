import { describe, expect, it } from 'vitest';
import { parseStudentPlainText } from './studentPlainText.js';

describe('parseStudentPlainText', () => {
  it('keeps paragraphs and single line breaks', () => {
    expect(parseStudentPlainText('Dòng 1\nDòng 2\n\nĐoạn hai')).toEqual([
      { type: 'paragraph', text: 'Dòng 1\nDòng 2' },
      { type: 'paragraph', text: 'Đoạn hai' },
    ]);
  });

  it('parses bullet and numbered lists', () => {
    expect(parseStudentPlainText('- Trang chủ\n- Form đăng nhập\n\n1. Push GitHub\n2. Nộp file')).toEqual([
      { type: 'list', items: ['Trang chủ', 'Form đăng nhập'] },
      { type: 'list', items: ['Push GitHub', 'Nộp file'] },
    ]);
  });

  it('returns empty for blank input', () => {
    expect(parseStudentPlainText('   \n')).toEqual([]);
  });
});
