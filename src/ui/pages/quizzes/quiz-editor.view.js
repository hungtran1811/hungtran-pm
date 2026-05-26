import {
  getCurriculumActivityTypeLabel,
  getCurriculumSessionActivities,
  getCurriculumSessionActivity,
} from '../../../utils/curriculum-program.js';
import { escapeHtml } from '../../../utils/html.js';
import {
  formatQuizReadinessRequirement,
  getQuizDifficultyCounts,
  getQuizDifficultyLabel,
  getQuizQuestionTypeLabel,
  getQuizReadiness,
  isFillBlankQuestion,
  QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS,
  QUIZ_DIFFICULTIES,
  QUIZ_MODE_OFFICIAL,
  QUIZ_QUESTION_TYPES,
} from '../../../utils/quiz.js';
import { hasQuizSampleSet } from '../../../utils/quiz-samples.js';
import { renderAlert } from '../../components/Alert.js';
import { renderEmptyState } from '../../components/EmptyState.js';
import { renderLoadingOverlay } from '../../components/LoadingOverlay.js';

export function getProgramSessionOptions(program) {
  if (!program) {
    return QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS.map((sessionNumber) => ({
      sessionNumber,
      activityType: QUIZ_MODE_OFFICIAL,
    }));
  }

  return getCurriculumSessionActivities(program).map((session) => ({
    sessionNumber: Number(session.sessionNumber || 0),
    activityType: session.activityType,
  }));
}

function stringifyAcceptedAnswers(acceptedAnswers = []) {
  return Array.isArray(acceptedAnswers) ? acceptedAnswers.join('\n') : '';
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

export function renderQuizEditor({
  programs,
  selectedProgramId,
  selectedSessionNumber,
  selectedProgram,
  draft,
  isLoading,
  isSaving,
  uploadingQuestionId,
  imageUploadEnabled,
  error,
  contextLocked = false,
}) {
  if (!programs.length) {
    return renderEmptyState({
      icon: 'patch-question',
      title: 'Chưa có chương trình để gắn đề',
      description: 'Hãy tạo hoặc kích hoạt ít nhất một chương trình học trước khi cấu hình bài trắc nghiệm.',
    });
  }

  const questionActionDisabled = isLoading || isSaving || Boolean(uploadingQuestionId);
  const sessionOptions = getProgramSessionOptions(selectedProgram);
  const selectedSessionActivity = selectedProgram
    ? getCurriculumSessionActivity(selectedProgram, selectedSessionNumber)
    : null;
  const selectedActivityLabel = selectedSessionActivity
    ? getCurriculumActivityTypeLabel(selectedSessionActivity.activityType)
    : 'Kiểm tra';
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
  const hasSample = hasQuizSampleSet(scopeSubject, selectedSessionNumber);

  return `
    <div class="card border-0 shadow-sm h-100 quiz-editor-card">
      <div class="card-header bg-white border-0 quiz-editor-card__header">
        <div>
          <h2 class="h5 mb-0">Cấu hình đề trắc nghiệm</h2>
          <div class="quiz-editor-context mt-2">
            <span><i class="bi bi-journal-code me-1"></i>${escapeHtml(selectedProgram?.name || 'Chưa chọn chương trình')}</span>
            <span>${escapeHtml(scopeSubject)} · ${escapeHtml(scopeLevel)}</span>
            <span>Buổi ${Number(selectedSessionNumber || 0)}</span>
            <span>${escapeHtml(selectedActivityLabel)}</span>
          </div>
        </div>
      </div>
      <div class="card-body">
        ${error ? `<div class="mb-3">${renderAlert(escapeHtml(error), 'danger')}</div>` : ''}
        <div class="quiz-editor-setup ${contextLocked ? 'quiz-editor-setup--locked' : ''}">
          ${
            contextLocked
              ? ''
              : `
                <div class="quiz-editor-setup__source">
                  <label class="form-label">Chương trình nguồn</label>
                  <select class="form-select form-select-sm" id="quiz-program-select" ${isLoading ? 'disabled' : ''}>
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
              `
          }
          <div class="quiz-editor-setup__title">
            <label class="form-label">Tiêu đề</label>
            <input class="form-control form-control-sm" id="quiz-title-input" value="${escapeHtml(draft?.title || '')}" ${isLoading ? 'disabled' : ''} />
          </div>
          ${
            contextLocked
              ? ''
              : `
                <div class="quiz-editor-setup__session">
                  <label class="form-label">Buổi</label>
                  <select class="form-select form-select-sm" id="quiz-session-select" ${isLoading ? 'disabled' : ''}>
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
                </div>
              `
          }
          <div class="quiz-editor-setup__description">
            <label class="form-label">Mô tả ngắn</label>
            <textarea class="form-control form-control-sm" id="quiz-description-input" rows="2" ${isLoading ? 'disabled' : ''}>${escapeHtml(
              draft?.description || '',
            )}</textarea>
          </div>
        </div>
        <div class="quiz-editor-readiness ${readiness.isReady ? 'quiz-editor-readiness--ready' : 'quiz-editor-readiness--warning'}">
          <div>
            <div class="quiz-editor-readiness__label">Ngân hàng</div>
            <div class="fw-semibold">${escapeHtml(scopeSubject)} · ${escapeHtml(scopeLevel)} · Buổi ${Number(selectedSessionNumber || 0)}</div>
          </div>
          <div>
            <div class="quiz-editor-readiness__label">Tỉ lệ cần</div>
            <div class="fw-semibold">${escapeHtml(policySummary)}</div>
          </div>
          <div>
            <div class="quiz-editor-readiness__label">Hiện có</div>
            <div class="fw-semibold">${escapeHtml(countSummary)}</div>
          </div>
          <div class="quiz-editor-readiness__status">
            ${
              readiness.isReady
                ? '<i class="bi bi-check-circle-fill me-1"></i>Đủ điều kiện'
                : `<i class="bi bi-exclamation-triangle-fill me-1"></i>${escapeHtml(formatQuizReadinessRequirement(readiness))}`
            }
          </div>
        </div>
        <input type="file" id="quiz-question-image-input" class="d-none" accept="image/*" />
        <hr class="my-4">
        <div class="d-flex flex-wrap justify-content-between gap-3 align-items-center mb-3">
          <div>
            <h3 class="h6 mb-1">Danh sách câu hỏi</h3>
            <div class="small text-secondary">Hỗ trợ trắc nghiệm 1 đáp án đúng và điền vào chỗ trống. Cần đủ ${escapeHtml(policySummary)} để mở kiểm tra.</div>
          </div>
          <button type="button" class="btn btn-outline-primary" data-action="add-question" ${questionActionDisabled ? 'disabled' : ''}>
            <i class="bi bi-plus-circle me-2"></i>Thêm câu hỏi
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary"
            data-action="use-quiz-sample"
            ${questionActionDisabled || !hasSample ? 'disabled' : ''}
            title="${hasSample ? 'Nạp bộ đề mẫu vào editor hiện tại' : 'Chưa có bộ đề mẫu cho môn và buổi này'}"
          >
            <i class="bi bi-stars me-2"></i>Dùng bộ mẫu
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
          ${isSaving || Boolean(uploadingQuestionId) ? 'disabled' : ''}
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
