import { toDate } from '../utils/date.js';
import {
  normalizeQuizConfigRecord,
  normalizeQuizDifficulty,
  normalizeQuizMode,
  QUIZ_ATTEMPT_STATUS_REOPENED,
  QUIZ_ATTEMPT_STATUS_SUBMITTED,
  QUIZ_MODE_OFFICIAL,
} from '../utils/quiz.js';

function normalizeGradedQuestionRecord(input = {}, order = 1) {
  return {
    questionId: String(input.questionId ?? '').trim(),
    questionType: String(input.questionType ?? 'single_choice').trim(),
    difficulty: normalizeQuizDifficulty(input.difficulty),
    prompt: String(input.prompt ?? '').trim(),
    imageUrl: String(input.imageUrl ?? '').trim(),
    imageAlt: String(input.imageAlt ?? '').trim(),
    blankPlaceholder: String(input.blankPlaceholder ?? '').trim(),
    order: Math.max(1, Number(input.order || order || 1)),
    selectedOptionId: String(input.selectedOptionId ?? '').trim(),
    selectedOptionText: String(input.selectedOptionText ?? '').trim(),
    correctOptionId: String(input.correctOptionId ?? '').trim(),
    correctOptionText: String(input.correctOptionText ?? '').trim(),
    isCorrect: Boolean(input.isCorrect),
  };
}

function normalizeQuizAttemptSubmissionRecord(input = {}, order = 1) {
  return {
    id: String(input.id ?? '').trim(),
    attemptId: String(input.attemptId ?? '').trim(),
    classCode: String(input.classCode ?? '').trim(),
    studentId: String(input.studentId ?? '').trim(),
    subject: String(input.subject ?? '').trim(),
    level: String(input.level ?? '').trim(),
    bankId: String(input.bankId ?? '').trim(),
    sessionNumber: Number(input.sessionNumber ?? 0),
    quizMode: normalizeQuizMode(input.quizMode || QUIZ_MODE_OFFICIAL),
    submissionNumber: Math.max(1, Number(input.submissionNumber ?? order ?? 1)),
    questionCount: Number(input.questionCount ?? 0),
    correctCount: Number(input.correctCount ?? 0),
    score: Number(input.score ?? 0),
    questionIds: Array.isArray(input.questionIds)
      ? input.questionIds.map((questionId) => String(questionId ?? '').trim()).filter(Boolean)
      : [],
    answers: input.answers && typeof input.answers === 'object' ? input.answers : {},
    gradedQuestions: Array.isArray(input.gradedQuestions)
      ? input.gradedQuestions.map((item, index) => normalizeGradedQuestionRecord(item, index + 1))
      : [],
    gradingReady: Array.isArray(input.gradedQuestions) && input.gradedQuestions.length > 0,
    submittedAt: toDate(input.submittedAt),
    createdAt: toDate(input.createdAt),
  };
}

export function toQuizConfigModelFromData(id, data = {}) {
  const normalizedConfig = normalizeQuizConfigRecord(data, data.sessionNumber, data);

  return {
    id,
    programId: String(data.programId ?? '').trim(),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    ...normalizedConfig,
  };
}

export function toQuizConfigModel(snapshot) {
  return toQuizConfigModelFromData(snapshot.id, snapshot.data());
}

export function toQuizAttemptModelFromData(id, data = {}) {
  return {
    id,
    classCode: data.classCode ?? '',
    className: data.className ?? '',
    studentId: data.studentId ?? '',
    studentName: data.studentName ?? '',
    curriculumProgramId: data.curriculumProgramId ?? '',
    subject: String(data.subject ?? '').trim(),
    level: String(data.level ?? '').trim(),
    bankId: String(data.bankId ?? '').trim(),
    sessionNumber: Number(data.sessionNumber ?? 0),
    quizMode: normalizeQuizMode(data.quizMode || QUIZ_MODE_OFFICIAL),
    quizTitle: data.quizTitle ?? '',
    questionCount: Number(data.questionCount ?? 0),
    questionIds: Array.isArray(data.questionIds)
      ? data.questionIds.map((questionId) => String(questionId ?? '').trim()).filter(Boolean)
      : [],
    correctCount: Number(data.correctCount ?? 0),
    score: Number(data.score ?? 0),
    submissionCount: Math.max(0, Number(data.submissionCount ?? 0)),
    status:
      data.status === QUIZ_ATTEMPT_STATUS_REOPENED
        ? QUIZ_ATTEMPT_STATUS_REOPENED
        : QUIZ_ATTEMPT_STATUS_SUBMITTED,
    answers: data.answers && typeof data.answers === 'object' ? data.answers : {},
    gradedQuestions: Array.isArray(data.gradedQuestions)
      ? data.gradedQuestions.map((item, index) => normalizeGradedQuestionRecord(item, index + 1))
      : [],
    submittedAt: toDate(data.submittedAt),
    reopenedAt: toDate(data.reopenedAt),
    reopenedBy: data.reopenedBy ?? '',
    submissions: Array.isArray(data.submissions)
      ? data.submissions.map((item, index) => normalizeQuizAttemptSubmissionRecord(item, index + 1))
      : [],
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toQuizAttemptModel(snapshot) {
  return toQuizAttemptModelFromData(snapshot.id, snapshot.data());
}

export function toQuizAttemptSubmissionModelFromData(id, data = {}) {
  return normalizeQuizAttemptSubmissionRecord(
    {
      id,
      ...data,
    },
    data.submissionNumber,
  );
}

export function toQuizAttemptSubmissionModel(snapshot) {
  return toQuizAttemptSubmissionModelFromData(snapshot.id, snapshot.data());
}
