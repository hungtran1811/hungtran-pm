export const CREW_MINI_GAME_IDS = [
  'tap_sequence',
  'odd_one_out',
  'timing_bar',
  'wire_match',
  'quick_count',
  'number_sort',
  'math_pick',
  'symbol_hunt',
  'direction_dash',
];

export const CREW_MINI_GAMES = {
  tap_sequence: {
    id: 'tap_sequence',
    label: 'Bấm đúng thứ tự',
    instruction: 'Bấm các nút theo đúng thứ tự hiển thị.',
  },
  odd_one_out: {
    id: 'odd_one_out',
    label: 'Tìm khác biệt',
    instruction: 'Chọn ô khác biệt so với các ô còn lại.',
  },
  timing_bar: {
    id: 'timing_bar',
    label: 'Dừng đúng lúc',
    instruction: 'Bấm khi thanh nằm trong vùng xanh.',
  },
  wire_match: {
    id: 'wire_match',
    label: 'Nối dây',
    instruction: 'Chọn màu bên phải trùng với màu bên trái.',
  },
  quick_count: {
    id: 'quick_count',
    label: 'Đếm nhanh',
    instruction: 'Nhớ số lượng emoji rồi chọn đáp án đúng.',
  },
  number_sort: {
    id: 'number_sort',
    label: 'Sắp số',
    instruction: 'Bấm các số theo thứ tự tăng dần từ 1 đến 6.',
  },
  math_pick: {
    id: 'math_pick',
    label: 'Tính nhanh',
    instruction: 'Chọn đáp án đúng cho phép tính.',
  },
  symbol_hunt: {
    id: 'symbol_hunt',
    label: 'Tìm biểu tượng',
    instruction: 'Nhớ biểu tượng rồi chọn đúng trong lưới.',
  },
  direction_dash: {
    id: 'direction_dash',
    label: 'Chỉ hướng',
    instruction: 'Nhớ hướng mũi tên rồi bấm nút tương ứng.',
  },
};

export const CREW_SYMBOL_POOL = ['⭐', '🔵', '🟢', '🟡', '🔴', '💜', '🔶', '⬜', '🔺', '💎', '🌙', '⚡'];

export const CREW_DIRECTIONS = ['up', 'down', 'left', 'right'];

export const CREW_DIRECTION_LABELS = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};
