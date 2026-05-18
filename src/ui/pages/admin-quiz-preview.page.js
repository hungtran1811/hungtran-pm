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
import { renderBrandLogo } from '../components/BrandLogo.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderQuizForm } from '../components/QuizForm.js';
import { renderToastStack, showToast } from '../components/ToastStack.js';

const ADMIN_PREVIEW_CLASS = {
  classCode: 'ADMIN-QUIZ-DEMO',
  className: 'Lớp mẫu kiểm tra',
};

const ADMIN_PREVIEW_STUDENT = {
  studentId: 'ADMIN-STUDENT-DEMO',
  fullName: 'Học sinh mẫu',
};

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

function renderReadonlyField(label, primary, secondary = '') {
  return `
    <label class="form-label">${escapeHtml(label)}</label>
    <div class="form-control locked-class-field bg-body-tertiary admin-quiz-preview-field">
      <div class="locked-class-field__code">${escapeHtml(primary)}</div>
      ${secondary ? `<div class="locked-class-field__name">${escapeHtml(secondary)}</div>` : ''}
    </div>
  `;
}

function renderProgramShortcutList(programs = []) {
  if (!programs.length) {
    return renderEmptyState({
      icon: 'diagram-3',
      title: 'Chưa có chương trình học',
      description: 'Hãy tạo hoặc seed chương trình học trước khi test quiz admin.',
    });
  }

  return `
    <div class="card border-0 shadow-sm">
      <div class="card-body p-4">
        <h2 class="h5 mb-2">Chọn chương trình để test quiz</h2>
        <p class="text-secondary mb-4">Trang này chỉ dùng lớp mẫu và học sinh mẫu, không lấy dữ liệu lớp thật.</p>
        <div class="row g-3">
          ${programs
            .map((program) => {
              const firstSession = getCurriculumSessionActivities(program)[0]?.sessionNumber || 1;

              return `
                <div class="col-12 col-md-6">
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
    <section class="card border-0 shadow-sm mt-3 admin-quiz-result">
      <div class="card-header bg-white border-0">
        <div class="d-flex flex-wrap justify-content-between gap-2 align-items-center">
          <div>
            <h3 class="h5 mb-1">Kết quả chấm thử</h3>
            <p class="text-secondary mb-0">Chỉ admin thấy phần này, dữ liệu không ghi vào bài nộp thật.</p>
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
                            <div class="quiz-status-meta__label">Học sinh mẫu chọn</div>
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
  program,
  sessionNumber,
  quizConfig,
  quizVariant,
  answers,
  errors,
  currentQuestionIndex,
  result,
}) {
  const selectedActivity = getCurriculumSessionActivity(program, sessionNumber);
  const questionPoolCount = Number(quizConfig?.questions?.length || 0);
  const readiness = quizConfig ? getQuizReadiness(quizConfig) : null;

  return `
    <div class="admin-quiz-preview-toolbar mb-3">
      <div>
        <div class="small text-secondary mb-1">Màn test admin</div>
        <h2 class="h5 mb-0">${escapeHtml(program.name)} · Buổi ${Number(sessionNumber || 0)}</h2>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <a class="btn btn-outline-secondary btn-sm" href="#/admin/curriculum?workspace=editor&session=${Number(sessionNumber || 0)}">
          <i class="bi bi-arrow-left me-1"></i>Về Học liệu
        </a>
        <a class="btn btn-outline-secondary btn-sm" href="${escapeHtml(buildAdminLessonPreviewPath(program.id, sessionNumber))}">
          <i class="bi bi-journal-richtext me-1"></i>Xem học liệu
        </a>
        <button type="button" class="btn btn-outline-primary btn-sm" data-action="refresh-admin-quiz-variant" ${quizConfig ? '' : 'disabled'}>
          <i class="bi bi-shuffle me-1"></i>Đề thử khác
        </button>
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-12 col-md-6">
        ${renderReadonlyField('Mã lớp', ADMIN_PREVIEW_CLASS.classCode, `${ADMIN_PREVIEW_CLASS.className} · ${getCurriculumActivityTypeLabel(selectedActivity.activityType)}`)}
      </div>
      <div class="col-12 col-md-6">
        ${renderReadonlyField('Họ và tên', ADMIN_PREVIEW_STUDENT.fullName, 'Tài khoản mẫu chỉ dùng để test giao diện')}
      </div>
    </div>

    ${renderAlert('Đây là lớp mẫu nội bộ để admin xem đúng giao diện học sinh. Không hiển thị cho học sinh, không nằm trong danh sách lớp và không lưu điểm.', 'info')}
    ${
      quizConfig && !readiness?.isReady
        ? renderAlert(`Bộ đề hiện có ${questionPoolCount} câu nhưng chưa đủ tỉ lệ 4 dễ, 4 trung bình, 2 khó. ${formatQuizReadinessRequirement(readiness)}`, 'warning')
        : ''
    }

    ${
      quizConfig && quizVariant
        ? `
          ${renderQuizForm(quizVariant, answers, errors, {
            helperText: 'Bạn đang xem giao diện giống học sinh. Bấm “Chấm thử” để admin xem kết quả, dữ liệu không được lưu.',
            submitLabel: 'Chấm thử',
            currentQuestionIndex,
          })}
          <div class="d-flex justify-content-end mt-2">
            <button type="button" class="btn btn-link text-secondary" data-action="reset-admin-quiz-preview">
              Làm lại lượt test
            </button>
          </div>
          ${renderPreviewResult(result)}
        `
        : renderEmptyState({
            icon: 'patch-question',
            title: 'Buổi này chưa có đề quiz',
            description:
              'Hãy quay lại Học liệu, chọn buổi kiểm tra và thêm câu hỏi trước khi mở màn test này.',
          })
    }
  `;
}

export const adminQuizPreviewPage = {
  async render() {
    return `
      <div class="student-layout admin-quiz-preview-layout">
        <section class="student-hero admin-quiz-preview-hero">
          <div class="container-fluid student-page-shell py-4 py-lg-5">
            <div class="row justify-content-center">
              <div class="col-12">
                <div class="student-hero-card shadow-lg border-0">
                  <div class="row g-0">
                    <div class="col-12 col-lg-4 col-xl-3 student-hero-panel">
                      ${renderBrandLogo({
                        id: 'admin-quiz-preview-brand',
                        className: 'student-brand-lockup mb-4',
                        tone: 'light',
                        compact: true,
                      })}
                      <h1 class="student-hero-title fw-semibold mb-3">Kiểm tra trắc nghiệm</h1>
                      <p class="student-hero-copy mb-0 text-white-50">
                        Đây là màn giả lập học sinh cho admin kiểm tra đề, thứ tự câu hỏi và trải nghiệm làm bài.
                      </p>
                    </div>
                    <div class="col-12 col-lg-8 col-xl-9 p-4 p-xl-5 bg-white student-main-panel">
                      <div id="admin-quiz-preview-root">${renderLoadingOverlay('Đang tải đề quiz preview...')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        ${renderToastStack()}
      </div>
    `;
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
        classCode: ADMIN_PREVIEW_CLASS.classCode,
        studentId: `${ADMIN_PREVIEW_STUDENT.studentId}-${state.previewSeed}`,
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
      const choiceInput = event.target.closest('[data-answer-kind="choice"]');

      if (!choiceInput) {
        return;
      }

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
          message: 'Bộ câu hỏi/đáp án đã được random lại cho lượt test admin này.',
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
