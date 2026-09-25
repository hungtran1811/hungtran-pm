/** Tách đoạn văn / danh sách từ text học sinh gõ (xuống dòng, gạch đầu dòng). */

export function parseStudentPlainText(text) {
  const raw = String(text || '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!raw) return [];

  return raw.split(/\n{2,}/).flatMap((chunk) => {
    const lines = chunk.split('\n').map((line) => line.trimEnd());
    const items = [];
    for (const line of lines) {
      const match = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)$/);
      if (!match) {
        return [{ type: 'paragraph', text: lines.join('\n') }];
      }
      items.push(match[1].trim());
    }
    return items.length ? [{ type: 'list', items }] : [];
  });
}
