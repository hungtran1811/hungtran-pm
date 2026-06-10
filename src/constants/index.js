export const STAGES = [
  'Phân tích vấn đề',
  'Thiết kế giải pháp',
  'Xây dựng sản phẩm',
  'Kiểm thử sản phẩm',
  'Bảo trì & cải tiến',
];

export const DEFAULT_STAGE = STAGES[0];

export const STATUSES = [
  'Chưa bắt đầu',
  'Đang làm',
  'Cần hỗ trợ',
  'Gần hoàn thành',
  'Hoàn thành',
];

export const DEFAULT_STATUS = STATUSES[0];

export const CLASS_STATUSES = [
  { value: 'active', label: 'Đang vận hành' },
  { value: 'completed', label: 'Đã hoàn thành' },
  { value: 'archived', label: 'Lưu trữ' },
];

export const CLASS_STATUS_LABELS = CLASS_STATUSES.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

export const CURRICULUM_PHASES = [
  { value: 'learning', label: 'Học kiến thức' },
  { value: 'final', label: 'Làm sản phẩm cuối khóa' },
];

export const CURRICULUM_PHASE_LABELS = CURRICULUM_PHASES.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

export const CURRICULUM_FINAL_MODES = [
  { value: 'project', label: 'Sản phẩm cuối khóa' },
  { value: 'exam', label: 'Bài kiểm tra' },
];

export const CURRICULUM_FINAL_MODE_LABELS = CURRICULUM_FINAL_MODES.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

// Visual tone keyed by status, used for badges across the app.
export const STATUS_TONES = {
  'Chưa bắt đầu': 'slate',
  'Đang làm': 'blue',
  'Cần hỗ trợ': 'red',
  'Gần hoàn thành': 'amber',
  'Hoàn thành': 'green',
};

/** Buổi học ưu tiên không gian làm bài kiểm tra — ẩn form phản hồi */
export const QUIZ_FOCUS_SESSIONS = [5, 9];

export const UNDERSTANDING_LEVELS = [
  { value: 1, label: '1 - Chưa hiểu' },
  { value: 2, label: '2 - Hiểu ít' },
  { value: 3, label: '3 - Bình thường' },
  { value: 4, label: '4 - Hiểu khá rõ' },
  { value: 5, label: '5 - Hiểu rất rõ' },
];
