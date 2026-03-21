import { VALIDATION_MESSAGES } from '../constants/messages.js';
import { STAGES } from '../constants/stages.js';
import { STATUSES } from '../constants/statuses.js';

function normalizeText(value) {
  return String(value ?? '').trim();
}

export function validateReportForm(values) {
  const errors = {};
  const doneToday = normalizeText(values.doneToday);
  const nextGoal = normalizeText(values.nextGoal);
  const difficulties = normalizeText(values.difficulties);
  const stage = normalizeText(values.stage);
  const status = normalizeText(values.status);
  const progressPercent = Number(values.progressPercent);

  if (!values.classCode) {
    errors.classCode = VALIDATION_MESSAGES.classRequired;
  }

  if (!values.studentId) {
    errors.studentId = VALIDATION_MESSAGES.studentRequired;
  }

  if (doneToday.length < 10) {
    errors.doneToday = VALIDATION_MESSAGES.doneTodayMinLength;
  }

  if (nextGoal.length < 10) {
    errors.nextGoal = VALIDATION_MESSAGES.nextGoalMinLength;
  }

  if (!STAGES.includes(stage)) {
    errors.stage = VALIDATION_MESSAGES.stageInvalid;
  }

  if (!STATUSES.includes(status)) {
    errors.status = VALIDATION_MESSAGES.statusInvalid;
  }

  if (!Number.isFinite(progressPercent) || progressPercent < 0 || progressPercent > 100) {
    errors.progressPercent = VALIDATION_MESSAGES.progressRange;
  }

  if (status === 'Cần hỗ trợ' && difficulties.length < 15) {
    errors.difficulties = VALIDATION_MESSAGES.supportNeedsDetails;
  }

  if (status === 'Hoàn thành' && progressPercent !== 100) {
    errors.progressPercent = VALIDATION_MESSAGES.completedNeeds100;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateClassForm(values) {
  const errors = {};

  if (normalizeText(values.classCode).length < 3) {
    errors.classCode = VALIDATION_MESSAGES.classCodeMinLength;
  }

  if (normalizeText(values.className).length < 3) {
    errors.className = VALIDATION_MESSAGES.classNameMinLength;
  }

  if (values.startDate && values.endDate && values.endDate < values.startDate) {
    errors.endDate = VALIDATION_MESSAGES.invalidDateRange;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateStudentForm(values) {
  const errors = {};

  if (normalizeText(values.fullName).length < 3) {
    errors.fullName = VALIDATION_MESSAGES.fullNameMinLength;
  }

  if (!values.classId) {
    errors.classId = VALIDATION_MESSAGES.classRequired;
  }

  if (normalizeText(values.projectName).length < 3) {
    errors.projectName = VALIDATION_MESSAGES.projectNameMinLength;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
