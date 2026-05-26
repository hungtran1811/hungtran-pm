function coerceText(value) {
  return String(value ?? '').trim();
}

function slugifyQuizScopePart(value, fallback = 'unknown') {
  const slug = coerceText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
}

export function createQuizItemId(prefix = 'quiz-item') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildQuizConfigDocId(sessionNumber) {
  return `session-${Number(sessionNumber || 0)}`;
}

export function buildQuizBankId(subject = '', level = '', sessionNumber = 0) {
  return `${slugifyQuizScopePart(subject, 'subject')}__${slugifyQuizScopePart(level, 'level')}__${buildQuizConfigDocId(sessionNumber)}`;
}

export function getQuizBankScope(input = {}, fallback = {}) {
  const subject = coerceText(input.subject || fallback.subject);
  const level = coerceText(input.level || fallback.level);

  return {
    subject,
    level,
    subjectKey: slugifyQuizScopePart(subject, ''),
    levelKey: slugifyQuizScopePart(level, ''),
  };
}

export function buildQuizAttemptId(classCode, studentId, sessionNumber) {
  const normalizedClassCode = coerceText(classCode).toUpperCase();
  const normalizedStudentId = coerceText(studentId);
  const normalizedSessionNumber = Number(sessionNumber || 0);
  return `${normalizedClassCode}__${normalizedStudentId}__${normalizedSessionNumber}`;
}

export function buildQuizAttemptSubmissionId(attemptId, submissionNumber) {
  const normalizedAttemptId = coerceText(attemptId);
  const normalizedSubmissionNumber = Math.max(1, Number(submissionNumber || 1));
  return `${normalizedAttemptId}__submission__${normalizedSubmissionNumber}`;
}

export function buildQuizLiveAttemptId(attemptId, submissionNumber) {
  const normalizedAttemptId = coerceText(attemptId);
  const normalizedSubmissionNumber = Math.max(1, Number(submissionNumber || 1));
  return `${normalizedAttemptId}__live__${normalizedSubmissionNumber}`;
}
