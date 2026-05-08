import { escapeHtml } from '../../utils/html.js';
import { isFillBlankQuestion, isQuizQuestionAnswered } from '../../utils/quiz.js';

function clampQuestionIndex(questionCount, questionIndex) {
  if (questionCount <= 0) {
    return 0;
  }

  return Math.min(Math.max(0, Number(questionIndex || 0)), questionCount - 1);
}

function countAnsweredQuestions(quiz, answers = {}) {
  return (quiz?.questions || []).filter((question) =>
    isQuizQuestionAnswered(question, answers[question.id]),
  ).length;
}

function renderMultilineText(value) {
  return escapeHtml(String(value ?? '').trim()).replaceAll('\n', '<br>');
}

function renderQuestionImage(question) {
  if (!question?.imageUrl) {
    return '';
  }

  return `
    <figure class="quiz-question-media">
      <img
        src="${escapeHtml(question.imageUrl)}"
        alt="${escapeHtml(question.imageAlt || question.prompt || 'Minh họa câu hỏi')}"
        class="quiz-question-media__image"
        loading="lazy"
      />
    </figure>
  `;
}

function renderAnswerInput(question, answerValue, disabledAttr) {
  if (isFillBlankQuestion(question)) {
    return `
      <div class="quiz-blank-answer">
        <label class="form-label fw-semibold" for="quiz-answer-${escapeHtml(question.id)}">Câu trả lời của bạn</label>
        <input
          id="quiz-answer-${escapeHtml(question.id)}"
          type="text"
          class="form-control form-control-lg"
          value="${escapeHtml(answerValue || '')}"
          placeholder="${escapeHtml(question.blankPlaceholder || 'Nhập câu trả lời')}"
          data-question-id="${escapeHtml(question.id)}"
          data-answer-kind="blank"
          ${disabledAttr}
        />
      </div>
    `;
  }

  const selectedOptionId = String(answerValue ?? '').trim();

  return `
    <div class="quiz-option-list">
      ${(question.options || [])
        .map(
          (option) => `
            <label class="quiz-option ${selectedOptionId === option.id ? 'quiz-option--selected' : ''}">
              <input
                type="radio"
                class="form-check-input mt-0"
                name="question-${escapeHtml(question.id)}"
                value="${escapeHtml(option.id)}"
                data-question-id="${escapeHtml(question.id)}"
                data-answer-kind="choice"
                ${selectedOptionId === option.id ? 'checked' : ''}
                ${disabledAttr}
              />
              <span>${renderMultilineText(option.text)}</span>
            </label>
          `,
        )
        .join('')}
    </div>
  `;
}

export function renderQuizForm(
  quiz,
  answers = {},
  errors = {},
  {
    disabled = false,
    helperText = '',
    submitLabel = 'Nộp bài kiểm tra',
    currentQuestionIndex = 0,
  } = {},
) {
  const disabledAttr = disabled ? 'disabled' : '';
  const helperMarkup = helperText ? `<p class="text-secondary small mb-4">${escapeHtml(helperText)}</p>` : '';
  const questionCount = Number(quiz?.questionCount || (quiz?.questions || []).length || 0);
  const activeIndex = clampQuestionIndex(questionCount, currentQuestionIndex);
  const currentQuestion = quiz?.questions?.[activeIndex] || null;
  const currentAnswerValue = currentQuestion ? answers[currentQuestion.id] : '';
  const answeredCount = countAnsweredQuestions(quiz, answers);
  const isLastQuestion = activeIndex >= questionCount - 1;

  return `
    <form id="student-quiz-form" class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start mb-3">
          <div>
            <div class="small text-secondary mb-1">Quiz buổi ${Number(quiz?.sessionNumber || 0)}</div>
            <h2 class="h4 mb-2">${escapeHtml(quiz?.title || 'Bài kiểm tra')}</h2>
            ${
              quiz?.description
                ? `<p class="text-secondary mb-0">${renderMultilineText(quiz.description)}</p>`
                : ''
            }
          </div>
          <div class="d-grid gap-2">
            <span class="badge bg-white text-dark border">${questionCount} câu</span>
            <span class="badge text-bg-light text-dark border">Đã trả lời ${answeredCount}/${questionCount}</span>
          </div>
        </div>
        ${helperMarkup}
        ${
          currentQuestion
            ? `
              <div class="quiz-status-meta mb-4">
                <div class="quiz-status-meta__label">Tiến độ</div>
                <div class="fw-semibold">Câu ${activeIndex + 1} / ${questionCount}</div>
              </div>
              <section class="quiz-question-card">
                <div class="quiz-question-card__head">
                  <div class="d-flex flex-wrap justify-content-between gap-2 align-items-start">
                    <span class="badge text-bg-light text-dark border">Câu ${activeIndex + 1}</span>
                    <span class="badge bg-white text-dark border">
                      ${isFillBlankQuestion(currentQuestion) ? 'Điền vào chỗ trống' : 'Chọn 1 đáp án'}
                    </span>
                  </div>
                  <div class="fw-semibold">${renderMultilineText(currentQuestion.prompt)}</div>
                  ${renderQuestionImage(currentQuestion)}
                </div>
                ${renderAnswerInput(currentQuestion, currentAnswerValue, disabledAttr)}
                ${
                  errors[currentQuestion.id]
                    ? `<div class="text-danger small mt-2">${escapeHtml(errors[currentQuestion.id])}</div>`
                    : ''
                }
              </section>
            `
            : '<div class="text-secondary">Chưa có câu hỏi để hiển thị.</div>'
        }
      </div>
      <div class="card-footer bg-white border-0 pt-0 pb-4 px-4">
        <div class="d-flex flex-wrap justify-content-between gap-2">
          <button
            type="button"
            class="btn btn-outline-secondary"
            data-action="previous-question"
            ${activeIndex <= 0 || disabled ? 'disabled' : ''}
          >
            <i class="bi bi-arrow-left me-2"></i>Câu trước
          </button>
          ${
            isLastQuestion
              ? `
                <button type="submit" class="btn btn-primary px-4" ${disabledAttr}>
                  <i class="bi bi-send-check me-2"></i>${escapeHtml(submitLabel)}
                </button>
              `
              : `
                <button
                  type="button"
                  class="btn btn-primary px-4"
                  data-action="next-question"
                  ${disabled ? 'disabled' : ''}
                >
                  Câu tiếp theo<i class="bi bi-arrow-right ms-2"></i>
                </button>
              `
          }
        </div>
      </div>
    </form>
  `;
}
