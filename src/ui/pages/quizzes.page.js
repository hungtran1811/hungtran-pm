import { subscribeClasses } from '../../services/classes.service.js';
import { subscribeCurriculumPrograms } from '../../services/curriculum.service.js';
import {
  getQuizAttemptsByClass,
  listQuizConfigs,
  reopenQuizAttempt,
  saveQuizConfig,
  setClassQuizStatus,
} from '../../services/quizzes.service.js';
import { isCloudinaryConfigured, uploadCurriculumLessonImage } from '../../services/cloudinary.service.js';
import { getAuthState } from '../../state/auth.store.js';
import { formatDateTime } from '../../utils/date.js';
import {
  getCurriculumActivityTypeLabel,
  getCurriculumSessionActivities,
  getCurriculumSessionActivity,
  isCurriculumQuizActivity,
} from '../../utils/curriculum-program.js';
import { escapeHtml, nl2br } from '../../utils/html.js';
import {
  parseQuizMarkdown,
  QUIZ_MARKDOWN_IMPORT_TEMPLATE,
  QUIZ_MARKDOWN_SAMPLE_SETS,
} from '../../utils/quiz-markdown.js';
import { buildAdminQuizPreviewPath } from '../../utils/route.js';
import {
  createQuizItemId,
  formatQuizReadinessRequirement,
  getQuizDifficultyCounts,
  getQuizDifficultyLabel,
  getQuizReadiness,
  getQuizQuestionTypeLabel,
  isFillBlankQuestion,
  isOfficialQuizMode,
  isQuizBlankAnswerCorrect,
  isQuizStartedForClass,
  normalizeQuizConfigRecord,
  QUIZ_ATTEMPT_STATUS_REOPENED,
  QUIZ_CLASS_STATUS_STARTED,
  QUIZ_DEFAULT_PICK_POLICY,
  QUIZ_DIFFICULTIES,
  QUIZ_DIFFICULTY_MEDIUM,
  QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS,
  QUIZ_MODE_OFFICIAL,
  QUIZ_QUESTION_LIMIT,
  QUIZ_QUESTION_TYPE_FILL_BLANK,
  QUIZ_QUESTION_TYPE_SINGLE_CHOICE,
  QUIZ_QUESTION_TYPES,
  validateQuizConfigRecord,
} from '../../utils/quiz.js';
import { renderAlert } from '../components/Alert.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { showToast } from '../components/ToastStack.js';

const QUIZ_ADMIN_UI_STORAGE_KEY = 'hungtranpm.quiz-admin.ui';

function getErrorMessage(error, fallback) {
  return error?.message || fallback;
}

function loadQuizAdminUiState() {
  try {
    const rawValue = window.sessionStorage.getItem(QUIZ_ADMIN_UI_STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
  } catch (_error) {
    return {};
  }
}

function persistQuizAdminUiState(state) {
  try {
    window.sessionStorage.setItem(
      QUIZ_ADMIN_UI_STORAGE_KEY,
      JSON.stringify({
        activeTab: state?.activeTab === 'operations' ? 'operations' : 'editor',
      }),
    );
  } catch (_error) {
    // Ignore storage failures and keep the page usable.
  }
}

function createEmptyQuizDraft(sessionNumber = QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS[0], program = null) {
  return normalizeQuizConfigRecord(
    {
      sessionNumber,
      quizMode: QUIZ_MODE_OFFICIAL,
      subject: program?.subject || '',
      level: program?.level || '',
      questionPickPolicy: QUIZ_DEFAULT_PICK_POLICY,
      title: `Kiểm tra trắc nghiệm buổi ${sessionNumber}`,
      description: '',
      questions: [],
    },
    sessionNumber,
    program || {},
  );
}

function createOptionDraft(order = 1) {
  return {
    id: createQuizItemId('quiz-option'),
    text: '',
    order,
  };
}

function createQuestionDraft(order = 1) {
  const firstOption = createOptionDraft(1);
  const secondOption = createOptionDraft(2);

  return {
    id: createQuizItemId('quiz-question'),
    type: QUIZ_QUESTION_TYPE_SINGLE_CHOICE,
    difficulty: QUIZ_DIFFICULTY_MEDIUM,
    prompt: '',
    imageUrl: '',
    imageAlt: '',
    blankPlaceholder: '',
    acceptedAnswers: [],
    caseSensitive: false,
    order,
    options: [firstOption, secondOption],
    correctOptionId: firstOption.id,
  };
}

function reindexOptions(options = []) {
  return options.map((option, index) => ({
    ...option,
    order: index + 1,
  }));
}

function ensureMinimumOptions(options = []) {
  const nextOptions = [...options];

  while (nextOptions.length < 2) {
    nextOptions.push(createOptionDraft(nextOptions.length + 1));
  }

  return reindexOptions(nextOptions);
}

function reindexQuestions(questions = []) {
  return questions.map((question, index) => ({
    ...question,
    order: index + 1,
    options: reindexOptions(question.options || []),
  }));
}

function parseAcceptedAnswersInput(value = '') {
  return String(value ?? '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringifyAcceptedAnswers(acceptedAnswers = []) {
  return Array.isArray(acceptedAnswers) ? acceptedAnswers.join('\n') : '';
}

function getQuizManageableClasses(classes = []) {
  return classes.filter((classItem) => classItem.status === 'active' && !classItem.hidden);
}

function getProgramSessionOptions(program) {
  if (!program) {
    return QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS.map((sessionNumber) => ({
      sessionNumber,
      activityType: QUIZ_MODE_OFFICIAL,
    }));
  }

  return getCurriculumSessionActivities(program);
}

function getClassProgram(selectedClass, programs = []) {
  return programs.find((program) => program.id === selectedClass?.curriculumProgramId) || null;
}

function getClassQuizActivity(selectedClass, programs = []) {
  const program = getClassProgram(selectedClass, programs);
  const sessionNumber = Number(selectedClass?.curriculumCurrentSession || 0);
  return program ? getCurriculumSessionActivity(program, sessionNumber) : null;
}

function renderQuestionImagePreview(imageUrl = '', imageAlt = '', prompt = '') {
  if (!String(imageUrl || '').trim()) {
    return '';
  }

  return `
    <figure class="quiz-question-media quiz-question-media--admin">
      <img
        src="${escapeHtml(imageUrl)}"
        alt="${escapeHtml(imageAlt || prompt || 'Minh họa câu hỏi')}"
        class="quiz-question-media__image"
        loading="lazy"
      />
    </figure>
  `;
}

function mergeImportedQuizDraft(currentDraft, importedDraft, sessionNumber, program = null) {
  const currentQuestions = Array.isArray(currentDraft?.questions) ? currentDraft.questions : [];
  const importedQuestions = Array.isArray(importedDraft?.questions) ? importedDraft.questions : [];
  const currentTitle = String(currentDraft?.title || '').trim();
  const currentDescription = String(currentDraft?.description || '').trim();
  const defaultTitle = String(createEmptyQuizDraft(sessionNumber, program).title || '').trim();

  return normalizeQuizConfigRecord(
    {
      sessionNumber,
      quizMode: QUIZ_MODE_OFFICIAL,
      subject: program?.subject || currentDraft?.subject || importedDraft?.subject || '',
      level: program?.level || currentDraft?.level || importedDraft?.level || '',
      questionPickPolicy: currentDraft?.questionPickPolicy || importedDraft?.questionPickPolicy || QUIZ_DEFAULT_PICK_POLICY,
      title: !currentTitle || (currentTitle === defaultTitle && currentQuestions.length === 0) ? importedDraft.title : currentTitle,
      description: currentDescription || importedDraft.description,
      questions: [...currentQuestions, ...importedQuestions],
    },
    sessionNumber,
    program || {},
  );
}

function hasAttemptRetakeAfterReopen(attempt) {
  if (!attempt?.reopenedAt || !attempt?.submittedAt) {
    return false;
  }

  const reopenedTime = attempt.reopenedAt instanceof Date ? attempt.reopenedAt.getTime() : 0;
  const submittedTime = attempt.submittedAt instanceof Date ? attempt.submittedAt.getTime() : 0;

  return submittedTime > reopenedTime && Number(attempt.submissionCount || 0) > 1;
}

function getAttemptStatusMeta(attempt) {
  if (!attempt) {
    return {
      label: 'Chưa rõ',
      badgeClass: 'text-bg-secondary',
      detail: '',
    };
  }

  if (attempt.status === QUIZ_ATTEMPT_STATUS_REOPENED) {
    return {
      label: 'Đang chờ làm lại',
      badgeClass: 'text-bg-warning text-dark',
      detail: 'Học sinh này đã được mở lại và có thể vào làm lại ngay bây giờ.',
    };
  }

  if (hasAttemptRetakeAfterReopen(attempt)) {
    return {
      label: 'Đã nộp lại',
      badgeClass: 'text-bg-info',
      detail: `Học sinh đã nộp lại sau khi được mở vào ${formatDateTime(attempt.submittedAt)}.`,
    };
  }

  return {
    label: 'Đã nộp',
    badgeClass: 'text-bg-success',
    detail:
      Number(attempt.submissionCount || 0) > 1
        ? `Học sinh đã nộp tổng cộng ${attempt.submissionCount} lần. Hệ thống đang lấy điểm cao nhất để hiển thị.`
        : 'Học sinh đã nộp bài và chưa được mở lại.',
  };
}

function getAttemptStatusBadge(attempt) {
  const statusMeta = getAttemptStatusMeta(attempt);
  return `<span class="badge ${statusMeta.badgeClass}">${escapeHtml(statusMeta.label)}</span>`;
}

function buildGradedQuestions(quizConfig, answers = {}, questionIds = []) {
  const questions = Array.isArray(quizConfig?.questions)
    ? [...quizConfig.questions].sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    : [];
  const selectedQuestionIds = Array.isArray(questionIds)
    ? questionIds.map((questionId) => String(questionId ?? '').trim()).filter(Boolean)
    : [];
  const orderedQuestions =
    selectedQuestionIds.length > 0
      ? selectedQuestionIds
          .map((questionId) => questions.find((question) => question.id === questionId) || null)
          .filter(Boolean)
      : questions;

  return orderedQuestions.map((question, index) => {
    const questionType = question.type || QUIZ_QUESTION_TYPE_SINGLE_CHOICE;
    const options = Array.isArray(question.options)
      ? [...question.options].sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
      : [];
    const rawAnswerValue = answers?.[question.id];
    const selectedOptionId = questionType === QUIZ_QUESTION_TYPE_SINGLE_CHOICE ? String(rawAnswerValue ?? '').trim() : '';
    const selectedOption = options.find((option) => option.id === selectedOptionId) || null;
    const correctOption = options.find((option) => option.id === question.correctOptionId) || null;
    const selectedTextAnswer = questionType === QUIZ_QUESTION_TYPE_FILL_BLANK ? String(rawAnswerValue ?? '').trim() : '';
    const acceptedAnswers = Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [];
    const isCorrect =
      questionType === QUIZ_QUESTION_TYPE_FILL_BLANK
        ? isQuizBlankAnswerCorrect(question, selectedTextAnswer)
        : Boolean(selectedOptionId) && selectedOptionId === correctOption?.id;

    return {
      questionId: question.id,
      questionType,
      difficulty: question.difficulty || QUIZ_DIFFICULTY_MEDIUM,
      prompt: question.prompt,
      imageUrl: question.imageUrl || '',
      imageAlt: question.imageAlt || '',
      blankPlaceholder: question.blankPlaceholder || '',
      order: Math.max(1, Number(question.order || index + 1)),
      selectedOptionId,
      selectedOptionText:
        questionType === QUIZ_QUESTION_TYPE_FILL_BLANK ? selectedTextAnswer : selectedOption?.text || '',
      correctOptionId: correctOption?.id || '',
      correctOptionText:
        questionType === QUIZ_QUESTION_TYPE_FILL_BLANK ? acceptedAnswers.join(', ') : correctOption?.text || '',
      isCorrect,
    };
  });
}

function buildGradedSubmission(quizConfig, submission = {}, fallbackQuestionCount = 0) {
  const gradedQuestions = buildGradedQuestions(quizConfig, submission.answers || {}, submission.questionIds || []);
  const questionCount = Number(submission.questionCount || fallbackQuestionCount || gradedQuestions.length || 0);
  const correctCount = gradedQuestions.filter((question) => question.isCorrect).length;

  return {
    ...submission,
    questionCount,
    correctCount,
    score: questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0,
    gradingReady: gradedQuestions.length > 0,
    gradedQuestions,
  };
}

function buildFallbackSubmissionFromAttempt(attempt) {
  if (!attempt) {
    return null;
  }

  return {
    submissionNumber: Math.max(1, Number(attempt.submissionCount || 1)),
    questionCount: Number(attempt.questionCount || 0),
    correctCount: Number(attempt.correctCount || 0),
    score: Number(attempt.score || 0),
    gradingReady: Boolean(attempt.gradingReady),
    gradedQuestions: Array.isArray(attempt.gradedQuestions) ? attempt.gradedQuestions : [],
    submittedAt: attempt.submittedAt || null,
  };
}

function pickBestGradedSubmission(submissions = []) {
  return [...submissions].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (right.correctCount !== left.correctCount) {
      return right.correctCount - left.correctCount;
    }

    if ((right.submissionNumber || 0) !== (left.submissionNumber || 0)) {
      return (right.submissionNumber || 0) - (left.submissionNumber || 0);
    }

    const leftTime = left.submittedAt instanceof Date ? left.submittedAt.getTime() : 0;
    const rightTime = right.submittedAt instanceof Date ? right.submittedAt.getTime() : 0;
    return rightTime - leftTime;
  })[0] || null;
}

function decorateAttempt(attempt, quizConfigs = []) {
  const quizConfig =
    quizConfigs.find((config) => Number(config.sessionNumber) === Number(attempt.sessionNumber || 0)) || null;

  if (!quizConfig) {
    const fallbackGradedQuestions = Array.isArray(attempt.gradedQuestions) ? attempt.gradedQuestions : [];
    const fallbackQuestionCount = Number(attempt.questionCount || fallbackGradedQuestions.length || 0);
    const fallbackCorrectCount = Number(attempt.correctCount || 0);
    const fallbackScore =
      fallbackQuestionCount > 0
        ? Math.round((fallbackCorrectCount / fallbackQuestionCount) * 100)
        : Number(attempt.score || 0);

    return {
      ...attempt,
      quizTitle: attempt.quizTitle || 'Bài kiểm tra',
      questionCount: fallbackQuestionCount,
      correctCount: fallbackCorrectCount,
      score: fallbackScore,
      gradingReady: fallbackGradedQuestions.length > 0,
      gradedQuestions: fallbackGradedQuestions,
    };
  }

  const gradedQuestions = buildGradedQuestions(quizConfig, attempt.answers || {}, attempt.questionIds || []);
  const questionCount = Number(attempt.questionCount || gradedQuestions.length || 0);
  const correctCount = gradedQuestions.filter((question) => question.isCorrect).length;

  return {
    ...attempt,
    quizTitle: attempt.quizTitle || quizConfig.title || 'Bài kiểm tra',
    questionCount,
    correctCount,
    score: questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0,
    gradingReady: gradedQuestions.length > 0,
    gradedQuestions,
  };
}

function decorateAttemptByBestScore(attempt, quizConfigs = []) {
  const baseAttempt = decorateAttempt(attempt, quizConfigs);
  const quizConfig =
    quizConfigs.find((config) => Number(config.sessionNumber) === Number(attempt.sessionNumber || 0)) || null;

  if (!quizConfig) {
    return {
      ...baseAttempt,
      bestSubmissionNumber: Number(attempt.submissionCount || 1),
      bestSubmittedAt: attempt.submittedAt || null,
    };
  }

  const rawSubmissions = Array.isArray(attempt.submissions) && attempt.submissions.length > 0
    ? attempt.submissions
    : [
        {
          submissionNumber: Number(attempt.submissionCount || 1),
          questionCount: Number(attempt.questionCount || 0),
          questionIds: attempt.questionIds || [],
          answers: attempt.answers || {},
          submittedAt: attempt.submittedAt || null,
        },
      ];
  const gradedSubmissions = rawSubmissions.map((submission) =>
    buildGradedSubmission(quizConfig, submission, attempt.questionCount),
  );
  const bestSubmission = pickBestGradedSubmission(gradedSubmissions) || null;

  if (!bestSubmission) {
    return {
      ...baseAttempt,
      gradedSubmissions,
      bestSubmissionNumber: Number(attempt.submissionCount || 1),
      bestSubmittedAt: attempt.submittedAt || null,
    };
  }

  return {
    ...baseAttempt,
    questionCount: bestSubmission.questionCount,
    correctCount: bestSubmission.correctCount,
    score: bestSubmission.score,
    gradingReady: bestSubmission.gradingReady,
    gradedQuestions: bestSubmission.gradedQuestions,
    gradedSubmissions,
    bestSubmissionNumber: Number(bestSubmission.submissionNumber || 1),
    bestSubmittedAt: bestSubmission.submittedAt || null,
  };
}

function renderAttemptScore(attempt) {
  if (!attempt?.gradingReady) {
    return 'Chưa chấm được';
  }

  return `${attempt.correctCount}/${attempt.questionCount} (${attempt.score}%)`;
}

function buildQuestionComparisonRows(submissionHistory = []) {
  const questionMap = new Map();

  submissionHistory.forEach((submission, submissionIndex) => {
    const submissionNumber = Number(submission?.submissionNumber || submissionIndex + 1);

    (submission?.gradedQuestions || []).forEach((question, questionIndex) => {
      const questionId = String(question?.questionId || `submission-${submissionNumber}-question-${questionIndex + 1}`).trim();
      const existingRow = questionMap.get(questionId) || {
        questionId,
        prompt: String(question?.prompt || '').trim(),
        imageUrl: String(question?.imageUrl || '').trim(),
        imageAlt: String(question?.imageAlt || '').trim(),
        questionType: String(question?.questionType || QUIZ_QUESTION_TYPE_SINGLE_CHOICE).trim(),
        correctOptionText: String(question?.correctOptionText || '').trim(),
        order: Math.max(1, Number(question?.order || questionIndex + 1)),
        firstSubmissionNumber: submissionNumber,
        responsesBySubmission: new Map(),
      };

      existingRow.prompt = existingRow.prompt || String(question?.prompt || '').trim();
      existingRow.imageUrl = existingRow.imageUrl || String(question?.imageUrl || '').trim();
      existingRow.imageAlt = existingRow.imageAlt || String(question?.imageAlt || '').trim();
      existingRow.correctOptionText = existingRow.correctOptionText || String(question?.correctOptionText || '').trim();
      existingRow.questionType =
        existingRow.questionType || String(question?.questionType || QUIZ_QUESTION_TYPE_SINGLE_CHOICE).trim();
      existingRow.responsesBySubmission.set(submissionNumber, question);
      questionMap.set(questionId, existingRow);
    });
  });

  return [...questionMap.values()].sort((left, right) => {
    if (left.firstSubmissionNumber !== right.firstSubmissionNumber) {
      return left.firstSubmissionNumber - right.firstSubmissionNumber;
    }

    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.prompt.localeCompare(right.prompt, 'vi');
  });
}

function getAttemptSubmissionHistory(attempt) {
  if (!attempt) {
    return [];
  }

  const gradedSubmissions = Array.isArray(attempt.gradedSubmissions) ? attempt.gradedSubmissions : [];

  if (gradedSubmissions.length > 0) {
    return [...gradedSubmissions].sort((left, right) => {
      if ((left.submissionNumber || 0) !== (right.submissionNumber || 0)) {
        return (left.submissionNumber || 0) - (right.submissionNumber || 0);
      }

      const leftTime = left.submittedAt instanceof Date ? left.submittedAt.getTime() : 0;
      const rightTime = right.submittedAt instanceof Date ? right.submittedAt.getTime() : 0;
      return leftTime - rightTime;
    });
  }

  const fallbackSubmission = buildFallbackSubmissionFromAttempt(attempt);
  return fallbackSubmission ? [fallbackSubmission] : [];
}

function getLatestAttemptSubmission(attempt) {
  const submissionHistory = getAttemptSubmissionHistory(attempt);
  return submissionHistory[submissionHistory.length - 1] || null;
}

function getBestAttemptSubmission(attempt) {
  const submissionHistory = getAttemptSubmissionHistory(attempt);

  if (!submissionHistory.length) {
    return null;
  }

  const preferredSubmissionNumber = Number(attempt?.bestSubmissionNumber || 0);

  if (preferredSubmissionNumber > 0) {
    const matchedSubmission = submissionHistory.find(
      (submission) => Number(submission.submissionNumber || 0) === preferredSubmissionNumber,
    );

    if (matchedSubmission) {
      return matchedSubmission;
    }
  }

  return pickBestGradedSubmission(submissionHistory);
}

function buildAttemptReportSummary(attempts = []) {
  const decoratedAttempts = Array.isArray(attempts) ? attempts.filter((attempt) => attempt?.gradingReady) : [];
  const totalAttempts = decoratedAttempts.length;
  const scoreList = decoratedAttempts.map((attempt) => Number(attempt.score || 0));
  const averageScore =
    totalAttempts > 0 ? Math.round(scoreList.reduce((sum, score) => sum + score, 0) / totalAttempts) : 0;
  const highestScore = totalAttempts > 0 ? Math.max(...scoreList) : 0;
  const lowestScore = totalAttempts > 0 ? Math.min(...scoreList) : 0;
  const perfectCount = scoreList.filter((score) => score === 100).length;
  const questionMap = new Map();

  decoratedAttempts.forEach((attempt) => {
    (attempt.gradedQuestions || []).forEach((question) => {
      const existingItem = questionMap.get(question.questionId) || {
        questionId: question.questionId,
        prompt: question.prompt,
        questionType: question.questionType || QUIZ_QUESTION_TYPE_SINGLE_CHOICE,
        appearanceCount: 0,
        correctCount: 0,
        wrongCount: 0,
      };

      existingItem.appearanceCount += 1;
      existingItem.correctCount += question.isCorrect ? 1 : 0;
      existingItem.wrongCount += question.isCorrect ? 0 : 1;
      questionMap.set(question.questionId, existingItem);
    });
  });

  const questionRows = [...questionMap.values()].map((item) => ({
    ...item,
    correctRate: item.appearanceCount > 0 ? Math.round((item.correctCount / item.appearanceCount) * 100) : 0,
    wrongRate: item.appearanceCount > 0 ? Math.round((item.wrongCount / item.appearanceCount) * 100) : 0,
  }));
  const hardestQuestion = [...questionRows].sort((left, right) => {
    if (right.wrongRate !== left.wrongRate) {
      return right.wrongRate - left.wrongRate;
    }

    if (right.wrongCount !== left.wrongCount) {
      return right.wrongCount - left.wrongCount;
    }

    return left.prompt.localeCompare(right.prompt, 'vi');
  })[0] || null;
  const easiestQuestion = [...questionRows].sort((left, right) => {
    if (right.correctRate !== left.correctRate) {
      return right.correctRate - left.correctRate;
    }

    if (right.correctCount !== left.correctCount) {
      return right.correctCount - left.correctCount;
    }

    return left.prompt.localeCompare(right.prompt, 'vi');
  })[0] || null;

  return {
    totalAttempts,
    averageScore,
    highestScore,
    lowestScore,
    perfectCount,
    hardestQuestion,
    easiestQuestion,
  };
}

function renderAttemptSummaryCard({
  title,
  value,
  description,
  tone = 'neutral',
}) {
  return `
    <div class="quiz-summary-card quiz-summary-card--${tone}">
      <div class="quiz-summary-card__label">${escapeHtml(title)}</div>
      <div class="quiz-summary-card__value">${escapeHtml(value)}</div>
      <div class="quiz-summary-card__description">${escapeHtml(description)}</div>
    </div>
  `;
}

function renderQuestionInsight(title, question, mode = 'wrong') {
  if (!question) {
    return renderEmptyState({
      icon: 'bar-chart',
      title,
      description: 'Chưa có đủ bài nộp để tổng hợp chỉ số cho câu hỏi này.',
    });
  }

  return `
    <div class="quiz-summary-insight">
      <div class="small text-secondary text-uppercase fw-semibold mb-2">${escapeHtml(title)}</div>
      <div class="fw-semibold mb-2">${escapeHtml(question.prompt)}</div>
      <div class="small text-secondary">
        ${
          mode === 'wrong'
            ? `Bị sai ${question.wrongCount}/${question.appearanceCount} lượt (${question.wrongRate}%).`
            : `Làm đúng ${question.correctCount}/${question.appearanceCount} lượt (${question.correctRate}%).`
        }
      </div>
    </div>
  `;
}

function renderAttemptOverviewReport(attempts = []) {
  const summary = buildAttemptReportSummary(attempts);

  return `
    <div class="card border-0 shadow-sm h-100">
      <div class="card-header bg-white border-0">
        <h2 class="h5 mb-1">Báo cáo nhanh</h2>
        <p class="text-secondary mb-0">Tóm tắt kết quả lớp theo bộ lọc hiện tại.</p>
      </div>
      <div class="card-body">
        ${
          summary.totalAttempts === 0
            ? renderEmptyState({
                icon: 'clipboard2-data',
                title: 'Chưa có dữ liệu để tổng hợp',
                description: 'Khi học sinh nộp bài, thống kê điểm và câu khó/dễ sẽ hiển thị ở đây.',
              })
            : `
              <div class="quiz-summary-grid mb-4">
                ${renderAttemptSummaryCard({
                  title: 'Số bài đã nộp',
                  value: String(summary.totalAttempts),
                  description: 'Tính theo bộ lọc lớp và buổi hiện tại.',
                  tone: 'primary',
                })}
                ${renderAttemptSummaryCard({
                  title: 'Điểm trung bình',
                  value: `${summary.averageScore}%`,
                  description: `Cao nhất ${summary.highestScore}% · Thấp nhất ${summary.lowestScore}%`,
                  tone: 'success',
                })}
                ${renderAttemptSummaryCard({
                  title: 'Bài đạt tuyệt đối',
                  value: String(summary.perfectCount),
                  description: 'Số bài đạt 100% trong bộ lọc hiện tại.',
                  tone: 'warning',
                })}
              </div>
              <div class="quiz-summary-insight-grid">
                ${renderQuestionInsight('Câu bị sai nhiều nhất', summary.hardestQuestion, 'wrong')}
                ${renderQuestionInsight('Câu làm tốt nhất', summary.easiestQuestion, 'correct')}
              </div>
            `
        }
      </div>
    </div>
  `;
}

function getSelectedClass(classes = [], selectedClassCode = '') {
  return classes.find((classItem) => classItem.classCode === selectedClassCode) || null;
}

function getSelectedClassQuizConfig(selectedClass, attemptConfigs = []) {
  if (!selectedClass) {
    return null;
  }

  return (
    attemptConfigs.find(
      (config) => Number(config.sessionNumber) === Number(selectedClass.curriculumCurrentSession || 0),
    ) || null
  );
}

function getActiveQuizConfigsForClass(selectedClass, quizConfigs = [], attemptConfigs = [], selectedProgramId = '') {
  if (!selectedClass?.curriculumProgramId) {
    return [];
  }

  if (selectedClass.curriculumProgramId === selectedProgramId && Array.isArray(quizConfigs) && quizConfigs.length > 0) {
    return quizConfigs;
  }

  return Array.isArray(attemptConfigs) ? attemptConfigs : [];
}

function renderQuizPageTabs(activeTab = 'editor') {
  const tabs = [
    {
      id: 'editor',
      label: 'Quản lý đề',
      description: 'Soạn và cập nhật bộ câu hỏi theo chương trình',
      icon: 'journal-text',
    },
    {
      id: 'operations',
      label: 'Điều khiển và thống kê',
      description: 'Bắt đầu bài kiểm tra, theo dõi bài nộp và mở lại',
      icon: 'bar-chart-steps',
    },
  ];

  return `
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body p-3">
        <div class="d-flex flex-wrap gap-2">
          ${tabs
            .map((tab) => {
              const buttonClass = tab.id === activeTab ? 'btn-primary' : 'btn-outline-primary';

              return `
                <button
                  type="button"
                  class="btn ${buttonClass}"
                  data-action="switch-quiz-tab"
                  data-tab-id="${tab.id}"
                  title="${escapeHtml(tab.description)}"
                >
                  <i class="bi bi-${tab.icon} me-2"></i>${tab.label}
                </button>
              `;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function renderClassQuizLaunchControl({
  selectedClass,
  currentQuizConfig,
  sessionActivity,
  isUpdating,
  error,
}) {
  if (!selectedClass) {
    return renderEmptyState({
      icon: 'play-circle',
      title: 'Chưa chọn lớp',
      description: 'Chọn một lớp ở bên trên để bắt đầu hoặc kết thúc bài kiểm tra theo buổi hiện tại.',
    });
  }

  const currentSession = Number(selectedClass.curriculumCurrentSession || 0);
  const activityType = sessionActivity?.activityType || '';
  const activityLabel = activityType ? getCurriculumActivityTypeLabel(activityType) : 'Chưa rõ';

  if (!isCurriculumQuizActivity(activityType)) {
    return renderAlert(
      `Lớp này đang ở buổi ${currentSession || '?'} và được cấu hình là "${activityLabel}". Hãy đổi loại buổi sang "Kiểm tra" trong Học liệu trước khi mở.`,
      'info',
    );
  }

  if (!currentQuizConfig) {
    return renderAlert(
      `Chưa có bộ đề cho buổi ${currentSession} của chương trình đang gắn với lớp này.`,
      'warning',
    );
  }

  const readiness = getQuizReadiness(currentQuizConfig);

  if (!readiness.isReady) {
    return renderAlert(
      `Ngân hàng câu hỏi chưa đủ để mở kiểm tra. Cần ${QUIZ_QUESTION_LIMIT} câu theo tỉ lệ 4 dễ, 4 trung bình, 2 khó. ${formatQuizReadinessRequirement(readiness)}`,
      'warning',
    );
  }

  const isStarted = isQuizStartedForClass(selectedClass, currentSession, activityType);

  return `
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white border-0">
        <h3 class="h6 mb-1">Điều khiển bài kiểm tra</h3>
        <p class="text-secondary mb-0">Admin bấm bắt đầu thì học sinh mới thấy đề. Tab này dùng dữ liệu đã lưu, và mỗi học sinh nhận 10 câu ngẫu nhiên để làm từng câu một.</p>
      </div>
      <div class="card-body">
        ${error ? `<div class="mb-3">${renderAlert(escapeHtml(error), 'danger')}</div>` : ''}
        <div class="row g-3 mb-3">
          <div class="col-12 col-md-6">
            <div class="quiz-status-meta">
              <div class="quiz-status-meta__label">Trạng thái</div>
              <div class="fw-semibold">${isStarted ? 'Đang mở' : 'Chưa mở'}</div>
            </div>
          </div>
          <div class="col-12 col-md-6">
            <div class="quiz-status-meta">
              <div class="quiz-status-meta__label">Áp dụng</div>
              <div class="fw-semibold">Buổi ${currentSession} · ${escapeHtml(activityLabel)} · ${QUIZ_QUESTION_LIMIT} câu / học sinh</div>
            </div>
          </div>
        </div>
        <button
          type="button"
          class="btn ${isStarted ? 'btn-outline-danger' : 'btn-primary'} w-100"
          data-action="${isStarted ? 'stop-class-quiz' : 'start-class-quiz'}"
          ${isUpdating ? 'disabled' : ''}
        >
          ${
            isUpdating
              ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang cập nhật...'
              : isStarted
                ? '<i class="bi bi-stop-circle me-2"></i>Kết thúc bài kiểm tra cho lớp này'
                : `<i class="bi bi-play-circle me-2"></i>Bắt đầu bài kiểm tra buổi ${currentSession}`
          }
        </button>
      </div>
    </div>
  `;
}

function renderQuizEditor({
  programs,
  selectedProgramId,
  selectedSessionNumber,
  selectedProgram,
  draft,
  markdownDraft,
  isLoading,
  isSaving,
  isImportingMarkdown,
  uploadingQuestionId,
  imageUploadEnabled,
  error,
}) {
  if (!programs.length) {
    return renderEmptyState({
      icon: 'patch-question',
      title: 'Chưa có chương trình để gắn đề',
      description: 'Hãy tạo hoặc kích hoạt ít nhất một chương trình học trước khi cấu hình bài trắc nghiệm.',
    });
  }

  const importDisabled = isLoading || isSaving || isImportingMarkdown;
  const questionActionDisabled = isLoading || isSaving || isImportingMarkdown || Boolean(uploadingQuestionId);
  const sessionOptions = getProgramSessionOptions(selectedProgram);
  const selectedSessionActivity = selectedProgram
    ? getCurriculumSessionActivity(selectedProgram, selectedSessionNumber)
    : null;
  const selectedActivityLabel = selectedSessionActivity
    ? getCurriculumActivityTypeLabel(selectedSessionActivity.activityType)
    : 'Kiểm tra';
  const adminQuizPreviewPath = selectedProgramId
    ? buildAdminQuizPreviewPath(selectedProgramId, selectedSessionNumber)
    : '';
  const scopeSubject = String(draft?.subject || selectedProgram?.subject || 'Chưa rõ môn').trim();
  const scopeLevel = String(draft?.level || selectedProgram?.level || 'Chưa rõ level').trim();
  const readiness = getQuizReadiness(draft || {});
  const difficultyCounts = getQuizDifficultyCounts(draft?.questions || []);
  const policySummary = QUIZ_DIFFICULTIES.map(
    (difficulty) => `${getQuizDifficultyLabel(difficulty)} ${Number(readiness.policy?.[difficulty] || 0)}`,
  ).join(' · ');
  const countSummary = QUIZ_DIFFICULTIES.map(
    (difficulty) => `${getQuizDifficultyLabel(difficulty)} ${Number(difficultyCounts[difficulty] || 0)}`,
  ).join(' · ');

  return `
    <div class="card border-0 shadow-sm h-100">
      <div class="card-header bg-white border-0">
        <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start">
          <div>
            <h2 class="h5 mb-1">Cấu hình đề trắc nghiệm</h2>
            <p class="text-secondary mb-0">Tạo ngân hàng câu hỏi theo môn, level và buổi. Khi mở kiểm tra, hệ thống lấy ngẫu nhiên đúng tỉ lệ 4 dễ, 4 trung bình, 2 khó.</p>
          </div>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <span class="badge text-bg-light text-dark border">${escapeHtml(selectedActivityLabel)}</span>
            ${
              adminQuizPreviewPath
                ? `
                  <a class="btn btn-outline-primary btn-sm" href="${escapeHtml(adminQuizPreviewPath)}" target="_blank" rel="noreferrer">
                    <i class="bi bi-play-circle me-1"></i>Test quiz admin
                  </a>
                `
                : ''
            }
          </div>
        </div>
      </div>
      <div class="card-body">
        ${error ? `<div class="mb-3">${renderAlert(escapeHtml(error), 'danger')}</div>` : ''}
        <div class="row g-3">
          <div class="col-12">
            <label class="form-label">Chương trình nguồn</label>
            <select class="form-select" id="quiz-program-select" ${isLoading ? 'disabled' : ''}>
              ${programs
                .map(
                  (program) => `
                    <option value="${escapeHtml(program.id)}" ${program.id === selectedProgramId ? 'selected' : ''}>
                      ${escapeHtml(program.name)}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </div>
          <div class="col-12 col-lg-7">
            <label class="form-label">Tiêu đề bài kiểm tra</label>
            <input class="form-control" id="quiz-title-input" value="${escapeHtml(draft?.title || '')}" ${isLoading ? 'disabled' : ''} />
          </div>
          <div class="col-12 col-lg-5">
            <label class="form-label">Buổi áp dụng</label>
            <select class="form-select" id="quiz-session-select" ${isLoading ? 'disabled' : ''}>
              ${sessionOptions
                .map(
                  (item) => `
                    <option value="${item.sessionNumber}" ${item.sessionNumber === selectedSessionNumber ? 'selected' : ''}>
                      Buổi ${item.sessionNumber} - ${escapeHtml(getCurriculumActivityTypeLabel(item.activityType))}
                    </option>
                  `,
                )
                .join('')}
            </select>
            <div class="form-text">Bộ đề sẽ được lưu theo môn + level của chương trình này, ví dụ ${escapeHtml(scopeSubject)} + ${escapeHtml(scopeLevel)} + buổi ${selectedSessionNumber}.</div>
          </div>
          <div class="col-12">
            <label class="form-label">Mô tả ngắn</label>
            <textarea class="form-control" id="quiz-description-input" rows="3" ${isLoading ? 'disabled' : ''}>${escapeHtml(
              draft?.description || '',
            )}</textarea>
          </div>
        </div>
        <div class="row g-3 mt-1">
          <div class="col-12 col-xl-7">
            <div class="quiz-status-meta h-100">
              <div class="quiz-status-meta__label">Ngân hàng đang sửa</div>
              <div class="fw-semibold">
                ${escapeHtml(scopeSubject)} · ${escapeHtml(scopeLevel)} · Buổi ${Number(selectedSessionNumber || 0)}
              </div>
              <div class="small text-secondary mt-1">Loại buổi: ${escapeHtml(selectedActivityLabel)}</div>
            </div>
          </div>
          <div class="col-12 col-xl-5">
            <div class="quiz-status-meta h-100">
              <div class="quiz-status-meta__label">Tỉ lệ phát đề</div>
              <div class="fw-semibold">${escapeHtml(policySummary)}</div>
              <div class="small text-secondary mt-1">Hiện có: ${escapeHtml(countSummary)}</div>
            </div>
          </div>
          <div class="col-12">
            ${renderAlert(
              readiness.isReady
                ? `Ngân hàng đã đủ điều kiện mở kiểm tra: ${escapeHtml(policySummary)}.`
                : `Chưa đủ điều kiện mở kiểm tra. ${formatQuizReadinessRequirement(readiness)}`,
              readiness.isReady ? 'success' : 'warning',
            )}
          </div>
        </div>
        <div class="quiz-import-panel mt-4">
          <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start mb-3">
            <div>
              <h3 class="h6 mb-1">Nhập nhanh bằng file .md</h3>
              <div class="small text-secondary">
                Dùng markdown để thêm nhiều câu hỏi cùng lúc. Mỗi đáp án đúng đánh dấu bằng <code>[x]</code>, ảnh minh họa dùng
                dòng <code>Image:</code> hoặc cú pháp <code>![alt](url)</code>. Câu điền khuyết dùng
                <code>Type: fill_blank</code>, <code>Answers:</code> và <code>Difficulty:</code> hoặc <code>Độ khó:</code>.
              </div>
            </div>
          </div>
          <div class="row g-3">
            <div class="col-12 col-xl-6">
              <label class="form-label mb-2">Mẫu markdown</label>
              <textarea
                class="form-control font-monospace"
                rows="14"
                readonly
              >${escapeHtml(QUIZ_MARKDOWN_IMPORT_TEMPLATE)}</textarea>
              <div class="form-text">Đây là form mẫu để bạn copy và điều chỉnh theo bộ đề của mình.</div>
            </div>
            <div class="col-12 col-xl-6">
              <div class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-2">
                <label class="form-label mb-0" for="quiz-markdown-textarea">Nội dung markdown để áp dụng</label>
                <div class="d-flex flex-wrap gap-2">
                  <select
                    id="quiz-sample-set-select"
                    class="form-select form-select-sm w-auto"
                    aria-label="Chọn bộ câu hỏi mẫu"
                    ${importDisabled ? 'disabled' : ''}
                  >
                    ${QUIZ_MARKDOWN_SAMPLE_SETS.map(
                      (sampleSet) => `
                        <option value="${escapeHtml(sampleSet.id)}">${escapeHtml(sampleSet.title)}</option>
                      `,
                    ).join('')}
                  </select>
                  <button
                    type="button"
                    class="btn btn-outline-primary btn-sm"
                    data-action="use-quiz-sample-set"
                    ${importDisabled ? 'disabled' : ''}
                  >
                    <i class="bi bi-stars me-1"></i>Dùng bộ mẫu
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm"
                    data-action="use-quiz-markdown-template"
                    ${importDisabled ? 'disabled' : ''}
                  >
                    <i class="bi bi-clipboard-plus me-1"></i>Dùng mẫu
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm"
                    data-action="import-quiz-markdown"
                    ${importDisabled ? 'disabled' : ''}
                  >
                    ${
                      isImportingMarkdown
                        ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang xử lý...'
                        : '<i class="bi bi-file-earmark-arrow-up me-1"></i>Nạp file .md'
                    }
                  </button>
                </div>
              </div>
              <textarea
                id="quiz-markdown-textarea"
                class="form-control font-monospace"
                rows="14"
                placeholder="# Kiểm tra trắc nghiệm buổi 9&#10;&#10;Dán nội dung markdown vào đây, hoặc bấm &quot;Nạp file .md&quot; để đổ nội dung vào editor."
                ${importDisabled ? 'disabled' : ''}
              >${escapeHtml(markdownDraft || '')}</textarea>
              <div class="form-text">Bạn có thể nạp file markdown rồi chỉnh sửa trực tiếp trong ô này trước khi áp dụng vào bộ đề.</div>
              <div class="d-flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  class="btn btn-primary"
                  data-action="apply-quiz-markdown"
                  ${importDisabled ? 'disabled' : ''}
                >
                  ${
                    isImportingMarkdown
                      ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang áp dụng...'
                      : '<i class="bi bi-box-arrow-in-down me-2"></i>Áp dụng vào bộ đề'
                  }
                </button>
                <button
                  type="button"
                  class="btn btn-outline-danger"
                  data-action="clear-quiz-markdown"
                  ${importDisabled || !markdownDraft ? 'disabled' : ''}
                >
                  <i class="bi bi-eraser me-2"></i>Xóa editor
                </button>
              </div>
            </div>
          </div>
          <input type="file" id="quiz-markdown-import-input" class="d-none" accept=".md,text/markdown,text/plain" />
          <input type="file" id="quiz-question-image-input" class="d-none" accept="image/*" />
        </div>
        <hr class="my-4">
        <div class="d-flex flex-wrap justify-content-between gap-3 align-items-center mb-3">
          <div>
            <h3 class="h6 mb-1">Danh sách câu hỏi</h3>
            <div class="small text-secondary">Hỗ trợ trắc nghiệm 1 đáp án đúng và điền vào chỗ trống. Cần đủ ${escapeHtml(policySummary)} để mở kiểm tra.</div>
          </div>
          <button type="button" class="btn btn-outline-primary" data-action="add-question" ${questionActionDisabled ? 'disabled' : ''}>
            <i class="bi bi-plus-circle me-2"></i>Thêm câu hỏi
          </button>
        </div>
        ${
          isLoading
            ? renderLoadingOverlay('Đang tải cấu hình đề...')
            : (draft?.questions || []).length > 0
              ? `
                <div class="quiz-admin-question-list">
                  ${(draft.questions || [])
                    .map(
                      (question, questionIndex) => `
                        <section class="quiz-admin-question-card">
                          <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start mb-3">
                            <div>
                              <span class="badge text-bg-light text-dark border mb-2">Câu ${questionIndex + 1}</span>
                              <div class="small text-secondary">${escapeHtml(getQuizQuestionTypeLabel(question.type))}</div>
                            </div>
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-danger"
                              data-action="remove-question"
                              data-question-id="${escapeHtml(question.id)}"
                            >
                              <i class="bi bi-trash me-1"></i>Xóa câu
                            </button>
                          </div>
                          <div class="row g-3 mb-3">
                            <div class="col-12 col-lg-4">
                              <label class="form-label">Loại câu hỏi</label>
                              <select
                                class="form-select"
                                data-field="question-type"
                                data-question-id="${escapeHtml(question.id)}"
                              >
                                ${QUIZ_QUESTION_TYPES.map(
                                  (questionType) => `
                                    <option value="${escapeHtml(questionType)}" ${question.type === questionType ? 'selected' : ''}>
                                      ${escapeHtml(getQuizQuestionTypeLabel(questionType))}
                                    </option>
                                  `,
                                ).join('')}
                              </select>
                            </div>
                            <div class="col-12 col-lg-3">
                              <label class="form-label">Độ khó</label>
                              <select
                                class="form-select"
                                data-field="difficulty"
                                data-question-id="${escapeHtml(question.id)}"
                              >
                                ${QUIZ_DIFFICULTIES.map(
                                  (difficulty) => `
                                    <option value="${escapeHtml(difficulty)}" ${question.difficulty === difficulty ? 'selected' : ''}>
                                      ${escapeHtml(getQuizDifficultyLabel(difficulty))}
                                    </option>
                                  `,
                                ).join('')}
                              </select>
                            </div>
                            <div class="col-12 col-lg-5">
                              <label class="form-label">Nội dung câu hỏi</label>
                              <textarea
                                class="form-control"
                                rows="3"
                                data-field="prompt"
                                data-question-id="${escapeHtml(question.id)}"
                              >${escapeHtml(question.prompt)}</textarea>
                            </div>
                          </div>
                          <div class="row g-3 mb-3">
                            <div class="col-12 col-lg-8">
                              <label class="form-label">URL ảnh minh họa</label>
                              <input
                                class="form-control"
                                value="${escapeHtml(question.imageUrl || '')}"
                                placeholder="https://..."
                                data-field="image-url"
                                data-question-id="${escapeHtml(question.id)}"
                              />
                            </div>
                            <div class="col-12 col-lg-4">
                              <label class="form-label">Mô tả ảnh</label>
                              <input
                                class="form-control"
                                value="${escapeHtml(question.imageAlt || '')}"
                                placeholder="Mô tả ngắn cho ảnh"
                                data-field="image-alt"
                                data-question-id="${escapeHtml(question.id)}"
                              />
                            </div>
                            <div class="col-12">
                              <div class="d-flex flex-wrap gap-2 align-items-center">
                                <button
                                  type="button"
                                  class="btn btn-sm btn-outline-secondary"
                                  data-action="pick-question-image"
                                  data-question-id="${escapeHtml(question.id)}"
                                  ${!imageUploadEnabled || Boolean(uploadingQuestionId) ? 'disabled' : ''}
                                >
                                  ${
                                    uploadingQuestionId === question.id
                                      ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang tải ảnh...'
                                      : '<i class="bi bi-image me-1"></i>Tải ảnh'
                                  }
                                </button>
                                <button
                                  type="button"
                                  class="btn btn-sm btn-outline-danger"
                                  data-action="remove-question-image"
                                  data-question-id="${escapeHtml(question.id)}"
                                  ${!question.imageUrl || Boolean(uploadingQuestionId) ? 'disabled' : ''}
                                >
                                  <i class="bi bi-trash me-1"></i>Xóa ảnh
                                </button>
                                <span class="small text-secondary">
                                  ${
                                    imageUploadEnabled
                                      ? 'Có thể dán URL ảnh hoặc tải ảnh lên trực tiếp cho từng câu hỏi.'
                                      : 'Cloudinary chưa cấu hình, bạn vẫn có thể dán URL ảnh thủ công.'
                                  }
                                </span>
                              </div>
                              ${renderQuestionImagePreview(question.imageUrl, question.imageAlt, question.prompt)}
                            </div>
                          </div>
                          ${
                            isFillBlankQuestion(question)
                              ? `
                                <div class="row g-3">
                                  <div class="col-12 col-lg-8">
                                    <label class="form-label">Gợi ý trong ô trả lời</label>
                                    <input
                                      class="form-control"
                                      value="${escapeHtml(question.blankPlaceholder || '')}"
                                      placeholder="Ví dụ: Nhập tên hàm"
                                      data-field="blank-placeholder"
                                      data-question-id="${escapeHtml(question.id)}"
                                    />
                                  </div>
                                  <div class="col-12 col-lg-4">
                                    <label class="form-label">So khớp chữ hoa/thường</label>
                                    <div class="form-check form-switch border rounded-3 px-3 py-2 h-100 d-flex align-items-center">
                                      <input
                                        class="form-check-input me-2"
                                        type="checkbox"
                                        role="switch"
                                        data-field="case-sensitive"
                                        data-question-id="${escapeHtml(question.id)}"
                                        ${question.caseSensitive ? 'checked' : ''}
                                      />
                                      <label class="form-check-label">Phân biệt hoa thường</label>
                                    </div>
                                  </div>
                                  <div class="col-12">
                                    <label class="form-label">Đáp án chấp nhận</label>
                                    <textarea
                                      class="form-control"
                                      rows="4"
                                      placeholder="Mỗi dòng là một đáp án hợp lệ"
                                      data-field="accepted-answers"
                                      data-question-id="${escapeHtml(question.id)}"
                                    >${escapeHtml(stringifyAcceptedAnswers(question.acceptedAnswers))}</textarea>
                                    <div class="form-text">Bạn có thể nhập nhiều đáp án tương đương, mỗi dòng một đáp án.</div>
                                  </div>
                                </div>
                              `
                              : `
                                <div class="quiz-admin-option-list">
                                  ${(question.options || [])
                                    .map(
                                      (option, optionIndex) => `
                                        <div class="quiz-admin-option-row">
                                          <div class="form-check">
                                            <input
                                              class="form-check-input"
                                              type="radio"
                                              name="correct-option-${escapeHtml(question.id)}"
                                              ${question.correctOptionId === option.id ? 'checked' : ''}
                                              data-action="set-correct-option"
                                              data-question-id="${escapeHtml(question.id)}"
                                              data-option-id="${escapeHtml(option.id)}"
                                            />
                                          </div>
                                          <input
                                            class="form-control"
                                            value="${escapeHtml(option.text)}"
                                            placeholder="Đáp án ${optionIndex + 1}"
                                            data-field="option-text"
                                            data-question-id="${escapeHtml(question.id)}"
                                            data-option-id="${escapeHtml(option.id)}"
                                          />
                                          <button
                                            type="button"
                                            class="btn btn-outline-secondary"
                                            data-action="remove-option"
                                            data-question-id="${escapeHtml(question.id)}"
                                            data-option-id="${escapeHtml(option.id)}"
                                            ${(question.options || []).length <= 2 ? 'disabled' : ''}
                                          >
                                            <i class="bi bi-dash-circle"></i>
                                          </button>
                                        </div>
                                      `,
                                    )
                                    .join('')}
                                </div>
                                <div class="mt-3">
                                  <button
                                    type="button"
                                    class="btn btn-sm btn-outline-primary"
                                    data-action="add-option"
                                    data-question-id="${escapeHtml(question.id)}"
                                  >
                                    <i class="bi bi-plus-circle me-1"></i>Thêm đáp án
                                  </button>
                                </div>
                              `
                          }
                        </section>
                      `,
                    )
                    .join('')}
                </div>
              `
              : renderEmptyState({
                  icon: 'list-check',
                  title: `Chưa có câu hỏi cho buổi ${selectedSessionNumber}`,
                  description: 'Bấm "Thêm câu hỏi" để bắt đầu soạn đề trắc nghiệm cho chương trình này.',
                })
        }
      </div>
      <div class="card-footer bg-white border-0 pt-0">
        <button
          type="button"
          class="btn btn-primary w-100"
          data-action="save-quiz"
          ${isSaving || isImportingMarkdown || Boolean(uploadingQuestionId) ? 'disabled' : ''}
        >
          ${
            isSaving
              ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang lưu cấu hình...'
              : '<i class="bi bi-save me-2"></i>Lưu cấu hình bài kiểm tra'
          }
        </button>
      </div>
    </div>
  `;
}

function renderAttemptList({
  classes,
  selectedClassCode,
  selectedSessionFilter,
  sessionFilterOptions = [],
  attempts,
  isLoading,
  error,
  selectedAttemptId,
}) {
  return `
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white border-0">
        <h2 class="h5 mb-1">Bài nộp của học sinh</h2>
        <p class="text-secondary mb-0">Theo dõi trạng thái nộp bài, điểm chấm tự động và mở lại khi cần.</p>
      </div>
      <div class="card-body">
        <div class="row g-3 mb-3">
          <div class="col-12 col-lg-8">
            <label class="form-label">Lớp</label>
            <select id="quiz-attempt-class-select" class="form-select">
              <option value="">Chọn lớp để xem bài nộp</option>
              ${classes
                .map(
                  (classItem) => `
                    <option value="${escapeHtml(classItem.classCode)}" ${classItem.classCode === selectedClassCode ? 'selected' : ''}>
                      ${escapeHtml(classItem.classCode)} - ${escapeHtml(classItem.className)}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </div>
          <div class="col-12 col-lg-4">
            <label class="form-label">Lọc theo buổi</label>
            <select id="quiz-attempt-session-filter" class="form-select">
              <option value="all" ${selectedSessionFilter === 'all' ? 'selected' : ''}>Tất cả</option>
              ${sessionFilterOptions.map(
                (item) => `
                  <option value="${item.sessionNumber}" ${Number(selectedSessionFilter) === item.sessionNumber ? 'selected' : ''}>
                    Buổi ${item.sessionNumber} - ${escapeHtml(getCurriculumActivityTypeLabel(item.activityType))}
                  </option>
                `,
              ).join('')}
            </select>
          </div>
        </div>
        ${
          !selectedClassCode
            ? renderEmptyState({
                icon: 'inboxes',
                title: 'Chưa chọn lớp',
                description: 'Chọn một lớp ở trên để xem danh sách bài nộp trắc nghiệm.',
              })
            : isLoading
              ? renderLoadingOverlay('Đang tải danh sách bài nộp...')
              : error
                ? renderAlert(escapeHtml(error), 'danger')
                : attempts.length > 0
                  ? `
                    <div class="table-responsive">
                      <table class="table align-middle quiz-attempt-table">
                        <thead>
                          <tr>
                            <th>Học sinh</th>
                            <th>Buổi</th>
                            <th>Trạng thái</th>
                            <th>Điểm</th>
                            <th>Nộp lúc</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${attempts
                            .map(
                              (attempt) => `
                                <tr
                                  class="quiz-attempt-row ${attempt.id === selectedAttemptId ? 'quiz-attempt-row--active' : ''}"
                                >
                                  <td>
                                    <button
                                      type="button"
                                      class="btn btn-link p-0 text-start fw-semibold quiz-attempt-name"
                                      data-action="open-attempt-modal"
                                      data-attempt-id="${escapeHtml(attempt.id)}"
                                    >
                                      ${escapeHtml(attempt.studentName)}
                                    </button>
                                    <div class="small text-secondary">
                                      ${escapeHtml(attempt.quizTitle || 'Bài kiểm tra')} · Kiểm tra
                                    </div>
                                  </td>
                                  <td>Buổi ${Number(attempt.sessionNumber || 0)}</td>
                                  <td>${getAttemptStatusBadge(attempt)}</td>
                                  <td>${renderAttemptScore(attempt)}</td>
                                  <td>${escapeHtml(formatDateTime(attempt.submittedAt))}</td>
                                </tr>
                              `,
                            )
                            .join('')}
                        </tbody>
                      </table>
                    </div>
                  `
                  : renderEmptyState({
                      icon: 'clipboard2-x',
                      title: 'Chưa có bài nộp',
                      description: 'Lớp này chưa có học sinh nộp bài trong phạm vi lọc hiện tại.',
                    })
        }
      </div>
    </div>
  `;
}

function renderAttemptDetail(attempt, options = {}) {
  const isReopening = Boolean(options.isReopening);
  const modalInfo = String(options.info || '').trim();
  const modalError = String(options.error || '').trim();
  const submissionHistory = Array.isArray(options.submissionHistory)
    ? options.submissionHistory
    : getAttemptSubmissionHistory(attempt);
  const bestSubmission = options.bestSubmission || getBestAttemptSubmission(attempt);
  const latestSubmission = options.latestSubmission || getLatestAttemptSubmission(attempt);
  const bestSubmissionNumber = Number(bestSubmission?.submissionNumber || attempt?.bestSubmissionNumber || 0);
  const latestSubmissionNumber = Number(latestSubmission?.submissionNumber || 0);
  const questionComparisonRows = buildQuestionComparisonRows(submissionHistory);
  const statusMeta = getAttemptStatusMeta(attempt);

  if (!attempt) {
    return renderEmptyState({
      icon: 'file-earmark-check',
      title: 'Chọn một bài nộp',
      description: 'Bấm vào tên học sinh trong bảng để xem chi tiết bài nộp và mở lại lượt làm nếu cần.',
    });
  }

  return `
    <div class="card border-0 shadow-sm h-100">
      <div class="card-header bg-white border-0">
        <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start">
          <div>
            <h2 class="h5 mb-1">${escapeHtml(attempt.studentName)}</h2>
            <p class="text-secondary mb-0">
              ${escapeHtml(attempt.classCode)} · Buổi ${Number(attempt.sessionNumber || 0)} · ${escapeHtml(attempt.quizTitle || 'Bài kiểm tra')}
            </p>
          </div>
          <div class="d-flex flex-wrap gap-2 align-items-center justify-content-end">
            <button
              type="button"
              class="btn btn-outline-primary"
              data-action="reopen-attempt"
              data-attempt-id="${escapeHtml(attempt.id)}"
              data-class-code="${escapeHtml(attempt.classCode || '')}"
              data-student-id="${escapeHtml(attempt.studentId || '')}"
              data-session-number="${Number(attempt.sessionNumber || 0)}"
              data-quiz-mode="${escapeHtml(attempt.quizMode || QUIZ_MODE_OFFICIAL)}"
              ${attempt.status === QUIZ_ATTEMPT_STATUS_REOPENED || isReopening ? 'disabled' : ''}
            >
              ${
                isReopening
                  ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang mở lại...'
                  : '<i class="bi bi-arrow-repeat me-2"></i>Mở lại cho học sinh làm lại'
              }
            </button>
            ${getAttemptStatusBadge(attempt)}
            <span class="badge bg-white text-dark border">${renderAttemptScore(bestSubmission || attempt)}</span>
          </div>
        </div>
      </div>
      <div class="card-body">
        ${
          modalInfo
            ? `
              <div class="alert alert-info d-flex align-items-center gap-2" role="alert">
                <span class="spinner-border spinner-border-sm flex-shrink-0 ${isReopening ? '' : 'd-none'}" aria-hidden="true"></span>
                <span>${escapeHtml(modalInfo)}</span>
              </div>
            `
            : ''
        }
        ${
          modalError
            ? `
              <div class="alert alert-danger" role="alert">
                ${escapeHtml(modalError)}
              </div>
            `
            : ''
        }
        <div class="row g-3 mb-4">
          <div class="col-12 col-md-4">
            <div class="quiz-status-meta">
              <div class="quiz-status-meta__label">Số lượt làm đã ghi nhận</div>
              <div class="fw-semibold">${submissionHistory.length || attempt.submissionCount || 1}</div>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <div class="quiz-status-meta">
              <div class="quiz-status-meta__label">Điểm cao nhất</div>
              <div class="fw-semibold">${renderAttemptScore(bestSubmission || attempt)}</div>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <div class="quiz-status-meta">
              <div class="quiz-status-meta__label">Lần nộp gần nhất</div>
              <div class="fw-semibold">${
                latestSubmission
                  ? `Lần ${Number(latestSubmission.submissionNumber || 0)} · ${renderAttemptScore(latestSubmission)}`
                  : 'Chưa có dữ liệu'
              }</div>
            </div>
          </div>
        </div>
        <div class="alert ${attempt.status === QUIZ_ATTEMPT_STATUS_REOPENED ? 'alert-warning' : hasAttemptRetakeAfterReopen(attempt) ? 'alert-success' : 'alert-secondary'}" role="alert">
          <div class="fw-semibold mb-1">Trạng thái hiện tại: ${escapeHtml(statusMeta.label)}</div>
          <div>${escapeHtml(statusMeta.detail)}</div>
        </div>
        ${
          submissionHistory.length > 1
            ? `
              <div class="mb-4">
                <h3 class="h6 mb-3">So sánh các lần làm</h3>
                <div class="row g-3">
                  ${submissionHistory
                    .map((submission) => {
                      const submissionNumber = Number(submission.submissionNumber || 0);
                      const isBestSubmission = submissionNumber === bestSubmissionNumber;
                      const isLatestSubmission = submissionNumber === latestSubmissionNumber;

                      return `
                        <div class="col-12 col-md-6">
                          <div class="quiz-status-meta h-100">
                            <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
                              <div class="quiz-status-meta__label mb-0">Lần ${submissionNumber || '?'}</div>
                              ${isBestSubmission ? '<span class="badge text-bg-success">Tốt nhất</span>' : ''}
                              ${isLatestSubmission ? '<span class="badge text-bg-info">Mới nhất</span>' : ''}
                            </div>
                            <div class="fw-semibold mb-2">${renderAttemptScore(submission)}</div>
                            <div class="small text-secondary">${escapeHtml(formatDateTime(submission.submittedAt))}</div>
                          </div>
                        </div>
                      `;
                    })
                    .join('')}
                </div>
              </div>
            `
            : ''
        }
        ${
          attempt.status === QUIZ_ATTEMPT_STATUS_REOPENED && attempt.reopenedAt
            ? `
              <div class="alert alert-warning" role="alert">
                Bài này đã được mở lại lúc ${escapeHtml(formatDateTime(attempt.reopenedAt))}${
                  attempt.reopenedBy ? ` bởi ${escapeHtml(attempt.reopenedBy)}` : ''
                }.
              </div>
            `
            : ''
        }
        ${
          !submissionHistory.some((submission) => submission?.gradingReady)
            ? `
              <div class="alert alert-secondary" role="alert">
                Chưa tải được đáp án chính xác của đề nên chưa hiển thị chi tiết chấm bài.
              </div>
            `
            : ''
        }
        <div class="quiz-attempt-answer-list">
          ${questionComparisonRows
            .map(
              (question, index) => `
                <section class="quiz-answer-card">
                  <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start mb-3">
                    <div>
                      <div class="d-flex flex-wrap gap-2 mb-2">
                        <span class="badge text-bg-light text-dark border">Câu ${index + 1}</span>
                        <span class="badge bg-white text-dark border">${escapeHtml(getQuizQuestionTypeLabel(question.questionType))}</span>
                      </div>
                      <div class="fw-semibold">${nl2br(question.prompt)}</div>
                      ${renderQuestionImagePreview(question.imageUrl, question.imageAlt, question.prompt)}
                    </div>
                  </div>
                  <div class="row g-3 mb-3">
                    <div class="col-12">
                      <div class="quiz-status-meta">
                        <div class="quiz-status-meta__label">${question.questionType === QUIZ_QUESTION_TYPE_FILL_BLANK ? 'Đáp án chấp nhận' : 'Đáp án đúng'}</div>
                        <div>${nl2br(question.correctOptionText)}</div>
                      </div>
                    </div>
                  </div>
                  <div class="row g-3">
                    ${submissionHistory
                      .map((submission) => {
                        const submissionNumber = Number(submission.submissionNumber || 0);
                        const comparedQuestion = question.responsesBySubmission.get(submissionNumber) || null;
                        const statusLabel = !comparedQuestion ? 'Không có câu này' : comparedQuestion.isCorrect ? 'Đúng' : 'Sai';
                        const statusClass = !comparedQuestion
                          ? 'text-bg-secondary'
                          : comparedQuestion.isCorrect
                            ? 'text-bg-success'
                            : 'text-bg-danger';
                        const answerLabel = question.questionType === QUIZ_QUESTION_TYPE_FILL_BLANK ? 'Học sinh trả lời' : 'Học sinh chọn';
                        const answerMarkup = !comparedQuestion
                          ? '<span class="text-secondary">Lượt này không gặp câu hỏi này trong bộ đề ngẫu nhiên.</span>'
                          : comparedQuestion.selectedOptionText
                            ? nl2br(comparedQuestion.selectedOptionText)
                            : `<span class="text-secondary">${
                                question.questionType === QUIZ_QUESTION_TYPE_FILL_BLANK ? 'Chưa trả lời' : 'Chưa chọn'
                              }</span>`;

                        return `
                          <div class="col-12 col-xl-6">
                            <div class="quiz-status-meta h-100">
                              <div class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-2">
                                <div class="quiz-status-meta__label mb-0">Lần ${submissionNumber || '?'}</div>
                                <span class="badge ${statusClass}">${statusLabel}</span>
                              </div>
                              <div class="small text-secondary mb-2">${escapeHtml(formatDateTime(submission.submittedAt))}</div>
                              <div class="small text-uppercase text-secondary fw-semibold mb-1">${answerLabel}</div>
                              <div>${answerMarkup}</div>
                            </div>
                          </div>
                        `;
                      })
                      .join('')}
                  </div>
                </section>
              `,
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function renderAttemptDetailModal(attempt, isOpen = false, options = {}) {
  if (!isOpen || !attempt) {
    return '';
  }

  return `
    <div class="quiz-modal-backdrop" data-action="close-attempt-modal">
      <div class="quiz-modal-dialog" role="dialog" aria-modal="true" aria-label="Chi tiết bài nộp">
        <div class="d-flex justify-content-end mb-3">
          <button type="button" class="btn btn-outline-secondary btn-sm" data-action="close-attempt-modal">
            <i class="bi bi-x-lg me-2"></i>Đóng
          </button>
        </div>
        ${renderAttemptDetail(attempt, options)}
      </div>
    </div>
  `;
}

export function renderQuizManagementContent() {
  return `
    <div id="quiz-tabs-slot">${renderQuizPageTabs('editor')}</div>
    <section id="quiz-editor-panel">
      <div id="quiz-editor-slot">${renderLoadingOverlay('Đang tải cấu hình trắc nghiệm...')}</div>
    </section>
    <section id="quiz-operations-panel" class="d-none">
      <div class="row g-4">
        <div class="col-12 col-xl-5">
          <div class="d-grid gap-4">
            <div id="quiz-launch-control-slot">${renderLoadingOverlay('Đang tải điều khiển bài kiểm tra...')}</div>
            <div id="quiz-attempt-list-slot">${renderLoadingOverlay('Đang tải danh sách lớp...')}</div>
          </div>
        </div>
        <div class="col-12 col-xl-7">
          <div id="quiz-report-slot">${renderLoadingOverlay('Đang tổng hợp báo cáo nhanh...')}</div>
        </div>
      </div>
    </section>
    <div id="quiz-attempt-modal-slot"></div>
  `;
}

export const quizzesPage = {
  title: 'Quản lý trắc nghiệm',
  async render() {
    const authState = getAuthState();

    return renderAppShell({
      title: 'Quản lý trắc nghiệm',
      subtitle: 'Soạn đề theo buổi, điều khiển kiểm tra và xem bài học sinh đã nộp.',
      currentRoute: '/admin/quizzes',
      user: authState.user,
      content: renderQuizManagementContent(),
    });
  },
  async mount() {
    return mountQuizManagement();
  },
};

export async function mountQuizManagement({ defaultActiveTab = 'editor', forceDefaultTab = false } = {}) {
    const savedUiState = {
      activeTab: forceDefaultTab ? defaultActiveTab : loadQuizAdminUiState().activeTab || defaultActiveTab,
    };
    const tabsSlot = document.getElementById('quiz-tabs-slot');
    const editorPanel = document.getElementById('quiz-editor-panel');
    const operationsPanel = document.getElementById('quiz-operations-panel');
    const editorSlot = document.getElementById('quiz-editor-slot');
    const launchControlSlot = document.getElementById('quiz-launch-control-slot');
    const attemptListSlot = document.getElementById('quiz-attempt-list-slot');
    const reportSlot = document.getElementById('quiz-report-slot');
    const attemptModalSlot = document.getElementById('quiz-attempt-modal-slot');

    const state = {
      classes: [],
      programs: [],
      selectedProgramId: '',
      selectedSessionNumber: QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS[0],
      quizConfigs: [],
      draft: createEmptyQuizDraft(QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS[0]),
      quizLoading: true,
      quizError: '',
      isSavingQuiz: false,
      isImportingMarkdown: false,
      uploadingQuestionId: '',
      isUpdatingClassQuiz: false,
      classQuizError: '',
      attempts: [],
      attemptConfigs: [],
      attemptsLoading: false,
      attemptsError: '',
      selectedClassCode: '',
      selectedSessionFilter: 'all',
      selectedAttemptId: '',
      markdownDraft: '',
      activeTab: savedUiState.activeTab === 'operations' ? 'operations' : 'editor',
      isAttemptModalOpen: false,
      reopeningAttemptId: '',
      attemptModalInfo: '',
      attemptModalError: '',
    };
    let pendingQuestionImageId = '';

    function markAttemptAsReopened(attemptId) {
      const reopenedAt = new Date();
      const reopenedBy = getAuthState().user?.email || '';

      state.attempts = state.attempts.map((attempt) =>
        attempt.id === attemptId
          ? {
              ...attempt,
              status: QUIZ_ATTEMPT_STATUS_REOPENED,
              reopenedAt,
              reopenedBy,
            }
          : attempt,
      );
    }

    function getFilteredAttempts(attempts = state.attempts) {
      return attempts.filter((attempt) => {
        if (state.selectedSessionFilter === 'all') {
          return true;
        }

        return Number(attempt.sessionNumber) === Number(state.selectedSessionFilter);
      });
    }

    function getSelectedAttempt(filteredAttempts = getFilteredAttempts()) {
      return filteredAttempts.find((attempt) => attempt.id === state.selectedAttemptId) || null;
    }

    function syncDraftFromConfigs() {
      const savedConfig =
        state.quizConfigs.find((config) => Number(config.sessionNumber) === Number(state.selectedSessionNumber)) || null;
      const selectedProgram = state.programs.find((program) => program.id === state.selectedProgramId) || null;

      state.draft = savedConfig
        ? normalizeQuizConfigRecord(savedConfig, state.selectedSessionNumber, selectedProgram || {})
        : createEmptyQuizDraft(state.selectedSessionNumber, selectedProgram);
    }

    function renderView() {
      persistQuizAdminUiState(state);
      tabsSlot.innerHTML = renderQuizPageTabs(state.activeTab);
      editorPanel.classList.toggle('d-none', state.activeTab !== 'editor');
      operationsPanel.classList.toggle('d-none', state.activeTab !== 'operations');

      const manageableClasses = getQuizManageableClasses(state.classes);
      const selectedClass = getSelectedClass(manageableClasses, state.selectedClassCode);
      const selectedProgram = state.programs.find((program) => program.id === state.selectedProgramId) || null;
      const selectedClassProgram = getClassProgram(selectedClass, state.programs);
      const selectedClassActivity = getClassQuizActivity(selectedClass, state.programs);
      const sessionFilterOptions = getProgramSessionOptions(selectedClassProgram || selectedProgram);
      const activeClassConfigs = getActiveQuizConfigsForClass(
        selectedClass,
        state.quizConfigs,
        state.attemptConfigs,
        state.selectedProgramId,
      );
      const currentQuizConfig = getSelectedClassQuizConfig(selectedClass, activeClassConfigs);
      const decoratedAttempts = state.attempts.map((attempt) => decorateAttemptByBestScore(attempt, activeClassConfigs));
      const filteredAttempts = getFilteredAttempts(decoratedAttempts);
      const selectedAttempt = getSelectedAttempt(filteredAttempts);
      const officialReportAttempts = filteredAttempts.filter((attempt) => isOfficialQuizMode(attempt.quizMode));

      editorSlot.innerHTML = renderQuizEditor({
        programs: state.programs,
        selectedProgramId: state.selectedProgramId,
        selectedSessionNumber: state.selectedSessionNumber,
        selectedProgram,
        draft: state.draft,
        markdownDraft: state.markdownDraft,
        isLoading: state.quizLoading,
        isSaving: state.isSavingQuiz,
        isImportingMarkdown: state.isImportingMarkdown,
        uploadingQuestionId: state.uploadingQuestionId,
        imageUploadEnabled: isCloudinaryConfigured(),
        error: state.quizError,
      });

      launchControlSlot.innerHTML = renderClassQuizLaunchControl({
        selectedClass,
        currentQuizConfig,
        sessionActivity: selectedClassActivity,
        isUpdating: state.isUpdatingClassQuiz,
        error: state.classQuizError,
      });

      attemptListSlot.innerHTML = renderAttemptList({
        classes: manageableClasses,
        selectedClassCode: state.selectedClassCode,
        selectedSessionFilter: state.selectedSessionFilter,
        sessionFilterOptions,
        attempts: filteredAttempts,
        isLoading: state.attemptsLoading,
        error: state.attemptsError,
        selectedAttemptId: selectedAttempt?.id || '',
      });

      reportSlot.innerHTML = renderAttemptOverviewReport(officialReportAttempts);
      attemptModalSlot.innerHTML = renderAttemptDetailModal(selectedAttempt, state.isAttemptModalOpen, {
        submissionHistory: getAttemptSubmissionHistory(selectedAttempt),
        bestSubmission: getBestAttemptSubmission(selectedAttempt),
        latestSubmission: getLatestAttemptSubmission(selectedAttempt),
        isReopening:
          Boolean(state.reopeningAttemptId) && state.reopeningAttemptId === (selectedAttempt?.id || ''),
        info: state.attemptModalInfo,
        error: state.attemptModalError,
      });
    }

    async function loadQuizConfigs() {
      if (!state.selectedProgramId) {
        state.quizConfigs = [];
        state.quizLoading = false;
        state.quizError = '';
        syncDraftFromConfigs();
        renderView();
        return;
      }

      state.quizLoading = true;
      state.quizError = '';
      renderView();

      try {
        const selectedProgram = state.programs.find((program) => program.id === state.selectedProgramId) || null;
        state.quizConfigs = selectedProgram ? await listQuizConfigs(selectedProgram) : [];
        syncDraftFromConfigs();
      } catch (error) {
        state.quizConfigs = [];
        state.quizError = getErrorMessage(error, 'Không tải được cấu hình trắc nghiệm của chương trình này.');
        syncDraftFromConfigs();
      } finally {
        state.quizLoading = false;
        renderView();
      }
    }

    async function loadAttempts(options = {}) {
      const preserveSelection = Boolean(options.preserveSelection);
      const keepModalOpen = Boolean(options.keepModalOpen);
      const previousSelectedAttemptId = state.selectedAttemptId;
      const previousModalOpen = state.isAttemptModalOpen;

      if (!preserveSelection) {
        state.attempts = [];
        state.attemptConfigs = [];
      }
      state.attemptsError = '';
      state.classQuizError = '';
      if (!preserveSelection) {
        state.attemptModalInfo = '';
        state.attemptModalError = '';
      }

      if (!preserveSelection) {
        state.selectedAttemptId = '';
        state.isAttemptModalOpen = false;
      }

      if (!state.selectedClassCode) {
        state.attemptsLoading = false;
        renderView();
        return;
      }

      state.attemptsLoading = true;
      renderView();

      try {
        const selectedClass = getSelectedClass(getQuizManageableClasses(state.classes), state.selectedClassCode);
        const selectedClassProgram = getClassProgram(selectedClass, state.programs);
        const [attempts, attemptConfigs] = await Promise.all([
          getQuizAttemptsByClass(state.selectedClassCode),
          selectedClassProgram ? listQuizConfigs(selectedClassProgram) : Promise.resolve([]),
        ]);

        state.attemptConfigs = attemptConfigs;
        state.attempts = attempts;

        if (preserveSelection) {
          const hasPreviousAttempt = attempts.some((attempt) => attempt.id === previousSelectedAttemptId);
          state.selectedAttemptId = hasPreviousAttempt ? previousSelectedAttemptId : '';
          state.isAttemptModalOpen = keepModalOpen && previousModalOpen && Boolean(state.selectedAttemptId);
        }
      } catch (error) {
        if (!preserveSelection) {
          state.attempts = [];
          state.attemptConfigs = [];
        }
        state.attemptsError = getErrorMessage(error, 'Không tải được danh sách bài nộp trắc nghiệm.');
      } finally {
        state.attemptsLoading = false;
        renderView();
      }
    }

    function updateQuestion(questionId, updater) {
      state.draft = {
        ...state.draft,
        questions: reindexQuestions(
          (state.draft.questions || []).map((question) =>
            question.id === questionId ? updater(question) : question,
          ),
        ),
      };
    }

    function addQuestion() {
      state.draft = {
        ...state.draft,
        questions: reindexQuestions([
          ...(state.draft.questions || []),
          createQuestionDraft((state.draft.questions || []).length + 1),
        ]),
      };
    }

    function removeQuestion(questionId) {
      state.draft = {
        ...state.draft,
        questions: reindexQuestions((state.draft.questions || []).filter((question) => question.id !== questionId)),
      };
    }

    function addOption(questionId) {
      updateQuestion(questionId, (question) => ({
        ...question,
        type: QUIZ_QUESTION_TYPE_SINGLE_CHOICE,
        options: reindexOptions([
          ...(question.options || []),
          createOptionDraft((question.options || []).length + 1),
        ]),
      }));
    }

    function removeOption(questionId, optionId) {
      updateQuestion(questionId, (question) => {
        const nextOptions = reindexOptions((question.options || []).filter((option) => option.id !== optionId));
        const nextCorrectOptionId =
          question.correctOptionId === optionId ? nextOptions[0]?.id || '' : question.correctOptionId;

        return {
          ...question,
          options: nextOptions,
          correctOptionId: nextCorrectOptionId,
        };
      });
    }

    function setQuestionType(questionId, nextType) {
      updateQuestion(questionId, (question) => {
        if (nextType === QUIZ_QUESTION_TYPE_FILL_BLANK) {
          return {
            ...question,
            type: QUIZ_QUESTION_TYPE_FILL_BLANK,
            correctOptionId: '',
            options: [],
          };
        }

        const nextOptions = ensureMinimumOptions(question.options || []);

        return {
          ...question,
          type: QUIZ_QUESTION_TYPE_SINGLE_CHOICE,
          acceptedAnswers: [],
          options: nextOptions,
          correctOptionId: nextOptions.some((option) => option.id === question.correctOptionId)
            ? question.correctOptionId
            : nextOptions[0]?.id || '',
        };
      });
    }

    const unsubscribePrograms = subscribeCurriculumPrograms(
      async (programs) => {
        state.programs = programs;

        if (!state.selectedProgramId || !programs.some((program) => program.id === state.selectedProgramId)) {
          state.selectedProgramId = programs[0]?.id || '';
          await loadQuizConfigs();
          return;
        }

        renderView();
      },
      (error) => {
        state.programs = [];
        state.quizLoading = false;
        state.quizError = getErrorMessage(error, 'Không tải được danh sách chương trình học.');
        renderView();
      },
    );

    const unsubscribeClasses = subscribeClasses(
      async (classes) => {
        state.classes = classes;
        const manageableClasses = getQuizManageableClasses(classes);

        if (
          !state.selectedClassCode
          || !manageableClasses.some((classItem) => classItem.classCode === state.selectedClassCode)
        ) {
          state.selectedClassCode = manageableClasses[0]?.classCode || '';
          await loadAttempts();
          return;
        }

        renderView();
      },
      (error) => {
        state.classes = [];
        state.attemptsLoading = false;
        state.attemptsError = getErrorMessage(error, 'Không tải được danh sách lớp học.');
        renderView();
      },
    );

    tabsSlot.addEventListener('click', (event) => {
      const tabButton = event.target.closest('[data-action="switch-quiz-tab"]');

      if (!tabButton) {
        return;
      }

      state.activeTab = tabButton.dataset.tabId === 'operations' ? 'operations' : 'editor';
      renderView();
    });

    editorSlot.addEventListener('change', async (event) => {
      const programSelect = event.target.closest('#quiz-program-select');
      const sessionSelect = event.target.closest('#quiz-session-select');
      const markdownImportInput = event.target.closest('#quiz-markdown-import-input');
      const questionImageInput = event.target.closest('#quiz-question-image-input');
      const questionImageField = event.target.closest('[data-field="image-url"], [data-field="image-alt"]');
      const questionTypeSelect = event.target.closest('[data-field="question-type"]');
      const difficultySelect = event.target.closest('[data-field="difficulty"]');
      const caseSensitiveInput = event.target.closest('[data-field="case-sensitive"]');
      const correctOptionInput = event.target.closest('[data-action="set-correct-option"]');

      if (programSelect) {
        state.selectedProgramId = programSelect.value || '';
        state.quizConfigs = [];
        await loadQuizConfigs();
        return;
      }

      if (sessionSelect) {
        state.selectedSessionNumber = Number(sessionSelect.value || QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS[0]);
        syncDraftFromConfigs();
        renderView();
        return;
      }

      if (markdownImportInput) {
        const [file] = Array.from(markdownImportInput.files || []);
        markdownImportInput.value = '';

        if (!file) {
          return;
        }

        state.isImportingMarkdown = true;
        state.quizError = '';
        renderView();

        try {
          const source = await file.text();
          state.markdownDraft = source;
          showToast({
            title: 'Đã nạp file markdown',
            message: `Nội dung từ file ${file.name} đã được đưa vào editor. Hãy kiểm tra lại rồi bấm "Áp dụng vào bộ đề".`,
            variant: 'success',
          });
        } catch (error) {
          state.quizError = getErrorMessage(error, 'Không thể đọc file markdown này.');
        } finally {
          state.isImportingMarkdown = false;
          renderView();
        }
        return;
      }

      if (questionImageInput) {
        const [file] = Array.from(questionImageInput.files || []);
        questionImageInput.value = '';

        if (!file || !pendingQuestionImageId) {
          pendingQuestionImageId = '';
          return;
        }

        state.uploadingQuestionId = pendingQuestionImageId;
        state.quizError = '';
        renderView();

        try {
          const uploadedImage = await uploadCurriculumLessonImage(file);
          updateQuestion(pendingQuestionImageId, (question) => ({
            ...question,
            imageUrl: uploadedImage.secureUrl,
            imageAlt: question.imageAlt || uploadedImage.alt || '',
          }));
          showToast({
            title: 'Đã tải ảnh lên',
            message: 'Ảnh minh họa đã được gắn vào câu hỏi.',
            variant: 'success',
          });
        } catch (error) {
          state.quizError = getErrorMessage(error, 'Không thể tải ảnh minh họa lúc này.');
        } finally {
          pendingQuestionImageId = '';
          state.uploadingQuestionId = '';
          renderView();
        }
        return;
      }

      if (questionImageField) {
        renderView();
        return;
      }

      if (questionTypeSelect) {
        setQuestionType(
          questionTypeSelect.dataset.questionId || '',
          questionTypeSelect.value === QUIZ_QUESTION_TYPE_FILL_BLANK
            ? QUIZ_QUESTION_TYPE_FILL_BLANK
            : QUIZ_QUESTION_TYPE_SINGLE_CHOICE,
        );
        renderView();
        return;
      }

      if (difficultySelect) {
        updateQuestion(difficultySelect.dataset.questionId || '', (question) => ({
          ...question,
          difficulty: QUIZ_DIFFICULTIES.includes(difficultySelect.value)
            ? difficultySelect.value
            : QUIZ_DIFFICULTY_MEDIUM,
        }));
        renderView();
        return;
      }

      if (caseSensitiveInput) {
        updateQuestion(caseSensitiveInput.dataset.questionId || '', (question) => ({
          ...question,
          caseSensitive: Boolean(caseSensitiveInput.checked),
        }));
        return;
      }

      if (correctOptionInput) {
        updateQuestion(correctOptionInput.dataset.questionId || '', (question) => ({
          ...question,
          correctOptionId: correctOptionInput.dataset.optionId || '',
        }));
        renderView();
      }
    });

    editorSlot.addEventListener('input', (event) => {
      const titleInput = event.target.closest('#quiz-title-input');
      const descriptionInput = event.target.closest('#quiz-description-input');
      const markdownTextarea = event.target.closest('#quiz-markdown-textarea');
      const promptInput = event.target.closest('[data-field="prompt"]');
      const imageUrlInput = event.target.closest('[data-field="image-url"]');
      const imageAltInput = event.target.closest('[data-field="image-alt"]');
      const blankPlaceholderInput = event.target.closest('[data-field="blank-placeholder"]');
      const acceptedAnswersInput = event.target.closest('[data-field="accepted-answers"]');
      const optionTextInput = event.target.closest('[data-field="option-text"]');

      if (titleInput) {
        state.draft = {
          ...state.draft,
          title: titleInput.value,
        };
        return;
      }

      if (descriptionInput) {
        state.draft = {
          ...state.draft,
          description: descriptionInput.value,
        };
        return;
      }

      if (markdownTextarea) {
        state.markdownDraft = markdownTextarea.value;
        return;
      }

      if (promptInput) {
        updateQuestion(promptInput.dataset.questionId || '', (question) => ({
          ...question,
          prompt: promptInput.value,
        }));
        return;
      }

      if (imageUrlInput) {
        updateQuestion(imageUrlInput.dataset.questionId || '', (question) => ({
          ...question,
          imageUrl: imageUrlInput.value,
        }));
        return;
      }

      if (imageAltInput) {
        updateQuestion(imageAltInput.dataset.questionId || '', (question) => ({
          ...question,
          imageAlt: imageAltInput.value,
        }));
        return;
      }

      if (blankPlaceholderInput) {
        updateQuestion(blankPlaceholderInput.dataset.questionId || '', (question) => ({
          ...question,
          blankPlaceholder: blankPlaceholderInput.value,
        }));
        return;
      }

      if (acceptedAnswersInput) {
        updateQuestion(acceptedAnswersInput.dataset.questionId || '', (question) => ({
          ...question,
          acceptedAnswers: parseAcceptedAnswersInput(acceptedAnswersInput.value),
        }));
        return;
      }

      if (optionTextInput) {
        updateQuestion(optionTextInput.dataset.questionId || '', (question) => ({
          ...question,
          options: reindexOptions(
            (question.options || []).map((option) =>
              option.id === optionTextInput.dataset.optionId
                ? {
                    ...option,
                    text: optionTextInput.value,
                  }
                : option,
            ),
          ),
        }));
      }
    });

    editorSlot.addEventListener('click', async (event) => {
      const sessionButton = event.target.closest('[data-action="select-session"]');
      const importMarkdownButton = event.target.closest('[data-action="import-quiz-markdown"]');
      const useSampleSetButton = event.target.closest('[data-action="use-quiz-sample-set"]');
      const useMarkdownTemplateButton = event.target.closest('[data-action="use-quiz-markdown-template"]');
      const applyMarkdownButton = event.target.closest('[data-action="apply-quiz-markdown"]');
      const clearMarkdownButton = event.target.closest('[data-action="clear-quiz-markdown"]');
      const addQuestionButton = event.target.closest('[data-action="add-question"]');
      const removeQuestionButton = event.target.closest('[data-action="remove-question"]');
      const pickQuestionImageButton = event.target.closest('[data-action="pick-question-image"]');
      const removeQuestionImageButton = event.target.closest('[data-action="remove-question-image"]');
      const addOptionButton = event.target.closest('[data-action="add-option"]');
      const removeOptionButton = event.target.closest('[data-action="remove-option"]');
      const saveQuizButton = event.target.closest('[data-action="save-quiz"]');

      if (sessionButton) {
        state.selectedSessionNumber = Number(
          sessionButton.dataset.sessionNumber || QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS[0],
        );
        syncDraftFromConfigs();
        renderView();
        return;
      }

      if (importMarkdownButton) {
        const fileInput = editorSlot.querySelector('#quiz-markdown-import-input');
        fileInput?.click();
        return;
      }

      if (useSampleSetButton) {
        const sampleSelect = editorSlot.querySelector('#quiz-sample-set-select');
        const sampleSet =
          QUIZ_MARKDOWN_SAMPLE_SETS.find((item) => item.id === sampleSelect?.value) ||
          QUIZ_MARKDOWN_SAMPLE_SETS[0];

        if (sampleSet) {
          state.markdownDraft = sampleSet.markdown;
          showToast({
            title: 'Đã đưa bộ mẫu vào editor',
            message: `${sampleSet.title} đã sẵn sàng để bạn kiểm tra và áp dụng vào bộ đề.`,
            variant: 'success',
          });
          renderView();
        }
        return;
      }

      if (useMarkdownTemplateButton) {
        state.markdownDraft = QUIZ_MARKDOWN_IMPORT_TEMPLATE;
        renderView();
        return;
      }

      if (clearMarkdownButton) {
        state.markdownDraft = '';
        renderView();
        return;
      }

      if (applyMarkdownButton) {
        if (!String(state.markdownDraft || '').trim()) {
          state.quizError = 'Hãy dán nội dung markdown vào editor trước khi áp dụng.';
          renderView();
          return;
        }

        state.isImportingMarkdown = true;
        state.quizError = '';
        renderView();

        try {
          const selectedProgram = state.programs.find((program) => program.id === state.selectedProgramId) || null;
          const importedDraft = parseQuizMarkdown(state.markdownDraft, {
            sessionNumber: state.selectedSessionNumber,
            subject: selectedProgram?.subject || '',
            level: selectedProgram?.level || '',
          });
          state.draft = mergeImportedQuizDraft(state.draft, importedDraft, state.selectedSessionNumber, selectedProgram);
          state.markdownDraft = '';
          showToast({
            title: 'Đã áp dụng markdown',
            message: `Đã thêm ${importedDraft.questions.length} câu hỏi vào bộ đề hiện tại.`,
            variant: 'success',
          });
        } catch (error) {
          state.quizError = getErrorMessage(error, 'Không thể phân tích nội dung markdown này.');
        } finally {
          state.isImportingMarkdown = false;
          renderView();
        }
        return;
      }

      if (addQuestionButton) {
        addQuestion();
        renderView();
        return;
      }

      if (removeQuestionButton) {
        removeQuestion(removeQuestionButton.dataset.questionId || '');
        renderView();
        return;
      }

      if (pickQuestionImageButton) {
        if (!isCloudinaryConfigured()) {
          state.quizError = 'Cloudinary chưa được cấu hình cho môi trường này. Hãy dán URL ảnh thủ công.';
          renderView();
          return;
        }

        pendingQuestionImageId = pickQuestionImageButton.dataset.questionId || '';
        const fileInput = editorSlot.querySelector('#quiz-question-image-input');
        fileInput?.click();
        return;
      }

      if (removeQuestionImageButton) {
        updateQuestion(removeQuestionImageButton.dataset.questionId || '', (question) => ({
          ...question,
          imageUrl: '',
          imageAlt: '',
        }));
        renderView();
        return;
      }

      if (addOptionButton) {
        addOption(addOptionButton.dataset.questionId || '');
        renderView();
        return;
      }

      if (removeOptionButton) {
        removeOption(removeOptionButton.dataset.questionId || '', removeOptionButton.dataset.optionId || '');
        renderView();
        return;
      }

      if (saveQuizButton) {
        state.isSavingQuiz = true;
        state.quizError = '';
        renderView();

        try {
          const selectedProgram = state.programs.find((program) => program.id === state.selectedProgramId) || null;

          if (!selectedProgram) {
            throw new Error('Hãy chọn chương trình trước khi lưu đề.');
          }

          const payload = normalizeQuizConfigRecord(
            {
              ...state.draft,
              sessionNumber: state.selectedSessionNumber,
              quizMode: QUIZ_MODE_OFFICIAL,
              subject: selectedProgram.subject || state.draft.subject || '',
              level: selectedProgram.level || state.draft.level || '',
              questionPickPolicy: state.draft.questionPickPolicy || QUIZ_DEFAULT_PICK_POLICY,
            },
            state.selectedSessionNumber,
            selectedProgram,
          );

          validateQuizConfigRecord(payload);
          await saveQuizConfig(selectedProgram, payload);
          showToast({
            title: 'Đã lưu đề',
            message: `Cấu hình trắc nghiệm buổi ${state.selectedSessionNumber} đã được cập nhật.`,
            variant: 'success',
          });
          await loadQuizConfigs();
        } catch (error) {
          state.quizError = getErrorMessage(error, 'Không thể lưu cấu hình bài kiểm tra.');
          renderView();
        } finally {
          state.isSavingQuiz = false;
          renderView();
        }
      }
    });

    launchControlSlot.addEventListener('click', async (event) => {
      const startButton = event.target.closest('[data-action="start-class-quiz"]');
      const stopButton = event.target.closest('[data-action="stop-class-quiz"]');
      const selectedClass = getSelectedClass(getQuizManageableClasses(state.classes), state.selectedClassCode);
      const currentSession = Number(selectedClass?.curriculumCurrentSession || 0);
      const currentQuizConfig = getSelectedClassQuizConfig(
        selectedClass,
        getActiveQuizConfigsForClass(selectedClass, state.quizConfigs, state.attemptConfigs, state.selectedProgramId),
      );

      if (!startButton && !stopButton) {
        return;
      }

      const sessionActivity = getClassQuizActivity(selectedClass, state.programs);

      if (!selectedClass || !isCurriculumQuizActivity(sessionActivity?.activityType)) {
        state.classQuizError = 'Lớp này hiện chưa được cấu hình là buổi quiz hợp lệ.';
        renderView();
        return;
      }

      const readiness = currentQuizConfig ? getQuizReadiness(currentQuizConfig) : null;

      if (!currentQuizConfig || !readiness?.isReady) {
        state.classQuizError = currentQuizConfig
          ? `Ngân hàng câu hỏi chưa đủ theo tỉ lệ 4 dễ, 4 trung bình, 2 khó. ${formatQuizReadinessRequirement(readiness)}`
          : 'Chưa có ngân hàng câu hỏi cho lớp và buổi hiện tại.';
        renderView();
        return;
      }

      state.isUpdatingClassQuiz = true;
      state.classQuizError = '';
      renderView();

      try {
        const nextIsStarted = Boolean(startButton);
        await setClassQuizStatus(state.selectedClassCode, {
          sessionNumber: currentSession,
          quizMode: QUIZ_MODE_OFFICIAL,
          isStarted: nextIsStarted,
        });
        state.classes = state.classes.map((classItem) =>
          classItem.classCode === state.selectedClassCode
            ? {
                ...classItem,
                activeQuizSessionNumber: nextIsStarted ? currentSession : 0,
                activeQuizMode: QUIZ_MODE_OFFICIAL,
                quizStatus: nextIsStarted ? QUIZ_CLASS_STATUS_STARTED : 'idle',
              }
            : classItem,
        );
        showToast({
          title: nextIsStarted ? 'Đã bắt đầu bài kiểm tra' : 'Đã kết thúc bài kiểm tra',
          message: nextIsStarted
            ? 'Học sinh trong lớp này bây giờ có thể vào làm bài.'
            : 'Đề đã được ẩn khỏi phía học sinh.',
          variant: 'success',
        });
      } catch (error) {
        state.classQuizError = getErrorMessage(
          error,
          startButton ? 'Không thể bắt đầu bài kiểm tra lúc này.' : 'Không thể kết thúc bài kiểm tra lúc này.',
        );
      } finally {
        state.isUpdatingClassQuiz = false;
        renderView();
      }
    });

    attemptListSlot.addEventListener('change', async (event) => {
      const classSelect = event.target.closest('#quiz-attempt-class-select');
      const sessionFilterSelect = event.target.closest('#quiz-attempt-session-filter');

      if (classSelect) {
        state.selectedClassCode = classSelect.value || '';
        state.selectedAttemptId = '';
        state.isAttemptModalOpen = false;
        state.attemptModalInfo = '';
        state.attemptModalError = '';
        await loadAttempts();
        return;
      }

      if (sessionFilterSelect) {
        state.selectedSessionFilter = sessionFilterSelect.value || 'all';
        state.selectedAttemptId = '';
        state.isAttemptModalOpen = false;
        state.attemptModalInfo = '';
        state.attemptModalError = '';
        renderView();
      }
    });

    attemptListSlot.addEventListener('click', (event) => {
      const openAttemptButton = event.target.closest('[data-action="open-attempt-modal"]');

      if (!openAttemptButton) {
        return;
      }

      state.selectedAttemptId = openAttemptButton.dataset.attemptId || '';
      state.isAttemptModalOpen = Boolean(state.selectedAttemptId);
      state.attemptModalInfo = '';
      state.attemptModalError = '';
      renderView();
    });

    attemptModalSlot.addEventListener('click', async (event) => {
      const closeButton = event.target.closest('[data-action="close-attempt-modal"]');
      const modalBackdrop = attemptModalSlot.firstElementChild;

      if (closeButton || (modalBackdrop && event.target === modalBackdrop)) {
        state.isAttemptModalOpen = false;
        state.attemptModalInfo = '';
        state.attemptModalError = '';
        state.reopeningAttemptId = '';
        renderView();
        return;
      }

      const reopenButton = event.target.closest('[data-action="reopen-attempt"]');

      if (!reopenButton) {
        return;
      }

      const attemptId = reopenButton.dataset.attemptId || '';
      const classCode = reopenButton.dataset.classCode || '';
      const studentId = reopenButton.dataset.studentId || '';
      const sessionNumber = Number(reopenButton.dataset.sessionNumber || 0);
      const quizMode = reopenButton.dataset.quizMode || QUIZ_MODE_OFFICIAL;

      if (!attemptId || state.reopeningAttemptId) {
        return;
      }

      state.reopeningAttemptId = attemptId;
      state.attemptModalInfo = 'Đang gửi lệnh mở lại cho học sinh...';
      state.attemptModalError = '';
      renderView();

      try {
        await reopenQuizAttempt({
          attemptId,
          classCode,
          studentId,
          sessionNumber,
          quizMode,
        });
        markAttemptAsReopened(attemptId);
        state.attemptModalInfo = 'Đã ghi nhận lệnh mở lại. Đang đồng bộ trạng thái mới nhất...';
        renderView();
        await loadAttempts({ preserveSelection: true, keepModalOpen: true });
        const refreshedAttempt = state.attempts.find((attempt) => attempt.id === attemptId) || null;
        state.reopeningAttemptId = '';
        state.attemptModalInfo =
          refreshedAttempt?.status === QUIZ_ATTEMPT_STATUS_REOPENED
            ? 'Học sinh này đã được mở lại và có thể vào làm lại ngay bây giờ.'
            : 'Đã gửi lệnh mở lại, nhưng chưa thấy trạng thái mới sau khi đồng bộ. Bạn nên tải lại danh sách một lần.';
        showToast({
          title: 'Đã mở lại lượt làm',
          message: state.attemptModalInfo,
          variant: refreshedAttempt?.status === QUIZ_ATTEMPT_STATUS_REOPENED ? 'success' : 'warning',
        });
        renderView();
      } catch (error) {
        state.reopeningAttemptId = '';
        state.attemptModalInfo = '';
        state.attemptModalError = getErrorMessage(error, 'Không thể mở lại lượt làm lúc này.');
        showToast({
          title: 'Chưa mở lại được',
          message: state.attemptModalError,
          variant: 'danger',
        });
        renderView();
      }
    });

    renderView();

    return () => {
      unsubscribePrograms?.();
      unsubscribeClasses?.();
    };
}

