import { computeWheelSpin, pickRandomIndex } from './luckyWheel.js';

const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

export const SPECIAL_EFFECTS = [
  { value: 'lose_turn', label: 'Mất lượt' },
  { value: 'free_letter', label: 'Chọn chữ tự do' },
  { value: 'spin_again', label: 'Quay thêm' },
  { value: 'reveal_vowel', label: 'Mở nguyên âm' },
];

export const DEFAULT_SPECIALS = [
  { id: 'sp-0', label: 'Mất lượt', effect: 'lose_turn' },
  { id: 'sp-1', label: 'Chọn chữ', effect: 'free_letter' },
  { id: 'sp-2', label: 'Quay thêm', effect: 'spin_again' },
];

function isHiddenChar(char) {
  return /[A-Za-z0-9]/.test(char);
}

function normalizeLetter(char) {
  return String(char).toUpperCase();
}

/** Build puzzle board from code string. Structural chars visible; letters/digits hidden. */
export function buildPuzzleBoard(code) {
  const lines = String(code || '').split('\n');
  const rows = lines.map((line, rowIndex) => {
    const cells = [...line].map((char, colIndex) => {
      const hidden = isHiddenChar(char);
      return {
        id: `${rowIndex}-${colIndex}`,
        char,
        hidden,
        revealed: !hidden,
        rowIndex,
        colIndex,
      };
    });
    return cells;
  });
  return { rows, source: code };
}

export function cloneBoard(board) {
  return {
    ...board,
    rows: board.rows.map((row) => row.map((cell) => ({ ...cell }))),
  };
}

export function countHiddenLetters(board) {
  let count = 0;
  board.rows.forEach((row) => {
    row.forEach((cell) => {
      if (cell.hidden && !cell.revealed) count += 1;
    });
  });
  return count;
}

export function isPuzzleComplete(board) {
  return countHiddenLetters(board) === 0;
}

export function getHiddenLettersSet(board) {
  const set = new Set();
  board.rows.forEach((row) => {
    row.forEach((cell) => {
      if (cell.hidden && !cell.revealed) {
        set.add(normalizeLetter(cell.char));
      }
    });
  });
  return set;
}

/** Reveal all cells matching letter (case-insensitive). Returns count revealed. */
export function revealLetter(board, letter) {
  const target = normalizeLetter(letter);
  let count = 0;
  board.rows.forEach((row) => {
    row.forEach((cell) => {
      if (cell.hidden && !cell.revealed && normalizeLetter(cell.char) === target) {
        cell.revealed = true;
        count += 1;
      }
    });
  });
  return count;
}

export function revealRandomVowel(board) {
  const hidden = getHiddenLettersSet(board);
  const vowels = [...hidden].filter((l) => VOWELS.has(l));
  if (!vowels.length) return { letter: null, count: 0 };
  const letter = vowels[pickRandomIndex(vowels.length)];
  const count = revealLetter(board, letter);
  return { letter, count };
}

export function buildWheelSegments(board, specials = []) {
  const hiddenLetters = [...getHiddenLettersSet(board)].sort();
  const letterSegments = hiddenLetters.map((letter) => ({
    id: `letter-${letter}`,
    type: 'letter',
    label: letter,
    letter,
  }));
  const specialSegments = specials.map((sp) => ({
    id: sp.id,
    type: 'special',
    label: sp.label,
    effect: sp.effect,
  }));
  return [...letterSegments, ...specialSegments];
}

export function spinWheel(segments, currentRotation = 0) {
  if (!segments.length) return { segment: null, rotation: currentRotation, index: 0 };
  const index = pickRandomIndex(segments.length);
  const { rotation } = computeWheelSpin(segments.length, index, currentRotation);
  return { segment: segments[index], rotation, index };
}

export function formatRevealMessage(letter, count) {
  if (count <= 0) return `Không có chữ ${normalizeLetter(letter)} — mất lượt`;
  if (count === 1) return `Có 1 chữ ${normalizeLetter(letter)}!`;
  return `Có ${count} chữ ${normalizeLetter(letter)}!`;
}

export function applySpecialEffect(effect, board) {
  switch (effect) {
    case 'lose_turn':
      return { message: 'Mất lượt!', keepTurn: false, spinAgain: false, needsLetterPick: false };
    case 'free_letter':
      return { message: 'Chọn chữ tự do', keepTurn: true, spinAgain: false, needsLetterPick: true };
    case 'spin_again':
      return { message: 'Quay thêm!', keepTurn: true, spinAgain: true, needsLetterPick: false };
    case 'reveal_vowel': {
      const { letter, count } = revealRandomVowel(board);
      if (!letter || count === 0) {
        return { message: 'Không còn nguyên âm — mất lượt', keepTurn: false, spinAgain: false, needsLetterPick: false };
      }
      return {
        message: `Mở nguyên âm ${letter} — ${formatRevealMessage(letter, count)}`,
        keepTurn: count > 0,
        spinAgain: false,
        needsLetterPick: false,
        letter,
        count,
      };
    }
    default:
      return { message: 'Ô đặc biệt', keepTurn: false, spinAgain: false, needsLetterPick: false };
  }
}

export { computeWheelSpin, pickRandomIndex, ALPHANUM };
