import { CREW_MINI_GAME_IDS } from '../data/crewMiniGames.js';

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shuffleWithRng(items, rng) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildTaskInstance(taskId, instanceSeed) {
  const rng = seededRandom(instanceSeed);
  switch (taskId) {
    case 'tap_sequence': {
      const order = shuffleWithRng([1, 2, 3, 4], rng);
      return { taskId, instanceSeed, order };
    }
    case 'odd_one_out': {
      const oddIndex = Math.floor(rng() * 6);
      const hue = Math.floor(rng() * 360);
      const sat = 58 + Math.floor(rng() * 12);
      const light = 50 + Math.floor(rng() * 8);
      return { taskId, instanceSeed, oddIndex, baseHue: hue, baseSat: sat, baseLight: light };
    }
    case 'timing_bar': {
      const zoneStart = 35 + Math.floor(rng() * 40);
      const zoneWidth = 12 + Math.floor(rng() * 8);
      return { taskId, instanceSeed, zoneStart, zoneWidth };
    }
    case 'wire_match': {
      const colors = ['red', 'blue', 'yellow'];
      const leftOrder = shuffleWithRng(colors, rng);
      return { taskId, instanceSeed, leftOrder };
    }
    case 'quick_count': {
      const count = 3 + Math.floor(rng() * 5);
      const emoji = ['🍎', '⭐', '🔵', '🟢', '🟡'][Math.floor(rng() * 5)];
      const options = new Set([count]);
      while (options.size < 4) {
        const delta = Math.floor(rng() * 5) - 2;
        const candidate = Math.max(1, count + delta);
        options.add(candidate);
      }
      return {
        taskId,
        instanceSeed,
        count,
        emoji,
        options: shuffleWithRng([...options], rng),
      };
    }
    default:
      return { taskId, instanceSeed };
  }
}

export function assignCrewTasks({ sessionId, studentId, count = 5 }) {
  const seed = hashSeed(`${sessionId}|${studentId}|crew`);
  const rng = seededRandom(seed);
  const pool = shuffleWithRng([...CREW_MINI_GAME_IDS], rng);
  const picks = [];
  for (let i = 0; i < count; i += 1) {
    const taskId = pool[i % pool.length];
    const instanceSeed = hashSeed(`${sessionId}|${studentId}|${i}|${taskId}`);
    picks.push({ taskId, instanceSeed });
  }
  return picks;
}

export function validateCrewTask(taskId, instanceSeed, payload = {}) {
  const instance = buildTaskInstance(taskId, instanceSeed);
  switch (taskId) {
    case 'tap_sequence':
      return {
        ok: Array.isArray(payload.sequence)
          && payload.sequence.length === instance.order.length
          && payload.sequence.every((n, i) => n === instance.order[i]),
      };
    case 'odd_one_out':
      return { ok: Number(payload.pickIndex) === instance.oddIndex };
    case 'timing_bar':
      return {
        ok: typeof payload.position === 'number'
          && payload.position >= instance.zoneStart
          && payload.position <= instance.zoneStart + instance.zoneWidth,
      };
    case 'wire_match': {
      if (!Array.isArray(payload.matches) || payload.matches.length !== instance.leftOrder.length) {
        return { ok: false };
      }
      const ok = instance.leftOrder.every((color, i) => {
        const m = payload.matches[i];
        return m?.left === color && m?.right === color;
      });
      return { ok };
    }
    case 'quick_count':
      return { ok: Number(payload.answer) === instance.count };
    default:
      return { ok: false };
  }
}
