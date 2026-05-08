import { listActiveClasses, getClassRoster } from '../../services/public-api.service.js';
import { getStudentQuizContext, submitStudentQuiz } from '../../services/student-quiz.service.js';
import { attachHiddenAdminShortcut } from '../../utils/admin-shortcut.js';
import { formatDateTime } from '../../utils/date.js';
import { escapeHtml } from '../../utils/html.js';
import { getLockedQuizClassCode } from '../../utils/route.js';
import { isQuizQuestionAnswered, validateQuizAnswerMap } from '../../utils/quiz.js';
import { renderAlert } from '../components/Alert.js';
import { renderBrandLogo } from '../components/BrandLogo.js';
import { renderClassSelect } from '../components/ClassSelect.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderQuizForm } from '../components/QuizForm.js';
import { renderStudentSelect } from '../components/StudentSelect.js';
import { renderToastStack, showToast } from '../components/ToastStack.js';

const QUIZ_CONTEXT_POLL_INTERVAL_MS = 5000;

function getErrorMessage(error, fallback) {
  return error?.message || fallback;
}

function renderLockedClassField(classInfo) {
  const classCode = classInfo?.classCode || 'Chưa xác định';
  const className = classInfo?.className || 'Lớp này đang được mở theo đường dẫn riêng.';

  return `
    <label class="form-label">Mã lớp</label>
    <div class="form-control locked-class-field bg-body-tertiary">
      <div class="locked-class-field__code" title="${escapeHtml(classCode)}">${escapeHtml(classCode)}</div>
      <div class="locked-class-field__name">${escapeHtml(className)}</div>
    </div>
  `;
}

function renderSubmittedState(quizContext) {
  const attempt = quizContext?.attempt;
  const quiz = quizContext?.quiz;

  return `
    <div class="card border-0 shadow-sm">
      <div class="card-body">
        ${renderAlert('Bạn đã nộp bài kiểm tra này thành công.', 'success')}
        <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start">
          <div>
            <div class="small text-secondary mb-1">Trắc nghiệm buổi ${Number(quiz?.sessionNumber || 0)}</div>
            <h2 class="h4 mb-1">${escapeHtml(quiz?.title || 'Bài kiểm tra đã nộp')}</h2>
            <p class="text-secondary mb-0">
              Hệ thống đã ghi nhận bài làm của bạn. Giáo viên sẽ xem kết quả trong khu quản trị.
            </p>
          </div>
          <span class="badge bg-white text-dark border">${Number(quiz?.questionCount || 0)} câu</span>
        </div>
        <hr class="my-4">
        <div class="row g-3">
          <div class="col-12 col-md-6">
            <div class="quiz-status-meta">
              <div class="quiz-status-meta__label">Trạng thái</div>
              <div class="fw-semibold text-success">Đã nộp</div>
            </div>
          </div>
          <div class="col-12 col-md-6">
            <div class="quiz-status-meta">
              <div class="quiz-status-meta__label">Thời gian nộp</div>
              <div class="fw-semibold">${formatDateTime(attempt?.submittedAt)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function findQuestionIndex(quiz, questionId = '') {
  return (quiz?.questions || []).findIndex((question) => question.id === questionId);
}

function renderQuizState({
  selectedClassCode,
  students,
  selectedStudent,
  quizContext,
  isLoading,
  error,
  answers,
  answerErrors,
  isSubmitting,
  currentQuestionIndex,
}) {
  if (!selectedClassCode) {
    return renderAlert('Hãy chọn lớp để xem bài kiểm tra hiện có.', 'info');
  }

  if (isLoading) {
    return renderLoadingOverlay('Đang tải bài kiểm tra...');
  }

  if (error) {
    return renderAlert(error, 'danger');
  }

  if (students.length === 0) {
    return renderAlert('Lớp này hiện chưa có học sinh hoạt động để làm bài kiểm tra.', 'warning');
  }

  if (!selectedStudent) {
    return renderAlert('Hãy chọn đúng tên của bạn để mở bài kiểm tra.', 'info');
  }

  if (!quizContext?.availability?.isEligible) {
    return renderAlert(
      quizContext?.availability?.reason || 'Lớp này hiện chưa có bài kiểm tra trắc nghiệm.',
      'info',
    );
  }

  if (quizContext?.attempt?.status === 'submitted') {
    return renderSubmittedState(quizContext);
  }

  if (!quizContext?.quiz) {
    return renderAlert('Bài kiểm tra hiện chưa được cấu hình đầy đủ.', 'warning');
  }

  const helperText =
    quizContext?.attempt?.status === 'reopened'
      ? 'Giáo viên đã mở lại lượt làm bài này. Bạn có thể làm lại và hệ thống sẽ ghi nhận lần nộp mới.'
      : 'Chọn một đáp án cho mỗi câu rồi bấm nộp bài. Sau khi nộp, hệ thống chỉ báo đã nộp, không hiện điểm ngay.';

  return renderQuizForm(quizContext.quiz, answers, answerErrors, {
    disabled: isSubmitting,
    helperText,
    submitLabel: isSubmitting
      ? 'Đang nộp bài...'
      : 'Nộp bài kiểm tra',
    currentQuestionIndex,
  });
}

export const studentQuizPage = {
  title: 'Làm bài trắc nghiệm',
  async render() {
    return `
      <div class="student-layout">
        <section class="student-hero">
          <div class="container-fluid student-page-shell py-4 py-lg-5">
            <div class="row justify-content-center">
              <div class="col-12">
                <div class="student-hero-card shadow-lg border-0">
                  <div class="row g-0">
                    <div class="col-12 col-lg-4 col-xl-3 student-hero-panel">
                      ${renderBrandLogo({
                        id: 'student-quiz-brand-trigger',
                        className: 'student-brand-lockup mb-4',
                        tone: 'light',
                        compact: true,
                      })}
                      <h1 class="student-hero-title fw-semibold mb-3">Kiểm tra trắc nghiệm</h1>
                      <p class="student-hero-copy mb-0 text-white-50">
                        Chọn đúng lớp và đúng tên của bạn để mở bài kiểm tra hiện tại. Khi giáo viên kết thúc bài kiểm tra, các đáp án chưa nộp sẽ không được ghi nhận.
                      </p>
                    </div>
                    <div class="col-12 col-lg-8 col-xl-9 p-4 p-xl-5 bg-white student-main-panel">
                      <div id="student-quiz-alert"></div>
                      <div class="row g-3 mb-4">
                        <div class="col-12 col-md-6">
                          <div id="student-quiz-class-slot">${renderLoadingOverlay('Đang tải thông tin lớp...')}</div>
                        </div>
                        <div class="col-12 col-md-6">
                          <div id="student-quiz-student-slot">${renderStudentSelect([])}</div>
                        </div>
                      </div>
                      <div id="student-quiz-form-slot">${renderLoadingOverlay('Đang tải bài kiểm tra...')}</div>
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
    const pageAlert = document.getElementById('student-quiz-alert');
    const classSlot = document.getElementById('student-quiz-class-slot');
    const studentSlot = document.getElementById('student-quiz-student-slot');
    const quizSlot = document.getElementById('student-quiz-form-slot');
    const brandTrigger = document.getElementById('student-quiz-brand-trigger');
    const lockedClassCode = getLockedQuizClassCode();

    let classes = [];
    let students = [];
    let selectedClassCode = lockedClassCode || '';
    let selectedStudentId = '';
    let lockedClass = null;
    let lockedClassError = '';
    let rosterError = '';
    let quizContext = null;
    let quizLoading = false;
    let quizError = '';
    let answers = {};
    let answerErrors = {};
    let currentQuestionIndex = 0;
    let isSubmitting = false;
    let quizContextPollTimer = 0;

    function getSelectedStudent() {
      return students.find((student) => student.studentId === selectedStudentId) || null;
    }

    function resetLocalAttemptProgress() {
      answers = {};
      answerErrors = {};
      currentQuestionIndex = 0;
    }

    function renderPageAlertState() {
      if (lockedClassError) {
        pageAlert.innerHTML = renderAlert(lockedClassError, 'danger');
        return;
      }

      if (rosterError) {
        pageAlert.innerHTML = renderAlert(rosterError, 'danger');
        return;
      }

      pageAlert.innerHTML = '';
    }

    function renderSelections() {
      const selectedStudent = getSelectedStudent();

      classSlot.innerHTML = lockedClassCode
        ? renderLockedClassField(lockedClass || { classCode: selectedClassCode || lockedClassCode, className: '' })
        : renderClassSelect(classes, selectedClassCode);
      studentSlot.innerHTML = renderStudentSelect(students, selectedStudentId);
      quizSlot.innerHTML = renderQuizState({
        selectedClassCode,
        students,
        selectedStudent,
        quizContext,
        isLoading: quizLoading,
        error: quizError,
        answers,
        answerErrors,
        isSubmitting,
        currentQuestionIndex,
      });
    }

    function updateAnswer(questionId, value) {
      answers = {
        ...answers,
        [questionId]: value || '',
      };

      if (answerErrors[questionId]) {
        const nextErrors = { ...answerErrors };
        delete nextErrors[questionId];
        answerErrors = nextErrors;
      }
    }

    function getCurrentQuestion() {
      return quizContext?.quiz?.questions?.[currentQuestionIndex] || null;
    }

    function stopQuizContextWatch() {
      if (quizContextPollTimer) {
        window.clearInterval(quizContextPollTimer);
        quizContextPollTimer = 0;
      }
    }

    function restartQuizContextWatch() {
      stopQuizContextWatch();

      if (!selectedClassCode || !selectedStudentId) {
        return;
      }

      quizContextPollTimer = window.setInterval(() => {
        if (isSubmitting || quizLoading) {
          return;
        }

        void loadQuizContext({ silent: true, source: 'watch' });
      }, QUIZ_CONTEXT_POLL_INTERVAL_MS);
    }

    async function loadQuizContext({ silent = false, source = 'manual' } = {}) {
      if (!selectedClassCode) {
        quizContext = null;
        quizLoading = false;
        quizError = '';
        currentQuestionIndex = 0;

        if (!silent) {
          renderSelections();
        }
        return;
      }

      const previousQuizContext = quizContext;
      let shouldRender = !silent;

      if (!silent) {
        quizLoading = true;
        quizError = '';
        renderSelections();
      }

      try {
        const nextQuizContext = await getStudentQuizContext({
          classCode: selectedClassCode,
          studentId: selectedStudentId,
        });
        const wasEligible = Boolean(previousQuizContext?.availability?.isEligible);
        const nextEligible = Boolean(nextQuizContext?.availability?.isEligible);
        const previousAttemptStatus = previousQuizContext?.attempt?.status || '';
        const nextAttemptStatus = nextQuizContext?.attempt?.status || '';

        quizContext = nextQuizContext;
        currentQuestionIndex = Math.min(
          currentQuestionIndex,
          Math.max(0, Number(nextQuizContext?.quiz?.questionCount || 0) - 1),
        );
        quizError = '';
        shouldRender = true;

        if (source === 'watch') {
          if (wasEligible && !nextEligible) {
            resetLocalAttemptProgress();
            showToast({
              title: 'Bài kiểm tra đã kết thúc',
              message:
                nextQuizContext?.availability?.reason
                || 'Giáo viên đã kết thúc bài kiểm tra. Các đáp án chưa nộp sẽ không được ghi nhận.',
              variant: 'warning',
            });
          } else if (!wasEligible && nextEligible) {
            resetLocalAttemptProgress();
            showToast({
              title:
                nextAttemptStatus === 'reopened' ? 'Đã được mở lại lượt làm' : 'Bài kiểm tra đã bắt đầu',
              message:
                nextAttemptStatus === 'reopened'
                  ? 'Giáo viên đã mở lại lượt làm bài cho bạn. Bạn có thể làm lại và nộp lần mới.'
                  : 'Giáo viên đã bắt đầu bài kiểm tra cho lớp này.',
              variant: 'success',
            });
          } else if (previousAttemptStatus !== nextAttemptStatus && nextAttemptStatus === 'reopened') {
            resetLocalAttemptProgress();
            showToast({
              title: 'Đã được mở lại lượt làm',
              message: 'Giáo viên đã mở lại lượt làm bài cho bạn. Bạn có thể làm lại và nộp lần mới.',
              variant: 'success',
            });
          }
        }
      } catch (error) {
        if (source === 'watch') {
          shouldRender = false;
          return;
        }

        quizContext = null;
        quizError = getErrorMessage(error, 'Không tải được bài kiểm tra của lớp này.');
        currentQuestionIndex = 0;
        shouldRender = true;
      } finally {
        quizLoading = false;

        if (shouldRender) {
          renderSelections();
        }
      }
    }

    async function loadClassContext() {
      if (!selectedClassCode) {
        students = [];
        selectedStudentId = '';
        resetLocalAttemptProgress();
        rosterError = '';
        lockedClassError = '';
        await loadQuizContext();
        restartQuizContextWatch();
        renderPageAlertState();
        return;
      }

      rosterError = '';
      lockedClassError = '';
      studentSlot.innerHTML = renderLoadingOverlay('Đang tải danh sách học sinh...');

      try {
        students = await getClassRoster(selectedClassCode);

        if (!students.some((student) => student.studentId === selectedStudentId)) {
          selectedStudentId = '';
        }
      } catch (error) {
        students = [];
        selectedStudentId = '';

        if (lockedClassCode) {
          lockedClassError = getErrorMessage(
            error,
            'Link lớp này hiện không thể dùng để mở bài kiểm tra.',
          );
        } else {
          rosterError = getErrorMessage(error, 'Không tải được danh sách học sinh của lớp này.');
        }
      }

      await loadQuizContext();
      restartQuizContextWatch();
      renderPageAlertState();
    }

    async function loadClasses() {
      try {
        classes = await listActiveClasses();

        if (lockedClassCode) {
          lockedClass = classes.find((item) => item.classCode === lockedClassCode) || null;
          selectedClassCode = lockedClassCode;

          if (!lockedClass) {
            lockedClassError = 'Link lớp này không hợp lệ hoặc lớp hiện không mở để làm bài.';
            renderSelections();
            renderPageAlertState();
            return;
          }
        }

        renderSelections();
        await loadClassContext();
      } catch (error) {
        pageAlert.innerHTML = renderAlert(
          getErrorMessage(error, 'Không tải được danh sách lớp đang mở.'),
          'danger',
        );
      }
    }

    const cleanupShortcut = attachHiddenAdminShortcut({
      brandElement: brandTrigger,
      onTrigger: () => {
        window.location.assign('/#/admin/login');
      },
    });

    classSlot.addEventListener('change', async (event) => {
      if (event.target.id !== 'student-class-select') {
        return;
      }

      selectedClassCode = event.target.value || '';
      selectedStudentId = '';
      resetLocalAttemptProgress();
      restartQuizContextWatch();
      await loadClassContext();
    });

    studentSlot.addEventListener('change', async (event) => {
      if (event.target.id !== 'student-name-select') {
        return;
      }

      selectedStudentId = event.target.value || '';
      resetLocalAttemptProgress();
      await loadQuizContext();
      restartQuizContextWatch();
    });

    quizSlot.addEventListener('change', (event) => {
      const answerInput = event.target.closest('[data-question-id]');

      if (!answerInput) {
        return;
      }

      const questionId = answerInput.dataset.questionId || '';
      updateAnswer(questionId, answerInput.value || '');
      renderSelections();
    });

    quizSlot.addEventListener('input', (event) => {
      const blankInput = event.target.closest('[data-answer-kind="blank"][data-question-id]');

      if (!blankInput) {
        return;
      }

      const questionId = blankInput.dataset.questionId || '';
      const hadError = Boolean(answerErrors[questionId]);
      updateAnswer(questionId, blankInput.value || '');

      if (hadError) {
        renderSelections();
      }
    });

    quizSlot.addEventListener('click', (event) => {
      const previousButton = event.target.closest('[data-action="previous-question"]');
      const nextButton = event.target.closest('[data-action="next-question"]');

      if (previousButton) {
        currentQuestionIndex = Math.max(0, currentQuestionIndex - 1);
        renderSelections();
        return;
      }

      if (!nextButton) {
        return;
      }

      const currentQuestion = getCurrentQuestion();

      if (currentQuestion && !isQuizQuestionAnswered(currentQuestion, answers[currentQuestion.id])) {
        answerErrors = {
          ...answerErrors,
          [currentQuestion.id]:
            currentQuestion.type === 'fill_blank'
              ? 'Hãy nhập câu trả lời cho câu hỏi này.'
              : 'Hãy chọn một đáp án cho câu hỏi này.',
        };
        renderSelections();
        return;
      }

      currentQuestionIndex = Math.min(
        Math.max(0, Number(quizContext?.quiz?.questionCount || 0) - 1),
        currentQuestionIndex + 1,
      );
      renderSelections();
    });

    quizSlot.addEventListener('submit', async (event) => {
      if (event.target.id !== 'student-quiz-form') {
        return;
      }

      event.preventDefault();

      if (!quizContext?.quiz || !selectedStudentId || !selectedClassCode) {
        return;
      }

      const validation = validateQuizAnswerMap(quizContext.quiz, answers);

      if (!validation.isValid) {
        answerErrors = validation.errors;
        const firstInvalidQuestionId = Object.keys(validation.errors)[0] || '';
        const firstInvalidIndex = findQuestionIndex(quizContext.quiz, firstInvalidQuestionId);

        if (firstInvalidIndex >= 0) {
          currentQuestionIndex = firstInvalidIndex;
        }

        renderSelections();
        return;
      }

      isSubmitting = true;
      answerErrors = {};
      renderSelections();

      try {
        await submitStudentQuiz({
          classCode: selectedClassCode,
          studentId: selectedStudentId,
          answers,
        });
        resetLocalAttemptProgress();
        showToast({
          title: 'Đã nộp bài',
          message: 'Hệ thống đã ghi nhận bài kiểm tra của bạn.',
          variant: 'success',
        });
        await loadQuizContext();
      } catch (error) {
        showToast({
          title: 'Chưa nộp được bài',
          message: getErrorMessage(error, 'Không thể nộp bài kiểm tra lúc này.'),
          variant: 'danger',
        });
      } finally {
        isSubmitting = false;
        renderSelections();
      }
    });

    renderSelections();
    await loadClasses();

    return () => {
      stopQuizContextWatch();
      cleanupShortcut?.();
    };
  },
};
