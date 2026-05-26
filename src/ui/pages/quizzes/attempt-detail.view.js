import { formatDateTime } from '../../../utils/date.js';
import { escapeHtml, nl2br, renderTextWithCodeBlocks } from '../../../utils/html.js';
import {
  getQuizQuestionTypeLabel,
  QUIZ_ATTEMPT_STATUS_REOPENED,
  QUIZ_MODE_OFFICIAL,
  QUIZ_QUESTION_TYPE_FILL_BLANK,
} from '../../../utils/quiz.js';
import { renderEmptyState } from '../../components/EmptyState.js';
import {
  buildQuestionComparisonRows,
  getAttemptSubmissionHistory,
  getBestAttemptSubmission,
  getLatestAttemptSubmission,
} from './attempt-grading.js';
import {
  getAttemptSourceBadge,
  getAttemptStatusBadge,
  getAttemptStatusMeta,
  hasAttemptRetakeAfterReopen,
  renderAttemptScore,
} from './attempt-status.view.js';

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
            ${getAttemptSourceBadge(attempt)}
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
          attempt.source === 'admin-preview'
            ? `
              <div class="alert alert-info" role="alert">
                Lượt này được ghi từ màn Admin review${attempt.submittedBy ? ` bởi ${escapeHtml(attempt.submittedBy)}` : ''}.
              </div>
            `
            : ''
        }
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
                      <div class="fw-semibold">${renderTextWithCodeBlocks(question.prompt)}</div>
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

export function renderAttemptDetailModal(attempt, isOpen = false, options = {}) {
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
