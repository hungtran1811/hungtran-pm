export function shuffleArray(items) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function parsePuzzleLines(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseAnswerLines(text) {
  const lines = parsePuzzleLines(text);
  return lines.length ? lines : [];
}

/** Spin wheel: pick random index and compute rotation degrees (clockwise). */
export function computeWheelSpin(segmentCount, targetIndex, currentRotation = 0) {
  if (segmentCount <= 0) return { targetIndex: 0, rotation: currentRotation };
  const idx = Math.max(0, Math.min(segmentCount - 1, targetIndex));
  const slice = 360 / segmentCount;
  const segmentCenter = idx * slice + slice / 2;
  const extraTurns = 4 + Math.floor(Math.random() * 3);
  const targetMod = (360 - segmentCenter + 360) % 360;
  const currentMod = ((currentRotation % 360) + 360) % 360;
  let delta = targetMod - currentMod;
  if (delta < 0) delta += 360;
  const rotation = currentRotation + extraTurns * 360 + delta;
  return { targetIndex: idx, rotation };
}

export function pickRandomIndex(count) {
  if (count <= 0) return 0;
  return Math.floor(Math.random() * count);
}

export function segmentColors(count) {
  const palette = [
    '#13D4E6',
    '#1596FF',
    '#5142FF',
    '#8B2AF6',
    '#316ffd',
    '#22d3ee',
    '#6366f1',
    '#a855f7',
  ];
  return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
}
