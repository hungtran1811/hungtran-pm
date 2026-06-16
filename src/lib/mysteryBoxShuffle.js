function randomInt(max) {
  if (max <= 0) return 0;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function fisherYates(arr) {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/** Break long runs of the same box type (reward/penalty/neutral). */
function spreadTypes(items) {
  const next = [...items];
  const maxAttempts = Math.max(next.length * 4, 12);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let moved = false;
    for (let i = 0; i < next.length - 1; i += 1) {
      if (next[i].type !== next[i + 1].type) continue;
      let runEnd = i + 1;
      while (runEnd < next.length - 1 && next[runEnd].type === next[i].type) {
        runEnd += 1;
      }
      if (runEnd <= i + 1) continue;

      for (let k = 0; k < next.length; k += 1) {
        if (k >= i && k <= runEnd) continue;
        if (next[k].type === next[i].type) continue;
        const swapIdx = i + 1 + randomInt(runEnd - i);
        [next[swapIdx], next[k]] = [next[k], next[swapIdx]];
        moved = true;
        break;
      }
      if (moved) break;
    }
    if (!moved) break;
  }

  return next;
}

/** Multi-pass crypto shuffle + type spreading for fair box placement. */
export function fairShuffleBoxContents(items) {
  if (items.length <= 1) return [...items];
  let result = [...items];
  const passes = 5 + randomInt(4);
  for (let p = 0; p < passes; p += 1) {
    result = fisherYates(result);
  }
  result = spreadTypes(result);
  result = fisherYates(result);
  return result;
}

export function buildShuffledBoxes(items) {
  const shuffled = fairShuffleBoxContents(items);
  const stamp = Date.now();
  return shuffled.map((item, i) => ({
    id: `box-${i}-${stamp}-${randomInt(9999)}`,
    displayNumber: i + 1,
    ...item,
    opened: false,
  }));
}

/** Reshuffle positions of remaining unopened boxes and renumber 1..n. */
export function reshuffleRemainingBoxes(remainingBoxes) {
  if (!remainingBoxes.length) return [];
  if (remainingBoxes.length === 1) {
    return [{ ...remainingBoxes[0], displayNumber: 1, opened: false }];
  }
  const items = remainingBoxes.map(({ type, label }) => ({ type, label }));
  return buildShuffledBoxes(items);
}

/** Pick balanced column count for presenting grid. */
export function presentingGridCols(count) {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  if (count <= 9) return 3;
  if (count <= 12) return 4;
  if (count <= 16) return 4;
  if (count <= 20) return 5;
  if (count <= 25) return 5;
  return 6;
}
