'use strict';

const STAGES = [
  'Ý tưởng',
  'Lên kế hoạch',
  'Thiết kế',
  'Xây dựng chức năng',
  'Kiểm thử',
  'Hoàn thiện',
  'Thuyết trình / Nộp sản phẩm',
];

const STATUSES = [
  'Chưa bắt đầu',
  'Đang làm',
  'Cần hỗ trợ',
  'Gần hoàn thành',
  'Hoàn thành',
];

function normalizeText(value) {
  return String(value ?? '').trim();
}

function validateReportPayload(payload) {
  const classCode = normalizeText(payload?.classCode).toUpperCase();
  const studentId = normalizeText(payload?.studentId);
  const doneToday = normalizeText(payload?.doneToday);
  const nextGoal = normalizeText(payload?.nextGoal);
  const difficulties = normalizeText(payload?.difficulties);
  const stage = normalizeText(payload?.stage);
  const status = normalizeText(payload?.status);
  const progressPercent = Number(payload?.progressPercent);

  const errors = [];

  if (!classCode) {
    errors.push('Lớp học không hợp lệ.');
  }

  if (!studentId) {
    errors.push('Học sinh không hợp lệ.');
  }

  if (!doneToday || doneToday.length < 10) {
    errors.push('Nội dung "Đã làm được" cần tối thiểu 10 ký tự.');
  }

  if (!nextGoal || nextGoal.length < 10) {
    errors.push('Nội dung "Mục tiêu buổi tới" cần tối thiểu 10 ký tự.');
  }

  if (!STAGES.includes(stage)) {
    errors.push('Giai đoạn hiện tại không hợp lệ.');
  }

  if (!STATUSES.includes(status)) {
    errors.push('Trạng thái hiện tại không hợp lệ.');
  }

  if (!Number.isFinite(progressPercent) || progressPercent < 0 || progressPercent > 100) {
    errors.push('Phần trăm tiến độ phải nằm trong khoảng 0-100.');
  }

  if (status === 'Cần hỗ trợ' && difficulties.length < 15) {
    errors.push('Khi cần hỗ trợ, học sinh phải mô tả khó khăn tối thiểu 15 ký tự.');
  }

  if (status === 'Hoàn thành' && progressPercent !== 100) {
    errors.push('Trạng thái hoàn thành chỉ hợp lệ khi tiến độ bằng 100%.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    value: {
      classCode,
      studentId,
      doneToday,
      nextGoal,
      difficulties,
      progressPercent,
      stage,
      status,
    },
  };
}

module.exports = {
  validateReportPayload,
};
