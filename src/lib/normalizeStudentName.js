/** Bỏ dấu tiếng Việt rồi ghép thành PascalCase không khoảng trắng: Nguyễn Văn An → NguyenVanAn */

function stripVietnamese(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function normalizeStudentName(name) {
  const words = stripVietnamese(name)
    .replace(/[^A-Za-z0-9\s]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return '';

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export function namesMatch(left, right) {
  const a = String(left || '').trim();
  const b = String(right || '').trim();
  if (!a || !b) return false;
  if (a === b) return true;
  return normalizeStudentName(a) === normalizeStudentName(b);
}
