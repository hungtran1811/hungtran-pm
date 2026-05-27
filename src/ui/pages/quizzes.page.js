import { subscribeClasses } from '../../services/classes.service.js';
import { subscribeCurriculumPrograms } from '../../services/curriculum.service.js';
import { QUIZ_OPERATIONS_ENABLED } from '../../config/features.js';
import {
  getQuizLiveAttemptsByClass,
  getQuizAttemptsByClass,
  listQuizConfigs,
  reopenQuizAttempt,
  saveQuizConfig,
  setClassQuizStatus,
} from '../../services/quizzes.service.js';
import { isCloudinaryConfigured, uploadCurriculumLessonImage } from '../../services/cloudinary.service.js';
import { getAuthState } from '../../state/auth.store.js';
import {
  getCurriculumActivityTypeLabel,
  getCurriculumSessionActivity,
  isCurriculumQuizActivity,
} from '../../utils/curriculum-program.js';
import { escapeHtml } from '../../utils/html.js';
import {
  createQuizItemId,
  formatQuizReadinessRequirement,
  getQuizReadiness,
  isOfficialQuizMode,
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
  validateQuizConfigRecord,
} from '../../utils/quiz.js';
import { buildQuizSampleConfig } from '../../utils/quiz-samples.js';
import { renderAlert } from '../components/Alert.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { showToast } from '../components/ToastStack.js';
import { renderAttemptList } from './quizzes/attempt-list.view.js';
import {
  decorateAttemptByBestScore,
  getAttemptSubmissionHistory,
  getBestAttemptSubmission,
  getLatestAttemptSubmission,
} from './quizzes/attempt-grading.js';
import { renderAttemptOverviewReport } from './quizzes/attempt-overview.view.js';
import { renderAttemptDetailModal } from './quizzes/attempt-detail.view.js';
import { getProgramSessionOptions, renderQuizEditor } from './quizzes/quiz-editor.view.js';

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
      timeLimitMinutes: 30,
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

function getClassProgram(selectedClass, programs = []) {
  return programs.find((program) => program.id === selectedClass?.curriculumProgramId) || null;
}

function getClassQuizActivity(selectedClass, programs = []) {
  const program = getClassProgram(selectedClass, programs);
  const sessionNumber = Number(selectedClass?.curriculumCurrentSession || 0);
  return program ? getCurriculumSessionActivity(program, sessionNumber) : null;
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
      label: 'Trung tâm điều khiển',
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
  liveAttemptCount = 0,
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
      `Lớp này đang ở buổi ${currentSession || '?'} và được cấu hình là "${activityLabel}". Hãy đổi loại buổi sang "Kiểm tra" trong Bài giảng trước khi mở.`,
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
          <div class="col-12 col-md-6">
            <div class="quiz-status-meta">
              <div class="quiz-status-meta__label">Đang làm</div>
              <div class="fw-semibold">${Number(liveAttemptCount || 0)} học sinh</div>
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

export function renderQuizManagementContent({
  hideTabs = false,
  showBothPanels = false,
  enableOperations = QUIZ_OPERATIONS_ENABLED,
  mode = 'full',
  showLaunchControl = true,
} = {}) {
  const operationsEnabled = Boolean(enableOperations);
  const normalizedMode = ['editor', 'operations', 'full'].includes(mode) ? mode : 'full';
  const renderEditorPanel = normalizedMode !== 'operations';
  const renderOperationsPanel = operationsEnabled && normalizedMode !== 'editor';
  const renderTabs = normalizedMode === 'full' && !hideTabs && operationsEnabled;

  return `
    <div id="quiz-tabs-slot">${renderTabs ? renderQuizPageTabs('editor') : ''}</div>
    ${
      renderEditorPanel
        ? `
          <section id="quiz-editor-panel">
            <div id="quiz-editor-slot">${renderLoadingOverlay('Đang tải cấu hình trắc nghiệm...')}</div>
          </section>
        `
        : ''
    }
    ${
      renderOperationsPanel
        ? `
          <section id="quiz-operations-panel" class="${normalizedMode === 'operations' || showBothPanels ? 'mt-4' : 'd-none'}">
            <div id="quiz-operation-tabs-slot"></div>
            ${
              showLaunchControl
                ? `<div id="quiz-launch-control-slot" class="mb-3">${renderLoadingOverlay('Đang tải điều khiển bài kiểm tra...')}</div>`
                : ''
            }
            <section id="quiz-operation-overview-panel">
              <div id="quiz-report-slot">${renderLoadingOverlay('Đang tổng hợp báo cáo nhanh...')}</div>
            </section>
            <section id="quiz-operation-attempts-panel" class="d-none">
              <div id="quiz-attempt-list-slot">${renderLoadingOverlay('Đang tải danh sách lớp...')}</div>
            </section>
          </section>
        `
        : ''
    }
    <div id="quiz-attempt-modal-slot"></div>
  `;
}

function renderQuizOperationTabs(activeTab = 'overview') {
  const tabs = [
    { id: 'overview', label: 'Báo cáo nhanh', icon: 'bar-chart-line' },
    { id: 'attempts', label: 'Bài nộp', icon: 'clipboard-check' },
  ];

  return `
    <div class="quiz-control-tabs" role="tablist" aria-label="Trung tâm điều khiển quiz">
      ${tabs
        .map((tab) => `
          <button
            type="button"
            class="quiz-control-tab ${tab.id === activeTab ? 'quiz-control-tab--active' : ''}"
            data-action="switch-quiz-operation-tab"
            data-tab-id="${tab.id}"
          >
            <i class="bi bi-${tab.icon} me-2"></i>${tab.label}
          </button>
        `)
        .join('')}
    </div>
  `;
}

export const quizzesPage = {
  title: 'Quản lý trắc nghiệm',
  async render() {
    const authState = getAuthState();

    return renderAppShell({
      title: 'Quản lý trắc nghiệm',
      subtitle: 'Soạn đề theo buổi, test quiz admin và chuẩn bị ngân hàng câu hỏi.',
      currentRoute: '/admin/quizzes',
      user: authState.user,
      content: renderQuizManagementContent({
        enableOperations: QUIZ_OPERATIONS_ENABLED,
      }),
    });
  },
  async mount() {
    return mountQuizManagement({
      enableOperations: QUIZ_OPERATIONS_ENABLED,
    });
  },
};

export async function mountQuizManagement({
  defaultActiveTab = 'editor',
  forceDefaultTab = false,
  lockedProgramId = '',
  lockedSessionNumber = 0,
  lockedClassCode = '',
  hideTabs = false,
  showBothPanels = false,
  enableOperations = QUIZ_OPERATIONS_ENABLED,
  mode = 'full',
  showLaunchControl = true,
} = {}) {
    const operationsEnabled = Boolean(enableOperations);
    const normalizedMode = ['editor', 'operations', 'full'].includes(mode) ? mode : 'full';
    const savedUiState = {
      activeTab: normalizedMode === 'operations'
        ? 'operations'
        : normalizedMode === 'editor'
          ? 'editor'
          : operationsEnabled && !forceDefaultTab
        ? loadQuizAdminUiState().activeTab || defaultActiveTab
        : defaultActiveTab,
    };
    const tabsSlot = document.getElementById('quiz-tabs-slot');
    const editorPanel = document.getElementById('quiz-editor-panel');
    const operationsPanel = document.getElementById('quiz-operations-panel');
    const operationTabsSlot = document.getElementById('quiz-operation-tabs-slot');
    const operationOverviewPanel = document.getElementById('quiz-operation-overview-panel');
    const operationAttemptsPanel = document.getElementById('quiz-operation-attempts-panel');
    const editorSlot = document.getElementById('quiz-editor-slot');
    const launchControlSlot = document.getElementById('quiz-launch-control-slot');
    const attemptListSlot = document.getElementById('quiz-attempt-list-slot');
    const reportSlot = document.getElementById('quiz-report-slot');
    const attemptModalSlot = document.getElementById('quiz-attempt-modal-slot');

    if (!editorSlot && !attemptListSlot && !reportSlot) {
      return null;
    }

    const state = {
      classes: [],
      programs: [],
      selectedProgramId: lockedProgramId || '',
      selectedSessionNumber: Number(lockedSessionNumber || QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS[0]),
      quizConfigs: [],
      draft: createEmptyQuizDraft(QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS[0]),
      quizLoading: true,
      quizError: '',
      isSavingQuiz: false,
      uploadingQuestionId: '',
      isUpdatingClassQuiz: false,
      classQuizError: '',
      attempts: [],
      liveAttempts: [],
      attemptConfigs: [],
      attemptsLoading: false,
      attemptsError: '',
      selectedClassCode: lockedClassCode || '',
      selectedSessionFilter: 'all',
      selectedAttemptId: '',
      activeTab: operationsEnabled && savedUiState.activeTab === 'operations' ? 'operations' : 'editor',
      operationTab: 'overview',
      isAttemptModalOpen: false,
      reopeningAttemptId: '',
      attemptModalInfo: '',
      attemptModalError: '',
      hasLoadedQuizConfigs: false,
      hasLoadedAttempts: !operationsEnabled,
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

    function getFilteredLiveAttempts(liveAttempts = state.liveAttempts) {
      return liveAttempts.filter((attempt) => {
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
      if (tabsSlot) {
        tabsSlot.innerHTML =
          normalizedMode === 'full' && !hideTabs && operationsEnabled
            ? renderQuizPageTabs(state.activeTab)
            : '';
      }

      if (normalizedMode === 'editor' || !operationsEnabled) {
        editorPanel?.classList.remove('d-none');
        operationsPanel?.classList.add('d-none');
      } else if (normalizedMode === 'operations') {
        editorPanel?.classList.add('d-none');
        operationsPanel?.classList.remove('d-none');
      } else if (showBothPanels) {
        editorPanel?.classList.remove('d-none');
        operationsPanel?.classList.remove('d-none');
        operationsPanel?.classList.add('mt-4');
      } else {
        editorPanel?.classList.toggle('d-none', state.activeTab !== 'editor');
        operationsPanel?.classList.toggle('d-none', state.activeTab !== 'operations');
      }

      if (operationTabsSlot) {
        operationTabsSlot.innerHTML = renderQuizOperationTabs(state.operationTab);
      }

      operationOverviewPanel?.classList.toggle('d-none', state.operationTab !== 'overview');
      operationAttemptsPanel?.classList.toggle('d-none', state.operationTab !== 'attempts');

      const manageableClasses = getQuizManageableClasses(state.classes);
      const selectedClass = getSelectedClass(manageableClasses, state.selectedClassCode);
      const selectedProgram = state.programs.find((program) => program.id === state.selectedProgramId) || null;
      const selectedClassProgram = getClassProgram(selectedClass, state.programs);
      const selectedClassActivity = getClassQuizActivity(selectedClass, state.programs);
      const sessionFilterOptions = getProgramSessionOptions(selectedClassProgram || selectedProgram)
        .filter((session) => isCurriculumQuizActivity(session.activityType));
      const activeClassConfigs = getActiveQuizConfigsForClass(
        selectedClass,
        state.quizConfigs,
        state.attemptConfigs,
        state.selectedProgramId,
      );
      const currentQuizConfig = getSelectedClassQuizConfig(selectedClass, activeClassConfigs);
      const decoratedAttempts = state.attempts.map((attempt) => decorateAttemptByBestScore(attempt, activeClassConfigs));
      const filteredAttempts = getFilteredAttempts(decoratedAttempts);
      const filteredLiveAttempts = getFilteredLiveAttempts();
      const selectedAttempt = getSelectedAttempt(filteredAttempts);
      const officialReportAttempts = filteredAttempts.filter((attempt) => isOfficialQuizMode(attempt.quizMode));

      if (editorSlot) {
        editorSlot.innerHTML = renderQuizEditor({
          programs: state.programs,
          selectedProgramId: state.selectedProgramId,
          selectedSessionNumber: state.selectedSessionNumber,
          selectedProgram,
          draft: state.draft,
          isLoading: state.quizLoading,
          isSaving: state.isSavingQuiz,
          uploadingQuestionId: state.uploadingQuestionId,
          imageUploadEnabled: isCloudinaryConfigured(),
          error: state.quizError,
          contextLocked: Boolean(lockedProgramId || lockedSessionNumber),
        });
      }

      if (operationsEnabled && launchControlSlot) {
        launchControlSlot.innerHTML = showLaunchControl ? renderClassQuizLaunchControl({
          selectedClass,
          currentQuizConfig,
          sessionActivity: selectedClassActivity,
          liveAttemptCount: filteredLiveAttempts.length,
          isUpdating: state.isUpdatingClassQuiz,
          error: state.classQuizError,
        }) : '';
      }

      if (operationsEnabled && attemptListSlot && reportSlot) {
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

        reportSlot.innerHTML = renderAttemptOverviewReport(officialReportAttempts, filteredLiveAttempts.length);
      }

      if (attemptModalSlot) {
        const existingAttemptModalEl = document.body.querySelector('#quiz-attempt-detail-modal');
        if (existingAttemptModalEl) {
          window.bootstrap?.Modal?.getInstance(existingAttemptModalEl)?.dispose();
          existingAttemptModalEl.remove();
        }

        attemptModalSlot.innerHTML = operationsEnabled
          ? renderAttemptDetailModal(selectedAttempt, state.isAttemptModalOpen, {
              submissionHistory: getAttemptSubmissionHistory(selectedAttempt),
              bestSubmission: getBestAttemptSubmission(selectedAttempt),
              latestSubmission: getLatestAttemptSubmission(selectedAttempt),
              isReopening:
                Boolean(state.reopeningAttemptId) && state.reopeningAttemptId === (selectedAttempt?.id || ''),
              info: state.attemptModalInfo,
              error: state.attemptModalError,
            })
          : '';

        const attemptModalEl = attemptModalSlot.querySelector('#quiz-attempt-detail-modal');
        if (attemptModalEl && state.isAttemptModalOpen && window.bootstrap?.Modal) {
          document.body.appendChild(attemptModalEl);
          const attemptModal = window.bootstrap.Modal.getOrCreateInstance(attemptModalEl);
          attemptModal.show();
          attemptModalEl.addEventListener('hidden.bs.modal', () => {
            attemptModal.dispose();
            const shouldRender = state.isAttemptModalOpen;
            state.isAttemptModalOpen = false;
            state.attemptModalInfo = '';
            state.attemptModalError = '';
            state.reopeningAttemptId = '';
            attemptModalEl.remove();
            attemptModalSlot.innerHTML = '';
            if (shouldRender) {
              renderView();
            }
          }, { once: true });
        }
      }
    }

    async function loadQuizConfigs() {
      if (!state.selectedProgramId) {
        state.quizConfigs = [];
        state.quizLoading = false;
        state.quizError = '';
        state.hasLoadedQuizConfigs = true;
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
        state.hasLoadedQuizConfigs = true;
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
      if (!operationsEnabled) {
        state.attempts = [];
        state.liveAttempts = [];
        state.attemptConfigs = [];
        state.attemptsLoading = false;
        state.attemptsError = '';
        state.hasLoadedAttempts = true;
        return;
      }

      const preserveSelection = Boolean(options.preserveSelection);
      const keepModalOpen = Boolean(options.keepModalOpen);
      const previousSelectedAttemptId = state.selectedAttemptId;
      const previousModalOpen = state.isAttemptModalOpen;

      if (!preserveSelection) {
        state.attempts = [];
        state.liveAttempts = [];
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
        state.hasLoadedAttempts = true;
        renderView();
        return;
      }

      state.attemptsLoading = true;
      renderView();

      try {
        const selectedClass = getSelectedClass(getQuizManageableClasses(state.classes), state.selectedClassCode);
        const selectedClassProgram = getClassProgram(selectedClass, state.programs);
        const [attempts, liveAttempts, attemptConfigs] = await Promise.all([
          getQuizAttemptsByClass(state.selectedClassCode),
          getQuizLiveAttemptsByClass(state.selectedClassCode),
          selectedClassProgram ? listQuizConfigs(selectedClassProgram) : Promise.resolve([]),
        ]);

        state.attemptConfigs = attemptConfigs;
        state.attempts = attempts;
        state.liveAttempts = liveAttempts;
        state.hasLoadedAttempts = true;

        if (preserveSelection) {
          const hasPreviousAttempt = attempts.some((attempt) => attempt.id === previousSelectedAttemptId);
          state.selectedAttemptId = hasPreviousAttempt ? previousSelectedAttemptId : '';
          state.isAttemptModalOpen = keepModalOpen && previousModalOpen && Boolean(state.selectedAttemptId);
        }
      } catch (error) {
        if (!preserveSelection) {
          state.attempts = [];
          state.liveAttempts = [];
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
        const lockedProgramExists = lockedProgramId && programs.some((program) => program.id === lockedProgramId);
        const nextProgramId = lockedProgramExists
          ? lockedProgramId
          : (
              state.selectedProgramId && programs.some((program) => program.id === state.selectedProgramId)
                ? state.selectedProgramId
                : programs[0]?.id || ''
            );

        if (state.selectedProgramId !== nextProgramId || !state.hasLoadedQuizConfigs) {
          state.selectedProgramId = nextProgramId;
          state.selectedSessionNumber = Number(lockedSessionNumber || state.selectedSessionNumber || QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS[0]);
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

    const unsubscribeClasses = operationsEnabled
      ? subscribeClasses(
          async (classes) => {
            state.classes = classes;
            const manageableClasses = getQuizManageableClasses(classes);
            const lockedClassExists = lockedClassCode
              && manageableClasses.some((classItem) => classItem.classCode === lockedClassCode);
            const nextClassCode = lockedClassExists
              ? lockedClassCode
              : (
                  state.selectedClassCode
                  && manageableClasses.some((classItem) => classItem.classCode === state.selectedClassCode)
                    ? state.selectedClassCode
                    : manageableClasses[0]?.classCode || ''
                );

            if (state.selectedClassCode !== nextClassCode || !state.hasLoadedAttempts) {
              state.selectedClassCode = nextClassCode;
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
        )
      : () => {};

    tabsSlot?.addEventListener('click', (event) => {
      const tabButton = event.target.closest('[data-action="switch-quiz-tab"]');

      if (!operationsEnabled || !tabButton) {
        return;
      }

      state.activeTab = tabButton.dataset.tabId === 'operations' ? 'operations' : 'editor';
      renderView();
    });

    editorSlot?.addEventListener('change', async (event) => {
      const programSelect = event.target.closest('#quiz-program-select');
      const sessionSelect = event.target.closest('#quiz-session-select');
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

    editorSlot?.addEventListener('input', (event) => {
      const titleInput = event.target.closest('#quiz-title-input');
      const timeLimitInput = event.target.closest('#quiz-time-limit-input');
      const descriptionInput = event.target.closest('#quiz-description-input');
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

      if (timeLimitInput) {
        state.draft = {
          ...state.draft,
          timeLimitMinutes: Math.min(180, Math.max(1, Math.round(Number(timeLimitInput.value || 30)))),
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

    editorSlot?.addEventListener('click', async (event) => {
      const sessionButton = event.target.closest('[data-action="select-session"]');
      const addQuestionButton = event.target.closest('[data-action="add-question"]');
      const useSampleButton = event.target.closest('[data-action="use-quiz-sample"]');
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

      if (addQuestionButton) {
        addQuestion();
        renderView();
        return;
      }

      if (useSampleButton) {
        try {
          const selectedProgram = state.programs.find((program) => program.id === state.selectedProgramId) || null;

          if (!selectedProgram) {
            throw new Error('Hãy chọn chương trình trước khi dùng bộ đề mẫu.');
          }

          state.draft = buildQuizSampleConfig({
            subject: selectedProgram.subject || state.draft.subject || '',
            level: selectedProgram.level || state.draft.level || '',
            sessionNumber: state.selectedSessionNumber,
          });
          state.quizError = '';
          showToast({
            title: 'Đã nạp bộ đề mẫu',
            message: `Bộ đề mẫu buổi ${state.selectedSessionNumber} đã được đưa vào editor. Hãy kiểm tra rồi bấm lưu.`,
            variant: 'success',
          });
        } catch (error) {
          state.quizError = getErrorMessage(error, 'Không thể nạp bộ đề mẫu cho buổi này.');
        }
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

    launchControlSlot?.addEventListener('click', async (event) => {
      if (!operationsEnabled) {
        return;
      }

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
        const statusResult = await setClassQuizStatus(state.selectedClassCode, {
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
            : `Đề đã được ẩn khỏi phía học sinh. Đã ghi nhận ${Number(statusResult?.finalizedCount || 0)} bài đang làm.`,
          variant: 'success',
        });
        await loadAttempts({ preserveSelection: true, keepModalOpen: true });
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

    operationsPanel?.addEventListener('click', (event) => {
      const operationTabButton = event.target.closest('[data-action="switch-quiz-operation-tab"]');

      if (!operationTabButton) {
        return;
      }

      state.operationTab = operationTabButton.dataset.tabId === 'attempts' ? 'attempts' : 'overview';
      renderView();
    });

    attemptListSlot?.addEventListener('change', async (event) => {
      if (!operationsEnabled) {
        return;
      }

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

    attemptListSlot?.addEventListener('click', (event) => {
      if (!operationsEnabled) {
        return;
      }

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

    const handleAttemptModalClick = async (event) => {
      if (!operationsEnabled) {
        return;
      }

      const closeButton = event.target.closest('[data-action="close-attempt-modal"]');

      if (closeButton) {
        state.isAttemptModalOpen = false;
        state.attemptModalInfo = '';
        state.attemptModalError = '';
        state.reopeningAttemptId = '';
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
    };

    document.addEventListener('click', handleAttemptModalClick);

    renderView();

    return () => {
      document.removeEventListener('click', handleAttemptModalClick);
      unsubscribePrograms?.();
      unsubscribeClasses?.();
    };
}

