import { getStudentLibraryView } from '../../services/curriculum.service.js';
import { getClassRoster } from '../../services/public-api.service.js';
import {
  getStudentQuizContext,
  saveStudentQuizDraft,
  submitStudentQuiz,
} from '../../services/student-quiz.service.js';
import { attachHiddenAdminShortcut } from '../../utils/admin-shortcut.js';
import {
  getCurriculumSessionActivity,
  isCurriculumQuizActivity,
} from '../../utils/curriculum-program.js';
import {
  buildPublicLibraryPath,
  buildPublicReportPath,
  getPublicLibraryPathMatch,
  getStudentLibraryRouteState,
} from '../../utils/route.js';
import {
  isQuizQuestionAnswered,
  validateQuizAnswerMap,
} from '../../utils/quiz.js';
import { renderAlert } from '../components/Alert.js';
import { renderBrandLogo } from '../components/BrandLogo.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderStudentLibraryBrowser } from '../components/StudentLibraryBrowser.js';
import { renderToastStack, showToast } from '../components/ToastStack.js';

const QUIZ_CONTEXT_POLL_INTERVAL_MS = 5000;
const QUIZ_DRAFT_SAVE_DELAY_MS = 450;

function getErrorMessage(error, fallback) {
  return error?.message || fallback;
}

function getDefaultLessonId(preview) {
  return (
    preview?.visibleLessons?.find((lesson) => lesson.sessionNumber === preview.assignment?.currentSession)?.id ||
    preview?.visibleLessons?.[preview.visibleLessons.length - 1]?.id ||
    ''
  );
}

function normalizeLibraryTab(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'exercise' ? 'exercise' : 'lecture';
}

function renderLibraryState({
  classCode,
  preview,
  isLoading,
  error,
  activeLessonId,
  activeTab,
  imageSelections,
  lightboxImage,
  reportLink,
  quizState,
}) {
  if (!classCode) {
    return renderAlert('Link học liệu không hợp lệ.', 'danger');
  }

  if (isLoading) {
    return renderLoadingOverlay('Đang tải học liệu...');
  }

  if (error) {
    return renderAlert(error, 'danger');
  }

  if (!preview?.program) {
    return renderAlert('Lớp này chưa được gán chương trình học liệu để hiển thị.', 'warning');
  }

  return renderStudentLibraryBrowser(preview, activeLessonId, imageSelections, {
    activeTab,
    lightboxImage,
    reportLink,
    quizState,
  });
}

export const studentLibraryPage = {
  title: 'Học liệu',
  async render() {
    return `
      <div class="student-layout">
        <section class="student-library-shell py-3 py-lg-4">
          <div class="container-fluid student-page-shell">
            <div class="student-library-page">
              <div class="student-library-page__brand">
                ${renderBrandLogo({
                  id: 'student-library-brand-trigger',
                  className: 'student-library-page__brand-lockup',
                  tone: 'dark',
                  compact: true,
                })}
              </div>
              <div id="student-library-slot">${renderLoadingOverlay('Đang tải học liệu...')}</div>
            </div>
          </div>
        </section>
        ${renderToastStack()}
      </div>
    `;
  },
  async mount() {
    const slot = document.getElementById('student-library-slot');
    const brandTrigger = document.getElementById('student-library-brand-trigger');
    const routeState = getStudentLibraryRouteState();
    const lockedClassCode = routeState.classCode;

    let disposed = false;
    let isLoading = true;
    let error = '';
    let preview = null;
    let activeLessonId = routeState.lessonId || '';
    let activeTab = normalizeLibraryTab(routeState.tab);
    let imageSelections = {};
    let lightboxImage = null;
    let students = [];
    let selectedStudentId = '';
    let isRosterLoading = false;
    let rosterError = '';
    let quizContext = null;
    let quizLoading = false;
    let quizError = '';
    let quizAnswers = {};
    let quizAnswerErrors = {};
    let quizCurrentQuestionIndex = 0;
    let quizSubmitting = false;
    let quizSavingDraft = false;
    let quizDraftTimer = 0;
    let quizDraftInFlight = false;
    let quizDraftQueued = false;
    let quizContextPollTimer = 0;

    function getActiveLesson() {
      return preview?.visibleLessons?.find((lesson) => lesson.id === activeLessonId) || null;
    }

    function getActiveLessonActivity() {
      const activeLesson = getActiveLesson();
      return activeLesson ? getCurriculumSessionActivity(preview?.program, activeLesson.sessionNumber) : null;
    }

    function isActiveLessonQuiz() {
      return isCurriculumQuizActivity(getActiveLessonActivity()?.activityType);
    }

    function isActiveLessonCurrentQuiz() {
      const activeLesson = getActiveLesson();
      return (
        Boolean(activeLesson) &&
        isActiveLessonQuiz() &&
        Number(activeLesson.sessionNumber || 0) === Number(preview?.assignment?.currentSession || 0)
      );
    }

    function getCurrentQuizQuestion() {
      return quizContext?.quiz?.questions?.[quizCurrentQuestionIndex] || null;
    }

    function findQuestionIndex(quiz, questionId = '') {
      return (quiz?.questions || []).findIndex((question) => question.id === questionId);
    }

    function syncUrlState() {
      if (!lockedClassCode || !getPublicLibraryPathMatch(window.location.pathname)) {
        return;
      }

      const nextPath = buildPublicLibraryPath(lockedClassCode, {
        lessonId: activeLessonId,
        tab: activeTab,
      });
      const currentPath = `${window.location.pathname}${window.location.search}`;

      if (currentPath !== nextPath) {
        window.history.replaceState({}, '', nextPath);
      }
    }

    function renderView() {
      const reportLink = lockedClassCode ? buildPublicReportPath(lockedClassCode) : '#/student/report';

      slot.innerHTML = renderLibraryState({
        classCode: lockedClassCode,
        preview,
        isLoading,
        error,
        activeLessonId,
        activeTab,
        imageSelections,
        lightboxImage,
        reportLink,
        quizState: {
          students,
          selectedStudentId,
          isRosterLoading,
          rosterError,
          quizContext,
          isLoading: quizLoading,
          error: quizError,
          answers: quizAnswers,
          answerErrors: quizAnswerErrors,
          isSubmitting: quizSubmitting,
          isSavingDraft: quizSavingDraft,
          currentQuestionIndex: quizCurrentQuestionIndex,
        },
      });
    }

    function clearQuizDraftTimer() {
      if (quizDraftTimer) {
        window.clearTimeout(quizDraftTimer);
        quizDraftTimer = 0;
      }
    }

    function stopQuizContextWatch() {
      if (quizContextPollTimer) {
        window.clearInterval(quizContextPollTimer);
        quizContextPollTimer = 0;
      }
    }

    function resetQuizProgress({ keepContext = false } = {}) {
      clearQuizDraftTimer();
      quizAnswers = {};
      quizAnswerErrors = {};
      quizCurrentQuestionIndex = 0;
      quizSavingDraft = false;
      quizDraftQueued = false;

      if (!keepContext) {
        quizContext = null;
      }
    }

    function applyLiveAttemptAnswers(nextQuizContext) {
      const liveAnswers = nextQuizContext?.liveAttempt?.answers || {};
      const questions = nextQuizContext?.quiz?.questions || [];

      quizAnswers = questions.reduce((result, question) => {
        const answerValue = String(liveAnswers[question.id] ?? '').trim();

        if (answerValue) {
          result[question.id] = answerValue;
        }

        return result;
      }, {});
      quizAnswerErrors = {};
      quizCurrentQuestionIndex = Math.min(
        quizCurrentQuestionIndex,
        Math.max(0, Number(nextQuizContext?.quiz?.questionCount || 0) - 1),
      );
    }

    async function saveQuizDraftNow({ renderAfter = false } = {}) {
      if (
        !selectedStudentId ||
        !lockedClassCode ||
        !quizContext?.quiz ||
        !quizContext?.availability?.isEligible ||
        quizContext?.attempt?.status === 'submitted'
      ) {
        return;
      }

      clearQuizDraftTimer();

      if (quizDraftInFlight) {
        quizDraftQueued = true;
        return;
      }

      quizDraftInFlight = true;
      quizSavingDraft = true;

      if (renderAfter) {
        renderView();
      }

      try {
        await saveStudentQuizDraft({
          classCode: lockedClassCode,
          studentId: selectedStudentId,
          answers: quizAnswers,
        });
      } catch (draftError) {
        quizError = getErrorMessage(draftError, 'Không thể lưu tạm bài làm lúc này.');
      } finally {
        quizDraftInFlight = false;
        quizSavingDraft = false;

        if (quizDraftQueued) {
          quizDraftQueued = false;
          void saveQuizDraftNow({ renderAfter });
          return;
        }

        if (renderAfter && !disposed) {
          renderView();
        }
      }
    }

    function scheduleQuizDraftSave() {
      clearQuizDraftTimer();

      if (!selectedStudentId || !quizContext?.quiz || quizContext?.attempt?.status === 'submitted') {
        return;
      }

      quizDraftTimer = window.setTimeout(() => {
        void saveQuizDraftNow();
      }, QUIZ_DRAFT_SAVE_DELAY_MS);
    }

    async function loadQuizContext({ silent = false, source = 'manual', applyDraft = true } = {}) {
      stopQuizContextWatch();

      if (!isActiveLessonCurrentQuiz()) {
        quizContext = null;
        quizLoading = false;
        quizError = '';
        resetQuizProgress({ keepContext: true });

        if (!silent) {
          renderView();
        }
        return;
      }

      const previousQuizContext = quizContext;
      let shouldRender = !silent;

      if (!silent) {
        quizLoading = true;
        quizError = '';
        renderView();
      }

      try {
        const nextQuizContext = await getStudentQuizContext({
          classCode: lockedClassCode,
          studentId: selectedStudentId,
        });
        const wasEligible = Boolean(previousQuizContext?.availability?.isEligible);
        const nextEligible = Boolean(nextQuizContext?.availability?.isEligible);
        const previousAttemptStatus = previousQuizContext?.attempt?.status || '';
        const nextAttemptStatus = nextQuizContext?.attempt?.status || '';

        quizContext = nextQuizContext;
        quizError = '';
        shouldRender = true;

        if (applyDraft && selectedStudentId && nextQuizContext?.quiz && nextAttemptStatus !== 'submitted') {
          applyLiveAttemptAnswers(nextQuizContext);
        }

        if (source === 'watch') {
          if (wasEligible && !nextEligible) {
            resetQuizProgress({ keepContext: true });
            showToast({
              title: 'Bài kiểm tra đã kết thúc',
              message:
                nextQuizContext?.availability?.reason ||
                'Giáo viên đã kết thúc bài kiểm tra. Các câu đã lưu tạm sẽ được ghi nhận khi admin kết thúc.',
              variant: 'warning',
            });
          } else if (!wasEligible && nextEligible) {
            resetQuizProgress({ keepContext: true });
            showToast({
              title: nextAttemptStatus === 'reopened' ? 'Đã được mở lại lượt làm' : 'Bài kiểm tra đã bắt đầu',
              message:
                nextAttemptStatus === 'reopened'
                  ? 'Giáo viên đã mở lại lượt làm bài cho bạn. Bạn có thể làm lại và nộp lần mới.'
                  : 'Giáo viên đã bắt đầu bài kiểm tra cho lớp này.',
              variant: 'success',
            });
          } else if (previousAttemptStatus !== nextAttemptStatus && nextAttemptStatus === 'reopened') {
            resetQuizProgress({ keepContext: true });
            showToast({
              title: 'Đã được mở lại lượt làm',
              message: 'Giáo viên đã mở lại lượt làm bài cho bạn. Bạn có thể làm lại và nộp lần mới.',
              variant: 'success',
            });
          }
        }
      } catch (nextError) {
        if (source === 'watch') {
          shouldRender = false;
        } else {
          quizContext = null;
          quizError = getErrorMessage(nextError, 'Không tải được bài kiểm tra của lớp này.');
          resetQuizProgress({ keepContext: true });
          shouldRender = true;
        }
      } finally {
        quizLoading = false;

        if (!disposed && shouldRender) {
          renderView();
        }

        restartQuizContextWatch();
      }
    }

    function restartQuizContextWatch() {
      stopQuizContextWatch();

      if (disposed || !isActiveLessonCurrentQuiz() || !selectedStudentId) {
        return;
      }

      quizContextPollTimer = window.setInterval(() => {
        if (quizSubmitting || quizLoading) {
          return;
        }

        void loadQuizContext({ silent: true, source: 'watch', applyDraft: false });
      }, QUIZ_CONTEXT_POLL_INTERVAL_MS);
    }

    async function refreshQuizForActiveLesson() {
      resetQuizProgress();

      if (!isActiveLessonQuiz()) {
        stopQuizContextWatch();
        renderView();
        return;
      }

      await loadQuizContext();
    }

    function setLesson(nextLessonId) {
      activeLessonId = nextLessonId || getDefaultLessonId(preview);
      activeTab = 'lecture';
      syncUrlState();
      void refreshQuizForActiveLesson();
    }

    function setTab(nextTab) {
      activeTab = normalizeLibraryTab(nextTab);
      syncUrlState();
      renderView();
    }

    function openLightbox(image = {}) {
      const url = String(image.url || '').trim();

      if (!url) {
        return;
      }

      lightboxImage = {
        url,
        alt: String(image.alt || '').trim(),
        label: String(image.label || '').trim(),
      };
      renderView();
    }

    function closeLightbox() {
      if (!lightboxImage) {
        return;
      }

      lightboxImage = null;
      renderView();
    }

    function updateQuizAnswer(questionId, value) {
      quizAnswers = {
        ...quizAnswers,
        [questionId]: value || '',
      };

      if (quizAnswerErrors[questionId]) {
        const nextErrors = { ...quizAnswerErrors };
        delete nextErrors[questionId];
        quizAnswerErrors = nextErrors;
      }
    }

    async function loadRoster() {
      if (!lockedClassCode) {
        students = [];
        selectedStudentId = '';
        return;
      }

      isRosterLoading = true;
      rosterError = '';
      renderView();

      try {
        students = await getClassRoster(lockedClassCode);

        if (!students.some((student) => student.studentId === selectedStudentId)) {
          selectedStudentId = '';
        }
      } catch (nextError) {
        students = [];
        selectedStudentId = '';
        rosterError = getErrorMessage(nextError, 'Không tải được danh sách học sinh của lớp này.');
      } finally {
        isRosterLoading = false;

        if (!disposed) {
          renderView();
        }
      }
    }

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        closeLightbox();
      }
    }

    const cleanupShortcut = attachHiddenAdminShortcut({
      brandElement: brandTrigger,
      onTrigger: () => {
        window.location.assign('/#/admin/login');
      },
    });

    slot.addEventListener('click', (event) => {
      const closeLightboxButton = event.target.closest('[data-action="close-library-image-lightbox"]');
      const openImageButton = event.target.closest('[data-action="open-library-image"]');
      const markdownImage = event.target.closest('.student-library-markdown img');
      const lessonButton = event.target.closest('[data-action="select-library-lesson"]');
      const imageButton = event.target.closest('[data-action="select-library-image"]');
      const tabButton = event.target.closest('[data-action="select-library-tab"]');
      const neighborButton = event.target.closest('[data-action="go-to-library-neighbor"]');
      const previousQuizButton = event.target.closest('[data-action="previous-question"]');
      const nextQuizButton = event.target.closest('[data-action="next-question"]');

      if (closeLightboxButton) {
        closeLightbox();
        return;
      }

      if (openImageButton) {
        openLightbox({
          url: openImageButton.dataset.imageUrl || '',
          alt: openImageButton.dataset.imageAlt || '',
          label: openImageButton.dataset.imageLabel || '',
        });
        return;
      }

      if (markdownImage) {
        openLightbox({
          url: markdownImage.currentSrc || markdownImage.src || '',
          alt: markdownImage.alt || '',
          label: markdownImage.alt || 'Ảnh trong học liệu',
        });
        return;
      }

      if (previousQuizButton) {
        quizCurrentQuestionIndex = Math.max(0, quizCurrentQuestionIndex - 1);
        renderView();
        return;
      }

      if (nextQuizButton) {
        const currentQuestion = getCurrentQuizQuestion();

        if (currentQuestion && !isQuizQuestionAnswered(currentQuestion, quizAnswers[currentQuestion.id])) {
          quizAnswerErrors = {
            ...quizAnswerErrors,
            [currentQuestion.id]:
              currentQuestion.type === 'fill_blank'
                ? 'Hãy nhập câu trả lời cho câu hỏi này.'
                : 'Hãy chọn một đáp án cho câu hỏi này.',
          };
          renderView();
          return;
        }

        quizCurrentQuestionIndex = Math.min(
          Math.max(0, Number(quizContext?.quiz?.questionCount || 0) - 1),
          quizCurrentQuestionIndex + 1,
        );
        renderView();
        return;
      }

      if (lessonButton) {
        setLesson(lessonButton.dataset.lessonId || '');
        return;
      }

      if (tabButton) {
        setTab(tabButton.dataset.tab || 'lecture');
        return;
      }

      if (neighborButton) {
        setLesson(neighborButton.dataset.lessonId || '');
        return;
      }

      if (imageButton) {
        const lessonId = imageButton.dataset.lessonId || '';
        const imageId = imageButton.dataset.imageId || '';

        if (!lessonId || !imageId) {
          return;
        }

        imageSelections = {
          ...imageSelections,
          [lessonId]: imageId,
        };
        renderView();
      }
    });

    slot.addEventListener('change', async (event) => {
      const studentSelect = event.target.closest('#student-name-select');
      const answerInput = event.target.closest('[data-answer-kind="choice"][data-question-id]');

      if (studentSelect) {
        selectedStudentId = studentSelect.value || '';
        resetQuizProgress();
        await loadQuizContext();
        return;
      }

      if (!answerInput) {
        return;
      }

      updateQuizAnswer(answerInput.dataset.questionId || '', answerInput.value || '');
      renderView();
      void saveQuizDraftNow();
    });

    slot.addEventListener('input', (event) => {
      const blankInput = event.target.closest('[data-answer-kind="blank"][data-question-id]');

      if (!blankInput) {
        return;
      }

      const questionId = blankInput.dataset.questionId || '';
      const hadError = Boolean(quizAnswerErrors[questionId]);
      updateQuizAnswer(questionId, blankInput.value || '');
      scheduleQuizDraftSave();

      if (hadError) {
        renderView();
      }
    });

    slot.addEventListener('submit', async (event) => {
      if (event.target.id !== 'student-quiz-form') {
        return;
      }

      event.preventDefault();

      if (!quizContext?.quiz || !selectedStudentId || !lockedClassCode) {
        return;
      }

      const validation = validateQuizAnswerMap(quizContext.quiz, quizAnswers);

      if (!validation.isValid) {
        quizAnswerErrors = validation.errors;
        const firstInvalidQuestionId = Object.keys(validation.errors)[0] || '';
        const firstInvalidIndex = findQuestionIndex(quizContext.quiz, firstInvalidQuestionId);

        if (firstInvalidIndex >= 0) {
          quizCurrentQuestionIndex = firstInvalidIndex;
        }

        renderView();
        return;
      }

      quizSubmitting = true;
      quizAnswerErrors = {};
      renderView();

      try {
        await saveQuizDraftNow();
        await submitStudentQuiz({
          classCode: lockedClassCode,
          studentId: selectedStudentId,
          answers: quizAnswers,
        });
        resetQuizProgress({ keepContext: true });
        showToast({
          title: 'Đã nộp bài',
          message: 'Hệ thống đã ghi nhận bài kiểm tra của bạn.',
          variant: 'success',
        });
        await loadQuizContext();
      } catch (submitError) {
        showToast({
          title: 'Chưa nộp được bài',
          message: getErrorMessage(submitError, 'Không thể nộp bài kiểm tra lúc này.'),
          variant: 'danger',
        });
      } finally {
        quizSubmitting = false;
        renderView();
      }
    });

    document.addEventListener('keydown', handleKeydown);

    renderView();

    if (!lockedClassCode) {
      isLoading = false;
      error = 'Link học liệu không hợp lệ hoặc thiếu mã lớp.';
      renderView();
      return () => {
        disposed = true;
        stopQuizContextWatch();
        clearQuizDraftTimer();
        document.removeEventListener('keydown', handleKeydown);
        cleanupShortcut?.();
      };
    }

    try {
      preview = await getStudentLibraryView(lockedClassCode);
      activeLessonId =
        preview?.visibleLessons?.some((lesson) => lesson.id === activeLessonId) ? activeLessonId : getDefaultLessonId(preview);
      activeTab = normalizeLibraryTab(activeTab);
      error = '';
      syncUrlState();
    } catch (nextError) {
      preview = null;
      error = getErrorMessage(nextError, 'Không tải được học liệu của lớp này.');
    } finally {
      isLoading = false;
      renderView();
    }

    if (preview?.program) {
      await loadRoster();
      await refreshQuizForActiveLesson();
    }

    return () => {
      disposed = true;
      stopQuizContextWatch();
      clearQuizDraftTimer();
      document.removeEventListener('keydown', handleKeydown);
      cleanupShortcut?.();
    };
  },
};
