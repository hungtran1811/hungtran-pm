export const QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS = [5, 9];
export const QUIZ_SESSION_NUMBERS = QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS;
export const QUIZ_ATTEMPT_STATUS_SUBMITTED = 'submitted';
export const QUIZ_ATTEMPT_STATUS_REOPENED = 'reopened';
export const QUIZ_CLASS_STATUS_IDLE = 'idle';
export const QUIZ_CLASS_STATUS_STARTED = 'started';
export const QUIZ_QUESTION_LIMIT = 10;
export const QUIZ_MODE_OFFICIAL = 'official_quiz';
export const QUIZ_MODE_PRACTICE = 'practice_quiz';
export const QUIZ_MODES = [QUIZ_MODE_OFFICIAL];
export const QUIZ_QUESTION_TYPE_SINGLE_CHOICE = 'single_choice';
export const QUIZ_QUESTION_TYPE_FILL_BLANK = 'fill_blank';
export const QUIZ_QUESTION_TYPES = [
  QUIZ_QUESTION_TYPE_SINGLE_CHOICE,
  QUIZ_QUESTION_TYPE_FILL_BLANK,
];
export const QUIZ_DIFFICULTY_EASY = 'easy';
export const QUIZ_DIFFICULTY_MEDIUM = 'medium';
export const QUIZ_DIFFICULTY_HARD = 'hard';
export const QUIZ_DIFFICULTIES = [
  QUIZ_DIFFICULTY_EASY,
  QUIZ_DIFFICULTY_MEDIUM,
  QUIZ_DIFFICULTY_HARD,
];
export const QUIZ_DEFAULT_PICK_POLICY = {
  [QUIZ_DIFFICULTY_EASY]: 4,
  [QUIZ_DIFFICULTY_MEDIUM]: 4,
  [QUIZ_DIFFICULTY_HARD]: 2,
};

function coerceText(value) {
  return String(value ?? '').trim();
}

function coerceArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'y', 'co', 'có'].includes(normalizedValue)) {
      return true;
    }

    if (['false', '0', 'no', 'n', 'khong', 'không'].includes(normalizedValue)) {
      return false;
    }
  }

  return fallback;
}

function normalizeQuestionType(value) {
  const normalizedValue = coerceText(value).toLowerCase();

  if (
    normalizedValue === QUIZ_QUESTION_TYPE_FILL_BLANK ||
    normalizedValue === 'fill-blank' ||
    normalizedValue === 'blank' ||
    normalizedValue === 'dien_khuyet' ||
    normalizedValue === 'điền_khuyết'
  ) {
    return QUIZ_QUESTION_TYPE_FILL_BLANK;
  }

  return QUIZ_QUESTION_TYPE_SINGLE_CHOICE;
}

export function normalizeQuizMode() {
  return QUIZ_MODE_OFFICIAL;
}

export function isPracticeQuizMode() {
  return false;
}

export function isOfficialQuizMode() {
  return true;
}

export function getQuizModeLabel() {
  return 'Kiểm tra chính thức';
}

export function normalizeQuizDifficulty(value = QUIZ_DIFFICULTY_MEDIUM) {
  const normalizedValue = coerceText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (
    normalizedValue === QUIZ_DIFFICULTY_EASY ||
    normalizedValue === 'de' ||
    normalizedValue === 'easy'
  ) {
    return QUIZ_DIFFICULTY_EASY;
  }

  if (
    normalizedValue === QUIZ_DIFFICULTY_HARD ||
    normalizedValue === 'kho' ||
    normalizedValue === 'hard'
  ) {
    return QUIZ_DIFFICULTY_HARD;
  }

  return QUIZ_DIFFICULTY_MEDIUM;
}

export function getQuizDifficultyLabel(value = QUIZ_DIFFICULTY_MEDIUM) {
  const difficulty = normalizeQuizDifficulty(value);

  if (difficulty === QUIZ_DIFFICULTY_EASY) {
    return 'Dễ';
  }

  if (difficulty === QUIZ_DIFFICULTY_HARD) {
    return 'Khó';
  }

  return 'Trung bình';
}

export function normalizeQuestionPickPolicy(value = {}) {
  const source = value && typeof value === 'object' ? value : {};

  return QUIZ_DIFFICULTIES.reduce((result, difficulty) => {
    const rawValue = source[difficulty] ?? QUIZ_DEFAULT_PICK_POLICY[difficulty];
    const numericValue = Number(rawValue);
    result[difficulty] = Number.isFinite(numericValue) && numericValue >= 0
      ? Math.floor(numericValue)
      : QUIZ_DEFAULT_PICK_POLICY[difficulty];
    return result;
  }, {});
}

export function getQuestionPickPolicyTotal(policy = QUIZ_DEFAULT_PICK_POLICY) {
  const normalizedPolicy = normalizeQuestionPickPolicy(policy);
  return QUIZ_DIFFICULTIES.reduce((total, difficulty) => total + normalizedPolicy[difficulty], 0);
}

export function getQuizDifficultyCounts(questions = []) {
  const initialCounts = QUIZ_DIFFICULTIES.reduce((result, difficulty) => {
    result[difficulty] = 0;
    return result;
  }, {});

  return coerceArray(questions).reduce((result, question) => {
    const difficulty = normalizeQuizDifficulty(question?.difficulty);
    result[difficulty] = (result[difficulty] || 0) + 1;
    return result;
  }, initialCounts);
}

export function getQuizReadiness(config = {}) {
  const policy = normalizeQuestionPickPolicy(config.questionPickPolicy);
  const counts = getQuizDifficultyCounts(config.questions || []);
  const missing = QUIZ_DIFFICULTIES.reduce((result, difficulty) => {
    const required = Number(policy[difficulty] || 0);
    const available = Number(counts[difficulty] || 0);

    if (available < required) {
      result[difficulty] = required - available;
    }

    return result;
  }, {});

  return {
    isReady: Object.keys(missing).length === 0,
    counts,
    missing,
    policy,
    requiredQuestionCount: getQuestionPickPolicyTotal(policy),
  };
}

export function formatQuizReadinessRequirement(readiness = {}) {
  const missing = readiness.missing || {};
  const missingParts = QUIZ_DIFFICULTIES
    .filter((difficulty) => Number(missing[difficulty] || 0) > 0)
    .map((difficulty) => `${missing[difficulty]} câu ${getQuizDifficultyLabel(difficulty).toLowerCase()}`);

  return missingParts.length
    ? `Còn thiếu ${missingParts.join(', ')}.`
    : 'Ngân hàng câu hỏi đã đủ tỉ lệ 4 dễ, 4 trung bình, 2 khó.';
}

function normalizeOptionId(value, fallbackPrefix, order) {
  return coerceText(value) || createQuizItemId(`${fallbackPrefix}-${order}`);
}

function normalizeBlankAnswerValue(value, caseSensitive = false) {
  const normalizedValue = coerceText(value).replace(/\s+/g, ' ');

  if (!normalizedValue) {
    return '';
  }

  return caseSensitive ? normalizedValue : normalizedValue.toLocaleLowerCase('vi');
}

function normalizeAcceptedAnswers(values = [], caseSensitive = false) {
  const seen = new Set();

  return coerceArray(values).reduce((result, value) => {
    const textValue = coerceText(value).replace(/\s+/g, ' ');
    const comparableValue = normalizeBlankAnswerValue(textValue, caseSensitive);

    if (!textValue || seen.has(comparableValue)) {
      return result;
    }

    seen.add(comparableValue);
    result.push(textValue);
    return result;
  }, []);
}

function hashSeed(value) {
  let hash = 2166136261;
  const text = String(value ?? '');

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seedValue) {
  let seed = hashSeed(seedValue) || 1;

  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleBySeed(items, seedValue) {
  const output = [...items];
  const random = createSeededRandom(seedValue);

  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }

  return output;
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

export function getQuizQuestionLimit(quiz = null) {
  const policyTotal = getQuestionPickPolicyTotal(quiz?.questionPickPolicy);
  return Math.min(policyTotal || QUIZ_QUESTION_LIMIT, coerceArray(quiz?.questions).length);
}

export function isQuizStartedForClass(classInfo, sessionNumber = 0) {
  return (
    String(classInfo?.quizStatus || QUIZ_CLASS_STATUS_IDLE).trim().toLowerCase() === QUIZ_CLASS_STATUS_STARTED &&
    Number(classInfo?.activeQuizSessionNumber || 0) === Number(sessionNumber || 0)
  );
}

export function getQuizQuestionTypeLabel(questionType = QUIZ_QUESTION_TYPE_SINGLE_CHOICE) {
  return normalizeQuestionType(questionType) === QUIZ_QUESTION_TYPE_FILL_BLANK
    ? 'Điền vào chỗ trống'
    : 'Trắc nghiệm 1 đáp án';
}

export function isFillBlankQuestion(question = {}) {
  return normalizeQuestionType(question?.type) === QUIZ_QUESTION_TYPE_FILL_BLANK;
}

export function isQuizQuestionAnswered(question = {}, answerValue = '') {
  if (isFillBlankQuestion(question)) {
    return coerceText(answerValue).length > 0;
  }

  const selectedOptionId = coerceText(answerValue);
  return coerceArray(question?.options).some((option) => option.id === selectedOptionId);
}

export function isQuizBlankAnswerCorrect(question = {}, answerValue = '') {
  if (!isFillBlankQuestion(question)) {
    return false;
  }

  const caseSensitive = normalizeBoolean(question?.caseSensitive, false);
  const normalizedAnswer = normalizeBlankAnswerValue(answerValue, caseSensitive);

  if (!normalizedAnswer) {
    return false;
  }

  return normalizeAcceptedAnswers(question?.acceptedAnswers || [], caseSensitive).some(
    (acceptedAnswer) => normalizeBlankAnswerValue(acceptedAnswer, caseSensitive) === normalizedAnswer,
  );
}

export function sortQuizOptions(options = []) {
  return [...options].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.text.localeCompare(right.text, 'vi');
  });
}

export function sortQuizQuestions(questions = []) {
  return [...questions].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.prompt.localeCompare(right.prompt, 'vi');
  });
}

export function normalizeQuizOptionRecord(input = {}, fallbackId = 'quiz-option', order = 1) {
  if (!input || typeof input !== 'object') {
    return {
      id: normalizeOptionId('', fallbackId, order),
      text: '',
      order: Math.max(1, Number(order || 1)),
    };
  }

  return {
    id: normalizeOptionId(input.id, fallbackId, order),
    text: coerceText(input.text),
    order: Math.max(1, Number(input.order || order || 1)),
  };
}

export function normalizeQuizQuestionRecord(input = {}, fallbackId = 'quiz-question', order = 1) {
  const normalizedType = normalizeQuestionType(input.type);
  const caseSensitive = normalizeBoolean(input.caseSensitive, false);
  const normalizedOptions =
    normalizedType === QUIZ_QUESTION_TYPE_SINGLE_CHOICE
      ? sortQuizOptions(
          coerceArray(input.options)
            .map((option, index) => normalizeQuizOptionRecord(option, `${fallbackId}-option`, index + 1))
            .map((option, index) => ({
              ...option,
              order: index + 1,
            })),
        )
      : [];
  const correctOptionId = coerceText(input.correctOptionId);
  const acceptedAnswers = normalizeAcceptedAnswers(input.acceptedAnswers || input.answers || [], caseSensitive);

  return {
    id: coerceText(input.id) || createQuizItemId(fallbackId),
    type: normalizedType,
    difficulty: normalizeQuizDifficulty(input.difficulty),
    prompt: coerceText(input.prompt),
    imageUrl: coerceText(input.imageUrl),
    imageAlt: coerceText(input.imageAlt),
    blankPlaceholder: coerceText(input.blankPlaceholder || input.placeholder),
    caseSensitive,
    acceptedAnswers: normalizedType === QUIZ_QUESTION_TYPE_FILL_BLANK ? acceptedAnswers : [],
    order: Math.max(1, Number(input.order || order || 1)),
    options: normalizedOptions,
    correctOptionId:
      normalizedType === QUIZ_QUESTION_TYPE_SINGLE_CHOICE
        ? normalizedOptions.some((option) => option.id === correctOptionId)
          ? correctOptionId
          : normalizedOptions[0]?.id || ''
        : '',
  };
}

export function normalizeQuizConfigRecord(
  input = {},
  fallbackSessionNumber = QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS[0],
  fallbackScope = {},
) {
  const normalizedSessionNumber = Math.max(
    1,
    Number(input.sessionNumber || fallbackSessionNumber || QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS[0]),
  );
  const scope = getQuizBankScope(input, fallbackScope);
  const questionPickPolicy = normalizeQuestionPickPolicy(input.questionPickPolicy);

  return {
    subject: scope.subject,
    level: scope.level,
    subjectKey: scope.subjectKey,
    levelKey: scope.levelKey,
    bankId: input.bankId || buildQuizBankId(scope.subject, scope.level, normalizedSessionNumber),
    sessionNumber: normalizedSessionNumber,
    quizMode: QUIZ_MODE_OFFICIAL,
    questionPickPolicy,
    title: coerceText(input.title),
    description: coerceText(input.description),
    questions: sortQuizQuestions(
      coerceArray(input.questions)
        .map((question, index) => normalizeQuizQuestionRecord(question, 'quiz-question', index + 1))
        .map((question, index) => ({
          ...question,
          order: index + 1,
        })),
    ),
  };
}

export function validateQuizConfigRecord(config, { requireReady = false } = {}) {
  if (!Number.isFinite(Number(config?.sessionNumber)) || Number(config?.sessionNumber) < 1) {
    throw new Error('Buổi áp dụng của bài kiểm tra không hợp lệ.');
  }

  if (!coerceText(config?.title)) {
    throw new Error('Tiêu đề bài kiểm tra không được để trống.');
  }

  const questions = coerceArray(config?.questions);

  if (questions.length === 0) {
    throw new Error('Hãy thêm ít nhất một câu hỏi trắc nghiệm.');
  }

  questions.forEach((question, questionIndex) => {
    if (!coerceText(question?.prompt)) {
      throw new Error(`Câu ${questionIndex + 1} chưa có nội dung câu hỏi.`);
    }

    if (isFillBlankQuestion(question)) {
      const acceptedAnswers = normalizeAcceptedAnswers(question.acceptedAnswers || [], question.caseSensitive);

      if (acceptedAnswers.length === 0) {
        throw new Error(`Câu ${questionIndex + 1} cần ít nhất 1 đáp án đúng cho dạng điền vào chỗ trống.`);
      }

      return;
    }

    const options = coerceArray(question?.options).filter((option) => coerceText(option?.text));

    if (options.length < 2) {
      throw new Error(`Câu ${questionIndex + 1} cần ít nhất 2 đáp án lựa chọn.`);
    }

    if (!options.some((option) => option.id === question.correctOptionId)) {
      throw new Error(`Câu ${questionIndex + 1} cần chọn một đáp án đúng.`);
    }
  });

  if (requireReady) {
    const readiness = getQuizReadiness(config);

    if (!readiness.isReady) {
      throw new Error(formatQuizReadinessRequirement(readiness));
    }
  }
}

export function toPublicQuizConfig(config = {}) {
  const normalizedConfig = normalizeQuizConfigRecord(config, config.sessionNumber, config);

  return {
    subject: normalizedConfig.subject,
    level: normalizedConfig.level,
    subjectKey: normalizedConfig.subjectKey,
    levelKey: normalizedConfig.levelKey,
    bankId: normalizedConfig.bankId,
    sessionNumber: Number(normalizedConfig.sessionNumber || 0),
    quizMode: QUIZ_MODE_OFFICIAL,
    title: coerceText(normalizedConfig.title),
    description: coerceText(normalizedConfig.description),
    questionPickPolicy: normalizeQuestionPickPolicy(normalizedConfig.questionPickPolicy),
    questionCount: coerceArray(normalizedConfig.questions).length,
    questions: sortQuizQuestions(normalizedConfig.questions || []).map((question) => ({
      id: coerceText(question.id),
      type: normalizeQuestionType(question.type),
      difficulty: normalizeQuizDifficulty(question.difficulty),
      prompt: coerceText(question.prompt),
      imageUrl: coerceText(question.imageUrl),
      imageAlt: coerceText(question.imageAlt),
      blankPlaceholder: coerceText(question.blankPlaceholder),
      order: Math.max(1, Number(question.order || 1)),
      options:
        normalizeQuestionType(question.type) === QUIZ_QUESTION_TYPE_SINGLE_CHOICE
          ? sortQuizOptions(question.options || []).map((option) => ({
              id: coerceText(option.id),
              text: coerceText(option.text),
              order: Math.max(1, Number(option.order || 1)),
            }))
          : [],
    })),
  };
}

function selectQuestionsByPolicy(questions, policy, baseSeed) {
  const normalizedPolicy = normalizeQuestionPickPolicy(policy);
  const selectedQuestions = QUIZ_DIFFICULTIES.flatMap((difficulty) => {
    const pool = questions.filter((question) => normalizeQuizDifficulty(question.difficulty) === difficulty);
    return shuffleBySeed(pool, `${baseSeed}__${difficulty}`).slice(0, normalizedPolicy[difficulty]);
  });

  return shuffleBySeed(selectedQuestions, `${baseSeed}__final`);
}

export function buildStudentQuizVariant(
  quiz = {},
  {
    classCode = '',
    studentId = '',
    sessionNumber = 0,
    questionLimit = QUIZ_QUESTION_LIMIT,
  } = {},
) {
  const normalizedClassCode = coerceText(classCode).toUpperCase();
  const normalizedStudentId = coerceText(studentId);
  const normalizedSessionNumber = Number(sessionNumber || quiz?.sessionNumber || 0);
  const normalizedQuiz = toPublicQuizConfig(quiz);
  const policy = normalizeQuestionPickPolicy(normalizedQuiz.questionPickPolicy);
  const policyQuestionCount = getQuestionPickPolicyTotal(policy);
  const baseSeed = `${normalizedClassCode}__${normalizedStudentId}__${normalizedSessionNumber}`;
  const usePolicy = Number(questionLimit || QUIZ_QUESTION_LIMIT) >= policyQuestionCount;
  const selectedQuestionSource = usePolicy
    ? selectQuestionsByPolicy(normalizedQuiz.questions, policy, `${baseSeed}__questions`)
    : shuffleBySeed(normalizedQuiz.questions, `${baseSeed}__questions`).slice(
        0,
        Math.max(1, Number(questionLimit || QUIZ_QUESTION_LIMIT)),
      );
  const selectedQuestions = selectedQuestionSource.map((question, questionIndex) => ({
    ...question,
    order: questionIndex + 1,
    options:
      normalizeQuestionType(question.type) === QUIZ_QUESTION_TYPE_SINGLE_CHOICE
        ? shuffleBySeed(sortQuizOptions(question.options || []), `${baseSeed}__${question.id}__options`).map(
            (option, optionIndex) => ({
              ...option,
              order: optionIndex + 1,
            }),
          )
        : [],
  }));

  return {
    subject: normalizedQuiz.subject,
    level: normalizedQuiz.level,
    bankId: normalizedQuiz.bankId,
    sessionNumber: normalizedSessionNumber,
    quizMode: QUIZ_MODE_OFFICIAL,
    title: normalizedQuiz.title,
    description: normalizedQuiz.description,
    questionPickPolicy: policy,
    questionCount: selectedQuestions.length,
    poolQuestionCount: normalizedQuiz.questions.length,
    questionIds: selectedQuestions.map((question) => question.id),
    questions: selectedQuestions,
  };
}

export function validateQuizAnswerMap(quiz, answers = {}) {
  const questions = coerceArray(quiz?.questions);
  const errors = {};

  questions.forEach((question) => {
    const answerValue = answers[question.id];

    if (!isQuizQuestionAnswered(question, answerValue)) {
      errors[question.id] = isFillBlankQuestion(question)
        ? 'Hãy nhập câu trả lời cho câu hỏi này.'
        : 'Hãy chọn một đáp án cho câu hỏi này.';
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
