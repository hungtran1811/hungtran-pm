export const OLYMPIA_PRESET_PACKS = [
  {
    id: 'pack-sessions-1-3',
    label: 'Buổi 1–3: Làm quen Python',
    description: 'print, biến, số, phép toán cơ bản',
    sessionRange: [1, 3],
    questions: {
      startup: ['py-print-01', 'py-print-02', 'py-var-01', 'py-var-02', 'py-var-04'],
      acceleration: ['py-var-a02', 'py-loop-a02', 'py-var-a03'],
      finish: ['py-var-f02', 'py-str-f02'],
    },
  },
  {
    id: 'pack-sessions-4-6',
    label: 'Buổi 4–6: Rẽ nhánh & vòng lặp',
    description: 'if/else, for, while, range',
    sessionRange: [4, 6],
    questions: {
      startup: ['py-if-01', 'py-if-02', 'py-loop-01', 'py-loop-02', 'py-loop-05'],
      acceleration: ['py-loop-a01', 'py-if-a01', 'py-loop-a04'],
      finish: ['py-loop-f02', 'py-if-f01'],
    },
  },
  {
    id: 'pack-sessions-7-9',
    label: 'Buổi 7–9: Chuỗi & danh sách',
    description: 'string methods, list cơ bản, join/split',
    sessionRange: [7, 9],
    questions: {
      startup: ['py-str-01', 'py-str-06', 'py-list-01', 'py-list-02', 'py-str-07'],
      acceleration: ['py-str-a01', 'py-list-a03', 'py-list-a04'],
      finish: ['py-str-f01', 'py-list-f04'],
    },
  },
  {
    id: 'pack-sessions-10-12',
    label: 'Buổi 10–12: Hàm',
    description: 'def, return, tham số, default argument',
    sessionRange: [10, 12],
    questions: {
      startup: ['py-fn-01', 'py-fn-02', 'py-fn-03', 'py-list-03', 'py-str-04'],
      acceleration: ['py-fn-a01', 'py-fn-a02', 'py-list-a02'],
      finish: ['py-fn-f01', 'py-fn-f02'],
    },
  },
  {
    id: 'pack-mixed-review',
    label: 'Ôn tổng hợp',
    description: 'Trộn nhẹ các chủ đề — phù hợp cuối khóa hoặc kiểm tra nhanh',
    sessionRange: [1, 12],
    questions: {
      startup: ['py-var-03', 'py-loop-04', 'py-str-05', 'py-list-04', 'py-if-04'],
      acceleration: ['py-var-a01', 'py-list-a02', 'py-str-a02'],
      finish: ['py-list-f02', 'py-var-f01'],
    },
  },
];

export const OLYMPIA_PACK_BY_ID = Object.fromEntries(OLYMPIA_PRESET_PACKS.map((p) => [p.id, p]));

export function suggestPackForSession(sessionNumber) {
  const n = Number(sessionNumber) || 0;
  if (n <= 0) return OLYMPIA_PRESET_PACKS[0];
  const match = OLYMPIA_PRESET_PACKS.find(
    (p) => p.id !== 'pack-mixed-review' && n >= p.sessionRange[0] && n <= p.sessionRange[1],
  );
  return match || OLYMPIA_PRESET_PACKS[OLYMPIA_PRESET_PACKS.length - 1];
}

export function getPackLabel(packId) {
  return OLYMPIA_PACK_BY_ID[packId]?.label || packId;
}
