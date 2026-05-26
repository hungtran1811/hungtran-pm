import {
  isQuizBlankAnswerCorrect,
  QUIZ_DIFFICULTY_MEDIUM,
  QUIZ_QUESTION_TYPE_FILL_BLANK,
  QUIZ_QUESTION_TYPE_SINGLE_CHOICE,
} from '../../../utils/quiz.js';

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

export function decorateAttemptByBestScore(attempt, quizConfigs = []) {
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

export function buildQuestionComparisonRows(submissionHistory = []) {
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

export function getAttemptSubmissionHistory(attempt) {
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

export function getLatestAttemptSubmission(attempt) {
  const submissionHistory = getAttemptSubmissionHistory(attempt);
  return submissionHistory[submissionHistory.length - 1] || null;
}

export function getBestAttemptSubmission(attempt) {
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

export function buildAttemptReportSummary(attempts = []) {
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
