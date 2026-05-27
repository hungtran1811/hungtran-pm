import { escapeHtml, renderInlineRichText, renderTextWithCodeBlocks } from '../../utils/html.js';
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

function getOptionLetter(index) {
  return String.fromCharCode(65 + Number(index || 0));
}

function formatTimer(ms = 0) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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

function renderQuestionMap(quiz, answers, activeIndex) {
  const questions = quiz?.questions || [];

  if (questions.length <= 0) {
    return '';
  }

  return `
    <aside class="student-quiz-map-panel" aria-label="Bản đồ câu hỏi">
      <div class="student-quiz-map-panel__top">
        <div>
          <div class="student-quiz-map-panel__label">Question map</div>
          <strong>${countAnsweredQuestions(quiz, answers)} / ${questions.length}</strong>
        </div>
        <span>đã trả lời</span>
      </div>
      <div class="student-quiz-map-grid">
        ${questions
          .map((question, index) => {
            const isAnswered = isQuizQuestionAnswered(question, answers[question.id]);
            const classes = [
              'student-quiz-map-button',
              index === activeIndex ? 'student-quiz-map-button--current' : '',
              isAnswered ? 'student-quiz-map-button--answered' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return `
              <button
                type="button"
                class="${classes}"
                data-action="go-to-question"
                data-question-index="${index}"
                aria-label="Câu ${index + 1}${isAnswered ? ' đã trả lời' : ' chưa trả lời'}"
              >
                ${index + 1}
              </button>
            `;
          })
          .join('')}
      </div>
      <div class="student-quiz-map-legend">
        <span><i class="student-quiz-map-legend__box student-quiz-map-legend__box--answered"></i>Đã trả lời</span>
        <span><i class="student-quiz-map-legend__box student-quiz-map-legend__box--current"></i>Đang làm</span>
        <span><i class="student-quiz-map-legend__box"></i>Chưa trả lời</span>
      </div>
    </aside>
  `;
}

function renderAnswerInput(question, answerValue, disabledAttr) {
  if (isFillBlankQuestion(question)) {
    return `
      <div class="quiz-blank-answer">
        <label class="form-label fw-semibold" for="quiz-answer-${escapeHtml(question.id)}">
          Câu trả lời của bạn
        </label>
        <input
          id="quiz-answer-${escapeHtml(question.id)}"
          type="text"
          class="form-control form-control-lg quiz-blank-answer__input"
          value="${escapeHtml(answerValue || '')}"
          placeholder="${escapeHtml(question.blankPlaceholder || 'Nhập câu trả lời')}"
          data-question-id="${escapeHtml(question.id)}"
          data-answer-kind="blank"
          autocomplete="off"
          ${disabledAttr}
        />
      </div>
    `;
  }

  const selectedOptionId = String(answerValue ?? '').trim();

  return `
    <div class="quiz-option-list">
      ${(question.options || [])
        .map((option, index) => {
          const isSelected = selectedOptionId === option.id;

          return `
            <label class="quiz-option ${isSelected ? 'quiz-option--selected' : ''} ${disabledAttr ? 'quiz-option--disabled' : ''}">
              <input
                type="radio"
                class="form-check-input mt-0"
                name="question-${escapeHtml(question.id)}"
                value="${escapeHtml(option.id)}"
                data-question-id="${escapeHtml(question.id)}"
                data-answer-kind="choice"
                ${isSelected ? 'checked' : ''}
                ${disabledAttr}
              />
              <span class="quiz-option__letter">${getOptionLetter(index)}</span>
              <span class="quiz-option__content">${renderInlineRichText(option.text)}</span>
            </label>
          `;
        })
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
    layout = 'standard',
    timeRemainingMs = null,
  } = {},
) {
  const disabledAttr = disabled ? 'disabled' : '';
  const questionCount = Number((quiz?.questions || []).length || quiz?.questionCount || 0);
  const activeIndex = clampQuestionIndex(questionCount, currentQuestionIndex);
  const currentQuestion = quiz?.questions?.[activeIndex] || null;
  const currentAnswerValue = currentQuestion ? answers[currentQuestion.id] : '';
  const answeredCount = countAnsweredQuestions(quiz, answers);
  const progressPercent = questionCount > 0 ? Math.round((answeredCount / questionCount) * 100) : 0;
  const isLastQuestion = activeIndex >= questionCount - 1;
  const sessionNumber = Number(quiz?.sessionNumber || 0);
  const isAssessment = layout === 'assessment';
  const remainingMs = Number(timeRemainingMs ?? 0);

  return `
    <form
      id="student-quiz-form"
      class="student-quiz-card ${isAssessment ? 'student-quiz-card--assessment' : ''}"
      style="--quiz-progress: ${progressPercent}%;"
    >
      <div class="student-quiz-card__header">
        <div>
          <div class="student-quiz-eyebrow">Kiểm tra buổi ${sessionNumber || '?'}</div>
          <h2 class="student-quiz-title">${escapeHtml(quiz?.title || 'Bài kiểm tra')}</h2>
          ${
            quiz?.description
              ? `<p class="student-quiz-description">${renderInlineRichText(quiz.description)}</p>`
              : ''
          }
        </div>
        <div class="student-quiz-summary" aria-label="Tổng quan bài làm">
          <span>Câu ${activeIndex + 1} / ${questionCount}</span>
          ${
            isAssessment
              ? `
                <strong
                  class="student-quiz-timer__value ${remainingMs <= 60_000 ? 'student-quiz-timer__value--danger' : ''}"
                  data-quiz-timer
                >
                  ${formatTimer(remainingMs)}
                </strong>
              `
              : `<strong>${answeredCount}/${questionCount}</strong>`
          }
        </div>
      </div>

      <div class="student-quiz-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${questionCount}" aria-valuenow="${answeredCount}">
        <div class="student-quiz-progress__track">
          <div class="student-quiz-progress__bar"></div>
        </div>
      </div>

      ${helperText ? `<p class="student-quiz-helper">${escapeHtml(helperText)}</p>` : ''}

      <div class="${isAssessment ? 'student-quiz-assessment-grid' : ''}">
        <div class="student-quiz-assessment-main">
          ${
            currentQuestion
              ? `
                <section class="student-quiz-question quiz-question-card" data-question-index="${activeIndex}">
                  <div class="student-quiz-question__top">
                    <span class="student-quiz-question__number">Câu ${activeIndex + 1}</span>
                    <span class="student-quiz-question__type">
                      ${isFillBlankQuestion(currentQuestion) ? 'Điền vào chỗ trống' : 'Chọn 1 đáp án'}
                    </span>
                  </div>
                  <div class="student-quiz-question__prompt">${renderTextWithCodeBlocks(currentQuestion.prompt)}</div>
                  ${renderQuestionImage(currentQuestion)}
                  ${renderAnswerInput(currentQuestion, currentAnswerValue, disabledAttr)}
                  ${
                    errors[currentQuestion.id]
                      ? `<div class="student-quiz-error">${escapeHtml(errors[currentQuestion.id])}</div>`
                      : ''
                  }
                </section>
              `
              : '<div class="student-quiz-empty">Chưa có câu hỏi để hiển thị.</div>'
          }
        </div>
        ${isAssessment ? renderQuestionMap(quiz, answers, activeIndex) : ''}
      </div>

      <div class="student-quiz-card__footer">
        <button
          type="button"
          class="btn btn-outline-secondary student-quiz-nav-button"
          data-action="previous-question"
          ${activeIndex <= 0 || disabled ? 'disabled' : ''}
        >
          <i class="bi bi-arrow-left me-2"></i>Câu trước
        </button>
        ${
          isLastQuestion
            ? `
              <button type="submit" class="btn btn-primary student-quiz-submit-button" ${disabledAttr}>
                <i class="bi bi-send-check me-2"></i>${escapeHtml(submitLabel)}
              </button>
            `
            : `
              <button
                type="button"
                class="btn btn-primary student-quiz-nav-button"
                data-action="next-question"
                ${disabled ? 'disabled' : ''}
              >
                Câu tiếp theo<i class="bi bi-arrow-right ms-2"></i>
              </button>
            `
        }
      </div>
    </form>
  `;
}
