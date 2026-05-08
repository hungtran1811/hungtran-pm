'use strict';

const QUIZ_SESSION_NUMBERS = [5, 9];
const QUIZ_ATTEMPT_STATUS_SUBMITTED = 'submitted';
const QUIZ_ATTEMPT_STATUS_REOPENED = 'reopened';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeAnswerMap(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  return Object.entries(input).reduce((result, [questionId, optionId]) => {
    const normalizedQuestionId = normalizeText(questionId);

    if (normalizedQuestionId) {
      result[normalizedQuestionId] = normalizeText(optionId);
    }

    return result;
  }, {});
}

function normalizeQuizContextPayload(payload) {
  return {
    classCode: normalizeText(payload?.classCode).toUpperCase(),
    studentId: normalizeText(payload?.studentId),
  };
}

function validateQuizSubmissionPayload(payload) {
  const classCode = normalizeText(payload?.classCode).toUpperCase();
  const studentId = normalizeText(payload?.studentId);
  const answers = normalizeAnswerMap(payload?.answers);
  const errors = [];

  if (!classCode) {
    errors.push('Lop hoc khong hop le.');
  }

  if (!studentId) {
    errors.push('Hoc sinh khong hop le.');
  }

  if (Object.keys(answers).length === 0) {
    errors.push('Can chon dap an truoc khi nop bai.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    value: {
      classCode,
      studentId,
      answers,
    },
  };
}

module.exports = {
  QUIZ_ATTEMPT_STATUS_REOPENED,
  QUIZ_ATTEMPT_STATUS_SUBMITTED,
  QUIZ_SESSION_NUMBERS,
  normalizeQuizContextPayload,
  validateQuizSubmissionPayload,
};
