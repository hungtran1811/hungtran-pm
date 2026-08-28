/** @param {string} name */
export function buildSpyNameHint(name, level) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'Có một gián điệp đang ẩn nấp trong nhóm.';

  const lettersOnly = trimmed.replace(/\s+/g, '');
  const words = trimmed.split(/\s+/).filter(Boolean);
  const firstChar = trimmed[0] || '';

  if (level <= 1) {
    return `Một gián điệp có tên gồm ${lettersOnly.length} chữ cái (không tính khoảng trắng).`;
  }
  if (level === 2) {
    return `Tên gián điệp bắt đầu bằng chữ «${firstChar}».`;
  }
  if (level === 3) {
    return `Tên gián điệp có ${words.length} từ.`;
  }
  if (level === 4) {
    const partial = trimmed.slice(0, Math.min(2, trimmed.length));
    return `Tên gián điệp bắt đầu bằng «${partial}...»`;
  }
  if (level === 5) {
    const partial = trimmed.slice(0, Math.min(Math.ceil(trimmed.length * 0.4), trimmed.length - 1));
    return `Tên gián điệp: «${partial}...»`;
  }
  if (level === 6) {
    const partial = trimmed.slice(0, Math.max(trimmed.length - 2, Math.ceil(trimmed.length * 0.65)));
    return `Tên gián điệp gần đúng: «${partial}...»`;
  }
  return `Gián điệp có thể là: «${trimmed}»`;
}

/**
 * Tính hint mới sau khi một dân thường / phi hành đoàn bị loại.
 * @param {{ participants?: Array<{ id: string, isSpy?: boolean, studentName?: string }>, eliminatedIds?: string[] }} params
 */
export function advanceSpyHint({ participants = [], eliminatedIds = [] }) {
  const eliminated = new Set(eliminatedIds || []);
  const activeSpies = participants.filter((p) => p.isSpy && !eliminated.has(p.id));
  if (!activeSpies.length) {
    return { spyHintLevel: 0, spyHintText: '', spyHintSpyId: '' };
  }

  const civilianDeaths = participants.filter(
    (p) => !p.isSpy && eliminated.has(p.id),
  ).length;
  if (civilianDeaths <= 0) {
    return { spyHintLevel: 0, spyHintText: '', spyHintSpyId: '' };
  }

  const spyIndex = (civilianDeaths - 1) % activeSpies.length;
  const targetSpy = activeSpies[spyIndex];
  const level = Math.min(7, Math.ceil(civilianDeaths / activeSpies.length));

  return {
    spyHintLevel: level,
    spyHintText: buildSpyNameHint(targetSpy.studentName, level),
    spyHintSpyId: targetSpy.id,
  };
}
