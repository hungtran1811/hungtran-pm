import {
  getCurriculumProgram,
  listCurriculumPrograms,
} from '../../services/curriculum.service.js';
import { listQuizConfigs } from '../../services/quizzes.service.js';
import {
  getCurriculumActivityTypeLabel,
  getCurriculumSessionActivities,
  getCurriculumSessionActivity,
} from '../../utils/curriculum-program.js';
import { escapeHtml } from '../../utils/html.js';
import {
  buildStudentQuizVariant,
  formatQuizReadinessRequirement,
  getQuizReadiness,
  getQuizQuestionTypeLabel,
  isFillBlankQuestion,
  isQuizBlankAnswerCorrect,
  QUIZ_QUESTION_LIMIT,
  validateQuizAnswerMap,
} from '../../utils/quiz.js';
import {
  buildAdminLessonPreviewPath,
  buildAdminQuizPreviewPath,
  getHashRouteState,
} from '../../utils/route.js';
import { renderAlert } from '../components/Alert.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderQuizForm } from '../components/QuizForm.js';
import { showToast } from '../components/ToastStack.js';

function resolveSessionNumber(program, requestedSessionNumber) {
  const sessions = getCurriculumSessionActivities(program);
  const requested = Number(requestedSessionNumber || 0);

  if (sessions.some((item) => item.sessionNumber === requested)) {
    return requested;
  }

  return sessions[0]?.sessionNumber || 1;
}

function renderMultilineText(value) {
  return escapeHtml(String(value ?? '').trim()).replaceAll('\n', '<br>');
}

function renderProgramShortcutList(programs = []) {
  if (!programs.length) {
    return renderEmptyState({
      icon: 'diagram-3',
      title: 'Chưa có chương trình học',
      description: 'Hãy tạo hoặc seed chương trình học trước khi dùng đường dẫn test quiz admin.',
    });
  }

  return `
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white border-0">
        <h2 class="h5 mb-1">Chọn chương trình để làm thử quiz</h2>
        <p class="text-secondary mb-0">Trang này chỉ dành cho admin, không cần mã lớp hoặc học sinh.</p>
      </div>
      <div class="card-body">
        <div class="row g-3">
          ${programs
            .map((program) => {
              const firstSession = getCurriculumSessionActivities(program)[0]?.sessionNumber || 1;

              return `
                <div class="col-12 col-md-6 col-xl-4">
                  <a class="text-decoration-none" href="${escapeHtml(buildAdminQuizPreviewPath(program.id, firstSession))}">
                    <div class="card h-100 border-0 bg-light-subtle">
                      <div class="card-body">
                        <div class="small text-secondary mb-2">${escapeHtml(program.subject || 'Chương trình')}</div>
                        <h3 class="h6 text-dark mb-2">${escapeHtml(program.name)}</h3>
                        <div class="text-secondary small">Tổng ${Number(program.totalSessionCount || 0)} buổi</div>
                      </div>
                    </div>
                  </a>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function findQuizConfigForSession(configs = [], sessionNumber = 0) {
  return configs.find((config) => Number(config.sessionNumber || 0) === Number(sessionNumber || 0)) || null;
}

function getQuestionById(config, questionId) {
  return (config?.questions || []).find((question) => question.id === questionId) || null;
}

function getOptionText(question, optionId) {
  return (question?.options || []).find((option) => option.id === optionId)?.text || '';
}

function buildPreviewResult(quizConfig, quizVariant, answers = {}) {
  const gradedQuestions = (quizVariant?.questions || []).map((publicQuestion, index) => {
    const privateQuestion = getQuestionById(quizConfig, publicQuestion.id) || publicQuestion;
    const answerValue = String(answers[publicQuestion.id] ?? '').trim();
    const isBlank = isFillBlankQuestion(privateQuestion);
    const correctOptionId = privateQuestion.correctOptionId || '';
    const isCorrect = isBlank
      ? isQuizBlankAnswerCorrect(privateQuestion, answerValue)
      : Boolean(answerValue) && answerValue === correctOptionId;

    return {
      questionId: publicQuestion.id,
      order: index + 1,
      type: privateQuestion.type,
      prompt: publicQuestion.prompt || privateQuestion.prompt || '',
      imageUrl: publicQuestion.imageUrl || privateQuestion.imageUrl || '',
      imageAlt: publicQuestion.imageAlt || privateQuestion.imageAlt || '',
      selectedText: isBlank ? answerValue : getOptionText(publicQuestion, answerValue) || getOptionText(privateQuestion, answerValue),
      correctText: isBlank
        ? (privateQuestion.acceptedAnswers || []).join(', ')
        : getOptionText(privateQuestion, correctOptionId),
      isCorrect,
    };
  });
  const questionCount = gradedQuestions.length;
  const correctCount = gradedQuestions.filter((question) => question.isCorrect).length;

  return {
    questionCount,
    correctCount,
    score: questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0,
    gradedQuestions,
  };
}

function renderPreviewResult(result) {
  if (!result) {
    return '';
  }

  return `
    <section class="card border-0 shadow-sm mt-3">
      <div class="card-header bg-white border-0">
        <div class="d-flex flex-wrap justify-content-between gap-2 align-items-center">
          <div>
            <h3 class="h5 mb-1">Kết quả chấm thử</h3>
            <p class="text-secondary mb-0">Kết quả này chỉ hiển thị cho admin và không ghi vào Firestore.</p>
          </div>
          <span class="badge ${result.score >= 70 ? 'text-bg-success' : 'text-bg-warning text-dark'}">
            ${result.correctCount}/${result.questionCount} (${result.score}%)
          </span>
        </div>
      </div>
      <div class="card-body">
        <div class="row g-3">
          ${result.gradedQuestions
            .map(
              (question) => `
                <div class="col-12">
                  <div class="card border ${question.isCorrect ? 'border-success-subtle' : 'border-danger-subtle'}">
                    <div class="card-body">
                      <div class="d-flex flex-wrap justify-content-between gap-2 align-items-start mb-2">
                        <div class="d-flex flex-wrap gap-2">
                          <span class="badge text-bg-light text-dark border">Câu ${question.order}</span>
                          <span class="badge bg-white text-dark border">${escapeHtml(getQuizQuestionTypeLabel(question.type))}</span>
                        </div>
                        <span class="badge ${question.isCorrect ? 'text-bg-success' : 'text-bg-danger'}">
                          ${question.isCorrect ? 'Đúng' : 'Sai'}
                        </span>
                      </div>
                      <div class="fw-semibold mb-3">${renderMultilineText(question.prompt)}</div>
                      ${
                        question.imageUrl
                          ? `
                            <figure class="quiz-question-media quiz-question-media--admin">
                              <img
                                src="${escapeHtml(question.imageUrl)}"
                                alt="${escapeHtml(question.imageAlt || question.prompt || 'Minh họa câu hỏi')}"
                                class="quiz-question-media__image"
                                loading="lazy"
                              />
                            </figure>
                          `
                          : ''
                      }
                      <div class="row g-3">
                        <div class="col-12 col-md-6">
                          <div class="quiz-status-meta h-100">
                            <div class="quiz-status-meta__label">Admin chọn</div>
                            <div class="fw-semibold">${escapeHtml(question.selectedText || 'Chưa trả lời')}</div>
                          </div>
                        </div>
                        <div class="col-12 col-md-6">
                          <div class="quiz-status-meta h-100">
                            <div class="quiz-status-meta__label">Đáp án đúng</div>
                            <div class="fw-semibold">${escapeHtml(question.correctText || 'Chưa có đáp án')}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              `,
            )
            .join('')}
        </div>
      </div>
    </section>
  `;
}

function renderQuizPreviewShell({
  programs,
  program,
  sessionNumber,
  quizConfig,
  quizVariant,
  answers,
  errors,
  currentQuestionIndex,
  result,
}) {
  const sessions = getCurriculumSessionActivities(program);
  const selectedActivity = getCurriculumSessionActivity(program, sessionNumber);
  const questionPoolCount = Number(quizConfig?.questions?.length || 0);
  const readiness = quizConfig ? getQuizReadiness(quizConfig) : null;

  return `
    <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start mb-3">
      <div>
        <div class="text-secondary small mb-1">Admin test</div>
        <h2 class="h4 mb-1">${escapeHtml(program.name)}</h2>
        <div class="text-secondary">
          Buổi ${sessionNumber} · ${escapeHtml(getCurriculumActivityTypeLabel(selectedActivity.activityType))}
        </div>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <a class="btn btn-outline-secondary" href="#/admin/curriculum">
          <i class="bi bi-arrow-left me-2"></i>Quay lại Học liệu
        </a>
        <a class="btn btn-outline-primary" href="${escapeHtml(buildAdminLessonPreviewPath(program.id, sessionNumber))}">
          <i class="bi bi-journal-richtext me-2"></i>Xem học liệu
        </a>
      </div>
    </div>

    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-lg-5">
            <label class="form-label">Chương trình</label>
            <select class="form-select" id="admin-quiz-preview-program">
              ${programs
                .map(
                  (item) => `
                    <option value="${escapeHtml(item.id)}" ${item.id === program.id ? 'selected' : ''}>
                      ${escapeHtml(item.name)}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </div>
          <div class="col-12 col-lg-4">
            <label class="form-label">Buổi muốn test</label>
            <select class="form-select" id="admin-quiz-preview-session">
              ${sessions
                .map(
                  (item) => `
                    <option value="${item.sessionNumber}" ${item.sessionNumber === sessionNumber ? 'selected' : ''}>
                      Buổi ${item.sessionNumber} - ${escapeHtml(getCurriculumActivityTypeLabel(item.activityType))}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </div>
          <div class="col-12 col-lg-3">
            <button type="button" class="btn btn-outline-primary w-100" data-action="refresh-admin-quiz-variant" ${quizConfig ? '' : 'disabled'}>
              <i class="bi bi-shuffle me-2"></i>Tạo đề thử khác
            </button>
          </div>
        </div>
      </div>
    </div>

    ${renderAlert('Đây là môi trường test riêng cho admin: không cần mã lớp, không cần học sinh và không lưu điểm.', 'info')}
    ${
      quizConfig && !readiness?.isReady
        ? renderAlert(`Bộ đề hiện có ${questionPoolCount} câu nhưng chưa đủ tỉ lệ 4 dễ, 4 trung bình, 2 khó. ${formatQuizReadinessRequirement(readiness)}`, 'warning')
        : ''
    }

    ${
      quizConfig && quizVariant
        ? `
          ${renderQuizForm(quizVariant, answers, errors, {
            helperText: 'Bạn đang làm thử bằng tài khoản admin. Bấm “Chấm thử” để xem đúng/sai ngay, dữ liệu sẽ không được ghi nhận vào bài nộp.',
            submitLabel: 'Chấm thử',
            currentQuestionIndex,
          })}
          <div class="d-flex justify-content-end mt-2">
            <button type="button" class="btn btn-link text-secondary" data-action="reset-admin-quiz-preview">
              Làm lại form test
            </button>
          </div>
          ${renderPreviewResult(result)}
        `
        : renderEmptyState({
            icon: 'patch-question',
            title: 'Buổi này chưa có đề quiz',
            description:
              'Hãy quay lại Học liệu > Điều khiển & thống kê hoặc tab soạn đề để nạp bộ câu hỏi mẫu, sau đó quay lại đường dẫn test này.',
          })
    }
  `;
}

export const adminQuizPreviewPage = {
  async render({ authState }) {
    return renderAppShell({
      title: 'Test quiz admin',
      subtitle: 'Làm thử quiz không cần mã lớp, chỉ dùng để kiểm tra đề và đáp án.',
      currentRoute: '/admin/curriculum',
      user: authState.user,
      content: '<div id="admin-quiz-preview-root"></div>',
    });
  },

  async mount() {
    const root = document.getElementById('admin-quiz-preview-root');

    if (!root) {
      return null;
    }

    const state = {
      programs: [],
      program: null,
      sessionNumber: 1,
      quizConfigs: [],
      quizConfig: null,
      quizVariant: null,
      answers: {},
      errors: {},
      currentQuestionIndex: 0,
      result: null,
      previewSeed: Date.now(),
    };
    let disposed = false;

    function syncQuizVariant() {
      state.quizConfig = findQuizConfigForSession(state.quizConfigs, state.sessionNumber);

      if (!state.quizConfig) {
        state.quizVariant = null;
        return;
      }

      state.quizVariant = buildStudentQuizVariant(state.quizConfig, {
        classCode: 'ADMIN-PREVIEW',
        studentId: `ADMIN-TESTER-${state.previewSeed}`,
        sessionNumber: state.sessionNumber,
        questionLimit: QUIZ_QUESTION_LIMIT,
      });
    }

    function renderView() {
      if (disposed) {
        return;
      }

      if (!state.program) {
        root.innerHTML = renderProgramShortcutList(state.programs);
        return;
      }

      root.innerHTML = renderQuizPreviewShell(state);
    }

    async function load() {
      const routeState = getHashRouteState();
      root.innerHTML = renderLoadingOverlay('Đang tải đề quiz preview...');

      try {
        state.programs = await listCurriculumPrograms();

        if (!routeState.programId) {
          renderView();
          return;
        }

        state.program = await getCurriculumProgram(routeState.programId);

        if (!state.program) {
          throw new Error('Không tìm thấy chương trình học để test quiz.');
        }

        state.sessionNumber = resolveSessionNumber(state.program, routeState.sessionNumber);
        state.quizConfigs = await listQuizConfigs(state.program);
        syncQuizVariant();
        renderView();
      } catch (error) {
        if (!disposed) {
          root.innerHTML = renderAlert(escapeHtml(error?.message || 'Không thể tải đề quiz preview.'), 'danger');
        }
      }
    }

    root.addEventListener('change', (event) => {
      const programSelect = event.target.closest('#admin-quiz-preview-program');
      const sessionSelect = event.target.closest('#admin-quiz-preview-session');
      const choiceInput = event.target.closest('[data-answer-kind="choice"]');

      if (programSelect) {
        const selectedProgram = state.programs.find((item) => item.id === programSelect.value) || null;
        const firstSession = selectedProgram ? getCurriculumSessionActivities(selectedProgram)[0]?.sessionNumber || 1 : 1;
        window.location.hash = buildAdminQuizPreviewPath(programSelect.value, firstSession);
        return;
      }

      if (sessionSelect && state.program) {
        window.location.hash = buildAdminQuizPreviewPath(state.program.id, Number(sessionSelect.value || 1));
        return;
      }

      if (choiceInput) {
        state.answers = {
          ...state.answers,
          [choiceInput.dataset.questionId]: choiceInput.value,
        };
        state.errors = {
          ...state.errors,
          [choiceInput.dataset.questionId]: '',
        };
        state.result = null;
        renderView();
      }
    });

    root.addEventListener('input', (event) => {
      const blankInput = event.target.closest('[data-answer-kind="blank"]');

      if (!blankInput) {
        return;
      }

      state.answers = {
        ...state.answers,
        [blankInput.dataset.questionId]: blankInput.value,
      };
      state.errors = {
        ...state.errors,
        [blankInput.dataset.questionId]: '',
      };
      state.result = null;
    });

    root.addEventListener('click', (event) => {
      const previousButton = event.target.closest('[data-action="previous-question"]');
      const nextButton = event.target.closest('[data-action="next-question"]');
      const refreshVariantButton = event.target.closest('[data-action="refresh-admin-quiz-variant"]');
      const resetButton = event.target.closest('[data-action="reset-admin-quiz-preview"]');

      if (previousButton) {
        state.currentQuestionIndex = Math.max(0, state.currentQuestionIndex - 1);
        renderView();
        return;
      }

      if (nextButton) {
        state.currentQuestionIndex = Math.min(
          Number(state.quizVariant?.questions?.length || 1) - 1,
          state.currentQuestionIndex + 1,
        );
        renderView();
        return;
      }

      if (refreshVariantButton) {
        state.previewSeed = Date.now();
        state.answers = {};
        state.errors = {};
        state.currentQuestionIndex = 0;
        state.result = null;
        syncQuizVariant();
        renderView();
        showToast({
          title: 'Đã tạo đề thử mới',
          message: 'Bộ câu hỏi/đáp án đã được random lại cho phiên test admin này.',
          variant: 'success',
        });
        return;
      }

      if (resetButton) {
        state.answers = {};
        state.errors = {};
        state.currentQuestionIndex = 0;
        state.result = null;
        renderView();
      }
    });

    root.addEventListener('submit', (event) => {
      if (!event.target.closest('#student-quiz-form') || !state.quizVariant || !state.quizConfig) {
        return;
      }

      event.preventDefault();

      const validation = validateQuizAnswerMap(state.quizVariant, state.answers);

      if (!validation.isValid) {
        const firstInvalidQuestionId = Object.keys(validation.errors)[0];
        const firstInvalidIndex = (state.quizVariant.questions || []).findIndex(
          (question) => question.id === firstInvalidQuestionId,
        );

        state.errors = validation.errors;
        state.currentQuestionIndex = firstInvalidIndex >= 0 ? firstInvalidIndex : state.currentQuestionIndex;
        state.result = null;
        renderView();
        return;
      }

      state.errors = {};
      state.result = buildPreviewResult(state.quizConfig, state.quizVariant, state.answers);
      renderView();
      showToast({
        title: 'Đã chấm thử',
        message: `Kết quả admin test: ${state.result.correctCount}/${state.result.questionCount} (${state.result.score}%).`,
        variant: 'success',
      });
    });

    await load();

    return () => {
      disposed = true;
    };
  },
};
