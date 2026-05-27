import {
  getClassCurriculumView,
  getCurriculumProgram,
  getCurriculumProgramGroups,
  archiveEmptyCurriculumSession,
  deleteArchivedCurriculumLesson,
  saveClassCurriculumAssignment,
  saveCurriculumExamChecklistItem,
  saveCurriculumLesson,
  saveCurriculumProjectStages,
  saveCurriculumSessionActivity,
  setCurriculumProgramSessionCount,
  setCurriculumExamChecklistItemArchived,
  setCurriculumLessonArchived,
  subscribeCurriculumPrograms,
} from '../../services/curriculum.service.js';
import { isCloudinaryConfigured, uploadCurriculumLessonImage } from '../../services/cloudinary.service.js';
import { subscribeClasses } from '../../services/classes.service.js';
import { setClassQuizStatus } from '../../services/quizzes.service.js';
import {
  QUIZ_ADMIN_TEST_ENABLED,
  QUIZ_OPERATIONS_ENABLED,
} from '../../config/features.js';
import { getAuthState } from '../../state/auth.store.js';
import { mapFirebaseError } from '../../utils/firebase-error.js';
import { escapeHtml } from '../../utils/html.js';
import {
  clampCurriculumSession,
  normalizeCurriculumExerciseVisibleSessions,
  setCurriculumExerciseVisibleForSession,
} from '../../utils/curriculum.js';
import { getHashRouteState } from '../../utils/route.js';
import {
  LESSON_MARKDOWN_TAB_EXERCISE,
  LESSON_MARKDOWN_TAB_LECTURE,
  normalizeLessonMarkdownTab,
} from '../../utils/lesson-markdown.js';
import {
  QUIZ_CLASS_STATUS_STARTED,
  QUIZ_MODE_OFFICIAL,
} from '../../utils/quiz.js';
import {
  getCurriculumActivityTypeLabel,
  getCurriculumSessionActivity,
  isCurriculumQuizActivity,
  createCurriculumItemId,
  getActiveCurriculumChecklist,
  getActiveCurriculumLessons,
  getArchivedCurriculumChecklist,
} from '../../utils/curriculum-program.js';
import { mountQuizManagement } from './quizzes.page.js';
import {
  getAssignmentQuizControlState,
  getInitialDraft,
  hasSavedCurriculumAssignment,
  isDraftDifferentFromSaved,
  renderAssignmentWorkspaceSimple,
} from './curriculum/assignment-workspace.view.js';
import { renderCurriculumWorkspaceSwitch } from './curriculum/content-workspace.view.js';
import {
  createReviewLinkRowV3,
  getLessonBannerFromFormV3,
  getLessonImagesFromFormV3,
  getReviewLinksFromFormV3,
  refreshReviewLinkControlsV3,
  setLessonBannerFormStateV3,
  setLessonImagesFormStateV3,
  syncBannerImageAltFormStateV3,
  syncLessonImageAltFormStateV3,
  syncLessonMarkdownPreviewV3,
} from './curriculum/lesson-editor.view.js';
import {
  findLessonBySession,
  getLessonSessionLimit,
  renderContentWorkspaceHorizontal,
  renderQuizOperationsWorkspace,
} from './curriculum/program-picker.view.js';
import {
  buildPreviewView,
  getDefaultPreviewLessonId,
  normalizePreviewTab,
} from './curriculum/preview-context.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderStudentLibraryBrowser } from '../components/StudentLibraryBrowser.js';
import { confirmDialog } from '../components/ConfirmDialog.js';
import { showToast } from '../components/ToastStack.js';

const FINAL_MODE_LABELS = {
  project: 'Sản phẩm cuối khóa',
  exam: 'Kiểm tra cuối khóa',
};

const FINAL_MODE_BADGE_CLASSES = {
  project: 'text-bg-success',
  exam: 'text-bg-info',
};

const QUIZ_UI_ENABLED = QUIZ_ADMIN_TEST_ENABLED;

function getOperationalClasses(classes) {
  return classes.filter((item) => item.status === 'active' && !item.hidden);
}

function reorderItemsById(items, sourceId, targetId) {
  const nextItems = [...items];
  const sourceIndex = nextItems.findIndex((item) => item.id === sourceId);
  const targetIndex = nextItems.findIndex((item) => item.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return items;
  }

  const [movedItem] = nextItems.splice(sourceIndex, 1);
  nextItems.splice(targetIndex, 0, movedItem);

  return nextItems;
}

function renderCompactCurriculumPageV3(state) {
  const classes = getOperationalClasses(state.classes);
  const programGroups = getCurriculumProgramGroups(state.programs);
  const selectedClass = classes.find((item) => item.classCode === state.selectedClassCode) || null;
  const assignment = selectedClass ? state.draftsByClassCode[selectedClass.classCode] || null : null;
  const selectedSessionNumber = Math.max(1, Number(state.selectedActivitySessionNumber || assignment?.currentSession || 1));

  return `
    ${state.error ? `<div class="alert alert-danger mb-3">${escapeHtml(state.error)}</div>` : ''}

    ${renderCurriculumWorkspaceSwitch(state.workspaceSection)}

    ${
      state.isLoadingClasses || state.isLoadingPrograms
        ? renderLoadingOverlay('Đang tải dữ liệu bài giảng...')
        : state.programs.length === 0
          ? renderEmptyState({
              icon: 'journal-richtext',
              title: 'Chưa có chương trình mẫu trong Firestore',
              description: 'Hãy chạy script seed curriculum trước khi gán bài giảng hoặc chỉnh lesson cho lớp.',
            })
          : classes.length === 0
            ? renderEmptyState({
                icon: 'collection',
                title: 'Chưa có lớp đang hoạt động',
                description: 'Tạo ít nhất một lớp active để bắt đầu gán chương trình học.',
              })
            : state.workspaceSection === 'assignment'
              ? renderAssignmentWorkspaceSimple(
                  classes,
                  state.programs,
                  state.selectedClassCode,
                  selectedClass,
                  assignment,
                  state,
                )
              : state.workspaceSection === 'editor'
                ? renderContentWorkspaceHorizontal({
                    programGroups,
                    selectedProgramId: state.selectedProgramId,
                    selectedSessionNumber,
                    busyKey: state.busyKey,
                    editorTab: state.editorTab,
                    selectedClassCode: state.selectedClassCode,
                    quizUiEnabled: QUIZ_UI_ENABLED,
                  })
                : renderQuizOperationsWorkspace()
    }
  `;
}

export const curriculumDemoPage = {
  title: 'Bài giảng',
  async render() {
    const authState = getAuthState();

    return renderAppShell({
      title: 'Bài giảng',
      subtitle: '',
      currentRoute: '/admin/curriculum',
      user: authState.user,
      content: '<div id="curriculum-demo-root" class="curriculum-page-root"></div>',
    });
  },
  async mount() {
    const root = document.getElementById('curriculum-demo-root');
    const routeState = getHashRouteState();
    const initialWorkspaceSection =
      routeState.workspace === 'quiz'
        ? 'quiz-control'
        : routeState.workspace === 'editor'
          ? 'editor'
          : 'assignment';
    const initialSessionNumber = routeState.sessionNumber || (routeState.workspace === 'quiz' ? 5 : 1);
    const state = {
      classes: [],
      programs: [],
      isLoadingClasses: true,
      isLoadingPrograms: true,
      error: '',
      selectedProgramId: '',
      selectedLessonId: '',
      selectedChecklistId: '',
      selectedClassCode: routeState.classCode || '',
      workspaceSection: initialWorkspaceSection,
      editorTab: 'lessons',
      selectedActivitySessionNumber: initialSessionNumber,
      didInitializeActivitySession: Boolean(routeState.sessionNumber || routeState.workspace === 'quiz'),
      previewLessonId: '',
      previewTab: LESSON_MARKDOWN_TAB_LECTURE,
      previewImageSelections: {},
      draftsByClassCode: {},
      busyKey: '',
    };

    function getSelectedClass() {
      return getOperationalClasses(state.classes).find((item) => item.classCode === state.selectedClassCode) || null;
    }

    function getSelectedProgram() {
      return state.programs.find((item) => item.id === state.selectedProgramId) || null;
    }

    function selectCurriculumSession(sessionNumber) {
      const selectedProgram = getSelectedProgram();
      const sessionLimit = getLessonSessionLimit(selectedProgram);
      const nextSessionNumber = Math.min(
        sessionLimit,
        Math.max(1, Number(sessionNumber || 1)),
      );
      const lesson = findLessonBySession(selectedProgram, nextSessionNumber);

      state.selectedActivitySessionNumber = nextSessionNumber;
      state.selectedLessonId = lesson?.id || 'new';
      state.editorTab = 'lessons';
    }

    function replaceProgram(nextProgram) {
      if (!nextProgram) {
        return;
      }

      state.programs = state.programs.map((program) => (program.id === nextProgram.id ? nextProgram : program));
    }

    async function refreshProgram(programId) {
      const freshProgram = await getCurriculumProgram(programId);

      if (freshProgram) {
        replaceProgram(freshProgram);
      }
    }

    function ensureDraftForClass(classItem) {
      if (!classItem || state.programs.length === 0) {
        return null;
      }

      if (!state.draftsByClassCode[classItem.classCode]) {
        state.draftsByClassCode[classItem.classCode] = getInitialDraft(classItem, state.programs);
      }

      return state.draftsByClassCode[classItem.classCode];
    }

    function syncSelectedClass() {
      const classes = getOperationalClasses(state.classes);

      if (classes.length === 0) {
        state.selectedClassCode = '';
        return;
      }

      if (!classes.some((item) => item.classCode === state.selectedClassCode)) {
        state.selectedClassCode = classes[0].classCode;
      }

      const selectedClass = classes.find((item) => item.classCode === state.selectedClassCode) || null;
      const draft = ensureDraftForClass(selectedClass);

      if (!state.selectedProgramId && draft?.programId) {
        state.selectedProgramId = draft.programId;
      }

      if (!state.didInitializeActivitySession && draft?.currentSession) {
        state.didInitializeActivitySession = true;
        state.selectedActivitySessionNumber = Number(draft.currentSession || 1);
      }
    }

    function syncSelectedProgram() {
      if (state.programs.length === 0) {
        state.selectedProgramId = '';
        return;
      }

      const selectedClass = getSelectedClass();
      const selectedDraft = ensureDraftForClass(selectedClass);
      const fallbackProgramId = selectedDraft?.programId || state.programs[0]?.id || '';

      if (!state.programs.some((item) => item.id === state.selectedProgramId)) {
        state.selectedProgramId = fallbackProgramId;
      }

      const selectedProgram = getSelectedProgram();
      const activeLessons = getActiveCurriculumLessons(selectedProgram);
      const activeChecklist = getActiveCurriculumChecklist(selectedProgram);
      const sessionLimit = Math.max(
        1,
        Number(selectedProgram?.totalSessionCount || selectedProgram?.knowledgePhaseEndSession || 1),
      );

      state.selectedActivitySessionNumber = Math.min(
        sessionLimit,
        Math.max(1, Number(state.selectedActivitySessionNumber || 1)),
      );

      const lessonForSelectedSession = findLessonBySession(selectedProgram, state.selectedActivitySessionNumber);
      state.selectedLessonId = lessonForSelectedSession?.id || 'new';

      if (selectedProgram?.finalMode === 'exam') {
        if (
          state.selectedChecklistId !== 'new' &&
          !activeChecklist.some((item) => item.id === state.selectedChecklistId)
        ) {
          state.selectedChecklistId = activeChecklist[0]?.id || 'new';
        }
      } else {
        state.selectedChecklistId = '';
      }
    }

    function getCurrentPreviewContext() {
      const selectedClass = getSelectedClass();
      const assignment = selectedClass ? ensureDraftForClass(selectedClass) : null;
      const previewProgram =
        state.programs.find((program) => program.id === (assignment?.programId || '')) || null;
      const preview = buildPreviewView(selectedClass, assignment, previewProgram);

      return {
        selectedClass,
        assignment,
        previewProgram,
        preview,
      };
    }

    function syncPreviewState() {
      const { preview } = getCurrentPreviewContext();

      state.previewTab = normalizePreviewTab(state.previewTab);

      if (!preview?.visibleLessons?.length) {
        state.previewLessonId = '';
        return;
      }

      state.previewLessonId = getDefaultPreviewLessonId(preview, state.previewLessonId);
    }

    let quizManagementCleanup = null;
    let quizManagementMountToken = 0;

    function cleanupQuizManagement() {
      quizManagementMountToken += 1;
      quizManagementCleanup?.();
      quizManagementCleanup = null;
    }

    function mountEmbeddedQuizManagement() {
      cleanupQuizManagement();

      const selectedProgram = getSelectedProgram();
      const selectedActivity = selectedProgram
        ? getCurriculumSessionActivity(selectedProgram, state.selectedActivitySessionNumber)
        : null;
      const isQuizControlWorkspace = state.workspaceSection === 'quiz-control';
      const shouldMountQuiz =
        QUIZ_UI_ENABLED
        && selectedProgram
        && (
          isQuizControlWorkspace
          || (state.workspaceSection === 'editor' && isCurriculumQuizActivity(selectedActivity?.activityType))
        );

      if (
        !shouldMountQuiz ||
        (
          !document.getElementById('quiz-editor-slot') &&
          !document.getElementById('quiz-attempt-list-slot') &&
          !document.getElementById('quiz-report-slot')
        )
      ) {
        return;
      }

      const mountToken = quizManagementMountToken;
      const defaultActiveTab = isQuizControlWorkspace ? 'operations' : 'editor';

      void mountQuizManagement({
        embedded: true,
        defaultActiveTab,
        forceDefaultTab: true,
        lockedProgramId: selectedProgram.id,
        lockedSessionNumber: state.selectedActivitySessionNumber,
        lockedClassCode: state.selectedClassCode,
        hideTabs: true,
        showBothPanels: false,
        enableOperations: isQuizControlWorkspace ? QUIZ_OPERATIONS_ENABLED : false,
        mode: isQuizControlWorkspace ? 'operations' : 'editor',
        showLaunchControl: false,
      }).then((cleanup) => {
        if (mountToken !== quizManagementMountToken) {
          cleanup?.();
          return;
        }

        quizManagementCleanup = cleanup;
      });
    }

    function renderView() {
      if (!['assignment', 'editor', 'quiz-control'].includes(state.workspaceSection)) {
        state.workspaceSection = 'editor';
      }

      syncSelectedClass();
      syncSelectedProgram();
      syncPreviewState();
      root.innerHTML = renderCompactCurriculumPageV3(state);
      mountEmbeddedQuizManagement();
    }

    function updateDraftForSelectedClass(patch) {
      const selectedClass = getSelectedClass();

      if (!selectedClass) {
        return;
      }

      const current = ensureDraftForClass(selectedClass);
      const programId = patch.programId || current.programId;
      const program = state.programs.find((item) => item.id === programId) || null;

      state.draftsByClassCode[selectedClass.classCode] = {
        ...current,
        ...patch,
        programId,
        currentSession: clampCurriculumSession(program, patch.currentSession ?? current.currentSession),
        exerciseVisibleSessions: normalizeCurriculumExerciseVisibleSessions(
          patch.exerciseVisibleSessions ?? current.exerciseVisibleSessions,
          program,
        ),
        curriculumPhase:
          patch.curriculumPhase === 'final'
            ? 'final'
            : patch.curriculumPhase === 'learning'
              ? 'learning'
              : current.curriculumPhase,
      };
    }

    async function persistClassAssignment(selectedClass, assignment) {
      await saveClassCurriculumAssignment(selectedClass.classCode, {
        curriculumProgramId: assignment.programId,
        curriculumCurrentSession: assignment.currentSession,
        curriculumPhase: assignment.curriculumPhase,
        curriculumExerciseVisibleSessions: assignment.exerciseVisibleSessions || [],
      });

      const latestView = await getClassCurriculumView(selectedClass.classCode, { publicAccess: false });
      state.draftsByClassCode[selectedClass.classCode] = latestView.assignment || assignment;

      if (latestView.classInfo) {
        state.classes = state.classes.map((classItem) =>
          classItem.classCode === selectedClass.classCode
            ? {
                ...classItem,
                ...latestView.classInfo,
              }
            : classItem,
        );
      }

      return latestView;
    }

    let draggingLessonImageId = '';

    root.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');

      if (!button) {
        return;
      }

      const selectedProgram = getSelectedProgram();

      if (button.dataset.action === 'switch-workspace') {
        const allowedWorkspaces = ['assignment', 'editor', 'quiz-control'];
        state.workspaceSection = allowedWorkspaces.includes(button.dataset.workspace)
          ? button.dataset.workspace
          : 'assignment';

        renderView();
        return;
      }

      if (button.dataset.action === 'select-curriculum-session') {
        selectCurriculumSession(button.dataset.sessionNumber || 1);
        renderView();
        return;
      }

      if (button.dataset.action === 'select-assignment-class') {
        state.selectedClassCode = button.dataset.classCode || '';
        state.didInitializeActivitySession = false;
        const selectedClass = getSelectedClass();
        const draft = ensureDraftForClass(selectedClass);

        if (draft?.programId) {
          state.selectedProgramId = draft.programId;
          state.selectedActivitySessionNumber = Number(draft.currentSession || 1);
        }

        renderView();
        return;
      }

      if (button.dataset.action === 'select-library-lesson') {
        state.previewLessonId = button.dataset.lessonId || '';
        renderView();
        return;
      }

      if (button.dataset.action === 'select-library-tab') {
        state.previewTab = normalizePreviewTab(button.dataset.tab);
        renderView();
        return;
      }

      if (button.dataset.action === 'switch-lesson-markdown-tab') {
        const form = button.closest('form');
        const activeTab = normalizeLessonMarkdownTab(button.dataset.markdownTab);

        form?.querySelectorAll('[data-action="switch-lesson-markdown-tab"]').forEach((tabButton) => {
          tabButton.classList.toggle(
            'student-library-tab--active',
            normalizeLessonMarkdownTab(tabButton.dataset.markdownTab) === activeTab,
          );
        });

        form?.querySelectorAll('[data-markdown-pane]').forEach((pane) => {
          pane.classList.toggle(
            'd-none',
            normalizeLessonMarkdownTab(pane.dataset.markdownPane) !== activeTab,
          );
        });

        return;
      }

      if (button.dataset.action === 'go-to-library-neighbor') {
        state.previewLessonId = button.dataset.lessonId || '';
        renderView();
        return;
      }

      if (button.dataset.action === 'select-library-image') {
        const lessonId = button.dataset.lessonId || '';
        const imageId = button.dataset.imageId || '';

        if (!lessonId || !imageId) {
          return;
        }

        state.previewImageSelections = {
          ...state.previewImageSelections,
          [lessonId]: imageId,
        };
        renderView();
        return;
      }

      if (button.dataset.action === 'pick-markdown-file') {
        const form = button.closest('form');
        const markdownTab = normalizeLessonMarkdownTab(button.dataset.markdownTab);
        const fileInput = form?.querySelector(`input[name="${markdownTab}MarkdownFile"]`);
        fileInput?.click();
        return;
      }

      if (button.dataset.action === 'pick-banner-image') {
        const form = button.closest('form');
        const fileInput = form?.querySelector('input[name="bannerImageFile"]');

        if (!isCloudinaryConfigured()) {
          showToast({
            title: 'Cloudinary chưa sẵn sàng',
            message: 'Hãy cấu hình VITE_CLOUDINARY_CLOUD_NAME và VITE_CLOUDINARY_UPLOAD_PRESET trước khi tải banner.',
            variant: 'warning',
          });
          return;
        }

        fileInput?.click();
        return;
      }

      if (button.dataset.action === 'remove-banner-image') {
        const form = button.closest('form');
        setLessonBannerFormStateV3(form, null);
        showToast({
          title: 'Đã xóa banner',
          message: 'Banner sẽ được gỡ khỏi buổi học sau khi bạn bấm lưu.',
          variant: 'success',
        });
        return;
      }

      if (button.dataset.action === 'pick-lesson-image') {
        const form = button.closest('form');
        const fileInput = form?.querySelector('input[name="coverImageFile"]');

        if (!isCloudinaryConfigured()) {
          showToast({
            title: 'Cloudinary chưa sẵn sàng',
            message: 'Hãy cấu hình VITE_CLOUDINARY_CLOUD_NAME và VITE_CLOUDINARY_UPLOAD_PRESET trước khi tải ảnh minh họa.',
            variant: 'warning',
          });
          return;
        }

        fileInput?.click();
        return;
      }

      if (button.dataset.action === 'remove-lesson-image') {
        const form = button.closest('form');
        const imageId = button.dataset.imageId || '';
        const nextImages = imageId
          ? getLessonImagesFromFormV3(form).filter((item) => item.id !== imageId)
          : [];
        setLessonImagesFormStateV3(form, nextImages);
        showToast({
          title: 'Đã xóa ảnh minh họa',
          message: 'Ảnh minh họa sẽ được gỡ khỏi buổi học sau khi bạn bấm lưu.',
          variant: 'success',
        });
        return;
      }
      if (button.dataset.action === 'add-review-link-row') {
        const form = button.closest('form');
        const list = form?.querySelector('#curriculum-review-links-list');

        if (!list) {
          return;
        }

        const emptyState = list.querySelector('.curriculum-link-editor__empty');

        if (emptyState) {
          list.innerHTML = '';
        }

        list.insertAdjacentHTML('beforeend', createReviewLinkRowV3());
        refreshReviewLinkControlsV3(list);
        return;
      }

      if (button.dataset.action === 'remove-review-link') {
        const row = button.closest('.curriculum-link-row');
        const list = row?.parentElement;
        row?.remove();

        if (list && !list.querySelector('.curriculum-link-row')) {
          list.innerHTML = `
            <div class="curriculum-link-editor__empty">
              Chưa có tài liệu đính kèm cho bài học này.
            </div>
          `;
        }

        refreshReviewLinkControlsV3(list);
        return;
      }

      if (button.dataset.action === 'move-review-link') {
        const row = button.closest('.curriculum-link-row');
        const direction = button.dataset.direction;

        if (!row) {
          return;
        }

        const sibling = direction === 'up' ? row.previousElementSibling : row.nextElementSibling;

        if (!sibling || !sibling.classList.contains('curriculum-link-row')) {
          return;
        }

        if (direction === 'up') {
          row.parentElement.insertBefore(row, sibling);
        } else {
          row.parentElement.insertBefore(sibling, row);
        }

        refreshReviewLinkControlsV3(row.parentElement);
        return;
      }

      if (button.dataset.action === 'select-program') {
        const shouldStayInQuizControl = state.workspaceSection === 'quiz-control';
        state.selectedProgramId = button.dataset.programId || '';
        state.workspaceSection = shouldStayInQuizControl ? 'quiz-control' : 'editor';
        state.editorTab = 'lessons';
        renderView();
        return;
      }

      if (button.dataset.action === 'switch-editor-tab') {
        state.workspaceSection = 'editor';
        state.editorTab = button.dataset.tab || 'lessons';
        renderView();
        return;
      }

      if (button.dataset.action === 'select-lesson') {
        state.selectedLessonId = button.dataset.lessonId || 'new';
        const selectedLesson = getActiveCurriculumLessons(selectedProgram).find(
          (lesson) => lesson.id === state.selectedLessonId,
        ) || null;

        if (selectedLesson) {
          state.selectedActivitySessionNumber = Number(selectedLesson.sessionNumber || state.selectedActivitySessionNumber || 1);
        }

        renderView();
        return;
      }

      if (button.dataset.action === 'create-lesson') {
        state.selectedLessonId = 'new';
        renderView();
        return;
      }

      if (button.dataset.action === 'add-program-session' && selectedProgram) {
        const currentSessionCount = getLessonSessionLimit(selectedProgram);
        const nextSessionNumber = currentSessionCount + 1;

        state.busyKey = 'add-program-session';
        renderView();

        try {
          await setCurriculumProgramSessionCount(selectedProgram.id, nextSessionNumber);
          await refreshProgram(selectedProgram.id);
          state.editorTab = 'lessons';
          selectCurriculumSession(nextSessionNumber);
          showToast({
            title: 'Đã thêm buổi mới',
            message: `Chương trình ${selectedProgram.name} đã có thêm buổi ${nextSessionNumber}. Bạn có thể bắt đầu soạn ngay.`,
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể thêm buổi',
            message: mapFirebaseError(error, 'Không thể thêm buổi mới cho chương trình này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (button.dataset.action === 'toggle-assignment-quiz') {
        const selectedClass = getSelectedClass();
        const assignment = selectedClass ? ensureDraftForClass(selectedClass) : null;
        const command = button.dataset.quizCommand === 'stop' ? 'stop' : 'start';
        const isStarting = command === 'start';
        const sessionNumber = Number(assignment?.currentSession || 0);
        const selectedAssignmentProgram = assignment?.programId
          ? state.programs.find((program) => program.id === assignment.programId) || null
          : null;
        const quizControlState = getAssignmentQuizControlState(
          selectedClass,
          assignment,
          selectedAssignmentProgram,
        );

        if (!selectedClass || !assignment?.programId || !selectedAssignmentProgram) {
          showToast({
            title: 'Chưa thể mở kiểm tra',
            message: 'Hãy chọn lớp và chương trình trước khi mở bài kiểm tra.',
            variant: 'warning',
          });
          return;
        }

        if (!quizControlState.isOfficialSession || !quizControlState.isQuizActivity) {
          showToast({
            title: 'Chưa thể mở kiểm tra',
            message: 'Bài kiểm tra chính thức hiện chỉ mở ở buổi 5 hoặc buổi 9 và loại buổi phải là Kiểm tra.',
            variant: 'warning',
          });
          return;
        }

        state.busyKey = 'toggle-class-quiz';
        renderView();

        try {
          const shouldSaveBeforeOpening =
            isStarting && (
              !hasSavedCurriculumAssignment(selectedClass) ||
              isDraftDifferentFromSaved(selectedClass, assignment)
            );

          if (shouldSaveBeforeOpening) {
            await persistClassAssignment(selectedClass, assignment);
          }

          const statusResult = await setClassQuizStatus(selectedClass.classCode, {
            sessionNumber,
            quizMode: QUIZ_MODE_OFFICIAL,
            isStarted: isStarting,
          });

          state.classes = state.classes.map((classItem) =>
            classItem.classCode === selectedClass.classCode
              ? {
                  ...classItem,
                  activeQuizSessionNumber: isStarting ? sessionNumber : 0,
                  activeQuizMode: QUIZ_MODE_OFFICIAL,
                  quizStatus: isStarting ? QUIZ_CLASS_STATUS_STARTED : 'idle',
                }
              : classItem,
          );

          showToast({
            title: isStarting ? 'Đã mở bài kiểm tra' : 'Đã kết thúc bài kiểm tra',
            message: isStarting
              ? `Học sinh lớp ${selectedClass.classCode} có thể vào Bài giảng để làm bài buổi ${sessionNumber}.`
              : `Đã ẩn đề khỏi học sinh và ghi nhận ${Number(statusResult?.finalizedCount || 0)} bài đang làm.`,
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: isStarting ? 'Không thể mở bài kiểm tra' : 'Không thể kết thúc bài kiểm tra',
            message: mapFirebaseError(
              error,
              isStarting
                ? 'Không thể mở bài kiểm tra lúc này. Hãy kiểm tra bộ đề đã đủ 4 dễ, 4 trung bình, 2 khó.'
                : 'Không thể kết thúc bài kiểm tra lúc này.',
            ),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (button.dataset.action === 'select-exam-item') {
        state.selectedChecklistId = button.dataset.checklistId || 'new';
        renderView();
        return;
      }

      if (button.dataset.action === 'create-exam-item') {
        state.selectedChecklistId = 'new';
        renderView();
        return;
      }

      if (button.dataset.action === 'save-assignment') {
        const selectedClass = getSelectedClass();
        const assignment = selectedClass ? ensureDraftForClass(selectedClass) : null;

        if (!selectedClass || !assignment?.programId) {
          showToast({
            title: 'Chưa thể lưu',
            message: 'Hãy chọn lớp và chương trình trước khi lưu.',
            variant: 'warning',
          });
          return;
        }

        state.busyKey = 'save-assignment';
        renderView();

        try {
          await persistClassAssignment(selectedClass, assignment);

          showToast({
            title: 'Đã lưu bài giảng',
            message: `Lớp ${selectedClass.classCode} đã được cập nhật chương trình, buổi hiện tại và pha lớp học.`,
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể lưu',
            message: mapFirebaseError(error, 'Không thể lưu cấu hình bài giảng cho lớp này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (button.dataset.action === 'archive-lesson' && selectedProgram) {
        const lessonId = button.dataset.lessonId || state.selectedLessonId;

        if (!lessonId) {
          return;
        }

        const confirmed = await confirmDialog({
          title: 'Lưu kho buổi học?',
          message: 'Học sinh sẽ không còn nhìn thấy buổi học này, nhưng bạn có thể khôi phục lại trong Kho lưu trữ.',
          confirmText: 'Lưu kho',
          variant: 'warning',
        });

        if (!confirmed) {
          return;
        }

        state.busyKey = 'archive-lesson';
        renderView();

        try {
          await setCurriculumLessonArchived(selectedProgram.id, lessonId, true);
          await refreshProgram(selectedProgram.id);
          state.selectedLessonId = getActiveCurriculumLessons(getSelectedProgram())[0]?.id || 'new';
          state.editorTab = 'archived';
          showToast({
            title: 'Đã lưu kho buổi học',
            message: 'Buổi học đã được chuyển vào kho lưu và sẽ không còn hiện với học sinh.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể lưu kho',
            message: mapFirebaseError(error, 'Không thể lưu kho buổi học này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (button.dataset.action === 'archive-empty-session' && selectedProgram) {
        const sessionNumber = Number(button.dataset.sessionNumber || state.selectedActivitySessionNumber || 0);
        const sessionLimit = Math.max(
          1,
          Number(selectedProgram.totalSessionCount || selectedProgram.knowledgePhaseEndSession || 1),
        );
        const isTrailingEmptySession = sessionLimit > 1 && sessionNumber >= sessionLimit;

        if (!sessionNumber) {
          return;
        }

        const confirmed = await confirmDialog({
          title: isTrailingEmptySession ? 'Xóa buổi trống?' : 'Lưu kho buổi trống?',
          message: isTrailingEmptySession
            ? `Buổi ${sessionNumber} chưa có nội dung. Hệ thống sẽ thu gọn chương trình và bỏ buổi này khỏi danh sách.`
            : `Buổi ${sessionNumber} chưa có nội dung. Hệ thống sẽ đưa buổi này vào Kho lưu trữ để bạn có thể xóa vĩnh viễn nếu không cần nữa.`,
          confirmText: isTrailingEmptySession ? 'Xóa buổi' : 'Lưu kho',
          variant: 'warning',
        });

        if (!confirmed) {
          return;
        }

        state.busyKey = 'archive-empty-session';
        renderView();

        try {
          await archiveEmptyCurriculumSession(selectedProgram.id, sessionNumber);
          await refreshProgram(selectedProgram.id);
          state.editorTab = isTrailingEmptySession ? 'lessons' : 'archived';
          showToast({
            title: isTrailingEmptySession ? 'Đã xóa buổi trống' : 'Đã lưu kho buổi trống',
            message: isTrailingEmptySession
              ? `Buổi ${sessionNumber} đã được bỏ khỏi danh sách buổi học.`
              : `Buổi ${sessionNumber} đã được đưa vào Kho lưu trữ.`,
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: isTrailingEmptySession ? 'Không thể xóa' : 'Không thể lưu kho',
            message: mapFirebaseError(
              error,
              isTrailingEmptySession ? 'Không thể xóa buổi trống này.' : 'Không thể lưu kho buổi trống này.',
            ),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (button.dataset.action === 'restore-lesson' && selectedProgram) {
        const lessonId = button.dataset.lessonId;
        state.busyKey = `restore-lesson:${lessonId}`;
        renderView();

        try {
          await setCurriculumLessonArchived(selectedProgram.id, lessonId, false);
          await refreshProgram(selectedProgram.id);
          const restoredLesson = getActiveCurriculumLessons(getSelectedProgram()).find((lesson) => lesson.id === lessonId) || null;
          state.selectedLessonId = lessonId;
          state.selectedActivitySessionNumber = Number(restoredLesson?.sessionNumber || state.selectedActivitySessionNumber || 1);
          state.editorTab = 'lessons';
          showToast({
            title: 'Đã khôi phục buổi học',
            message: restoredLesson
              ? `Buổi học đã quay trở lại danh sách đang dùng ở buổi ${restoredLesson.sessionNumber}.`
              : 'Buổi học đã quay trở lại danh sách đang dùng.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể khôi phục',
            message: mapFirebaseError(error, 'Không thể khôi phục buổi học này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (button.dataset.action === 'delete-archived-lesson' && selectedProgram) {
        const lessonId = button.dataset.lessonId || '';

        if (!lessonId) {
          return;
        }

        const confirmed = await confirmDialog({
          title: 'Xóa vĩnh viễn bài học?',
          message: 'Bài học sẽ bị xóa khỏi Kho lưu trữ và không thể khôi phục lại.',
          confirmText: 'Xóa vĩnh viễn',
          variant: 'danger',
        });

        if (!confirmed) {
          return;
        }

        state.busyKey = `delete-lesson:${lessonId}`;
        renderView();

        try {
          await deleteArchivedCurriculumLesson(selectedProgram.id, lessonId);
          await refreshProgram(selectedProgram.id);
          showToast({
            title: 'Đã xóa vĩnh viễn',
            message: 'Bài học đã được xóa khỏi kho lưu trữ.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể xóa',
            message: mapFirebaseError(error, 'Không thể xóa vĩnh viễn bài học này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (button.dataset.action === 'archive-exam-item' && selectedProgram) {
        const checklistId = button.dataset.checklistId || state.selectedChecklistId;

        if (!checklistId) {
          return;
        }

        const confirmed = await confirmDialog({
          title: 'Lưu kho mục cuối khóa?',
          message: 'Học sinh sẽ không còn nhìn thấy mục này, nhưng bạn vẫn có thể khôi phục lại sau.',
          confirmText: 'Lưu kho',
          variant: 'warning',
        });

        if (!confirmed) {
          return;
        }

        state.busyKey = 'archive-exam-item';
        renderView();

        try {
          await setCurriculumExamChecklistItemArchived(selectedProgram.id, checklistId, true);
          await refreshProgram(selectedProgram.id);
          state.selectedChecklistId = getActiveCurriculumChecklist(getSelectedProgram())[0]?.id || 'new';
          showToast({
            title: 'Đã lưu kho mục cuối khóa',
            message: 'Mục ôn tập cuối khóa đã được chuyển vào kho lưu.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể lưu kho',
            message: mapFirebaseError(error, 'Không thể lưu kho mục cuối khóa này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (button.dataset.action === 'restore-exam-item' && selectedProgram) {
        const checklistId = button.dataset.checklistId;
        state.busyKey = `restore-exam-item:${checklistId}`;
        renderView();

        try {
          await setCurriculumExamChecklistItemArchived(selectedProgram.id, checklistId, false);
          await refreshProgram(selectedProgram.id);
          state.selectedChecklistId = checklistId;
          state.editorTab = 'final';
          showToast({
            title: 'Đã khôi phục mục cuối khóa',
            message: 'Mục cuối khóa đã quay lại phần đang dùng.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể khôi phục',
            message: mapFirebaseError(error, 'Không thể khôi phục mục cuối khóa này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }
      }
    });

    root.addEventListener('dragstart', (event) => {
      const imageItem = event.target.closest('.curriculum-image-manager__item');

      if (!imageItem) {
        return;
      }

      draggingLessonImageId = imageItem.dataset.imageId || '';

      if (event.dataTransfer && draggingLessonImageId) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', draggingLessonImageId);
      }
    });

    root.addEventListener('dragover', (event) => {
      const imageItem = event.target.closest('.curriculum-image-manager__item');

      if (!imageItem || !draggingLessonImageId) {
        return;
      }

      event.preventDefault();

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
    });

    root.addEventListener('drop', (event) => {
      const imageItem = event.target.closest('.curriculum-image-manager__item');

      if (!imageItem || !draggingLessonImageId) {
        return;
      }

      event.preventDefault();

      const form = imageItem.closest('form');
      const targetImageId = imageItem.dataset.imageId || '';

      if (!form || !targetImageId || targetImageId === draggingLessonImageId) {
        draggingLessonImageId = '';
        return;
      }

      const currentImages = getLessonImagesFromFormV3(form);
      const nextImages = reorderItemsById(currentImages, draggingLessonImageId, targetImageId);
      setLessonImagesFormStateV3(form, nextImages);
      draggingLessonImageId = '';
    });

    root.addEventListener('dragend', () => {
      draggingLessonImageId = '';
    });

    root.addEventListener('submit', async (event) => {
      const form = event.target;
      const selectedProgram = getSelectedProgram();

      if (form.id === 'curriculum-session-activity-form' && selectedProgram) {
        event.preventDefault();

        const formData = new FormData(form);
        const sessionNumber = Number(formData.get('activitySessionNumber'));
        const activityType = String(formData.get('activityType') || '').trim();

        state.busyKey = 'save-session-activity';
        renderView();

        try {
          await saveCurriculumSessionActivity(selectedProgram.id, {
            sessionNumber,
            activityType,
          });
          await refreshProgram(selectedProgram.id);
          state.selectedActivitySessionNumber = sessionNumber;
          showToast({
            title: 'Đã lưu loại buổi',
            message: `Buổi ${sessionNumber} đã được cập nhật thành ${getCurriculumActivityTypeLabel(activityType)}.`,
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể lưu loại buổi',
            message: mapFirebaseError(error, 'Không thể lưu loại buổi cho chương trình này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (form.id === 'curriculum-lesson-form' && selectedProgram) {
        event.preventDefault();

        const formData = new FormData(form);
        const lessonId = String(formData.get('lessonId') || '').trim() || createCurriculumItemId(`${selectedProgram.id}-lesson`);

        state.busyKey = 'save-lesson';
        renderView();

        try {
          const images = getLessonImagesFromFormV3(form);
          const lectureMarkdown = String(formData.get('lectureMarkdown') || '').trim();
          const exerciseMarkdown = String(formData.get('exerciseMarkdown') || '').trim();
          await saveCurriculumLesson(selectedProgram.id, {
            id: lessonId,
            sessionNumber: Number(formData.get('sessionNumber')),
            title: formData.get('title'),
            contentMarkdown: lectureMarkdown,
            lectureMarkdown,
            exerciseMarkdown,
            reviewLinks: getReviewLinksFromFormV3(form),
            teacherNote: formData.get('teacherNote'),
            bannerImage: getLessonBannerFromFormV3(form),
            images,
            coverImage: images[0] || null,
          });
          await refreshProgram(selectedProgram.id);
          state.selectedLessonId = lessonId;

          showToast({
            title: 'Đã lưu buổi học',
            message: 'Nội dung buổi học đã được cập nhật cho toàn bộ các lớp đang dùng chương trình này.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể lưu buổi học',
            message: mapFirebaseError(error, 'Không thể lưu buổi học này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (form.id === 'curriculum-project-stages-form' && selectedProgram) {
        event.preventDefault();

        const formData = new FormData(form);
        const stages = (selectedProgram.finalChecklist || []).map((item) => ({
          stageKey: item.stageKey,
          description: formData.get(`description:${item.stageKey}`),
          studentGuide: formData.get(`studentGuide:${item.stageKey}`),
          exampleOutput: formData.get(`exampleOutput:${item.stageKey}`),
        }));

        state.busyKey = 'save-project-stages';
        renderView();

        try {
          await saveCurriculumProjectStages(selectedProgram.id, stages);
          await refreshProgram(selectedProgram.id);
          showToast({
            title: 'Đã lưu quy trình cuối khóa',
            message: 'Hướng dẫn 7 giai đoạn sản phẩm đã được cập nhật.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể lưu quy trình',
            message: mapFirebaseError(error, 'Không thể lưu quy trình cuối khóa này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (form.id === 'curriculum-exam-checklist-form' && selectedProgram) {
        event.preventDefault();

        const formData = new FormData(form);
        const checklistId =
          String(formData.get('checklistId') || '').trim() || createCurriculumItemId(`${selectedProgram.id}-exam`);

        state.busyKey = 'save-exam-item';
        renderView();

        try {
          await saveCurriculumExamChecklistItem(selectedProgram.id, {
            id: checklistId,
            order: Number(formData.get('order')),
            title: formData.get('title'),
            description: formData.get('description'),
          });
          await refreshProgram(selectedProgram.id);
          state.selectedChecklistId = checklistId;

          showToast({
            title: 'Đã lưu mục cuối khóa',
            message: 'Checklist cuối khóa đã được cập nhật.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể lưu mục cuối khóa',
            message: mapFirebaseError(error, 'Không thể lưu mục cuối khóa này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }
      }
    });

    root.addEventListener('change', async (event) => {
      const target = event.target;

      if (target.dataset.role === 'lesson-image-alt') {
        syncLessonImageAltFormStateV3(target);
        return;
      }

      if (target.name === 'activitySessionNumber') {
        state.selectedActivitySessionNumber = Number(target.value || 1);
        renderView();
        return;
      }

      if (target.dataset.role === 'banner-image-alt') {
        syncBannerImageAltFormStateV3(target);
        return;
      }

      if (['lectureMarkdown', 'exerciseMarkdown', 'title'].includes(target.name)) {
        const form = target.closest('form');
        syncLessonMarkdownPreviewV3(form, target.name === 'title' ? '' : target.name.replace('Markdown', ''));
        return;
      }

      if (['lectureMarkdownFile', 'exerciseMarkdownFile'].includes(target.name)) {
        const form = target.closest('form');
        const file = target.files?.[0] || null;
        const markdownTab = normalizeLessonMarkdownTab(target.name.replace('MarkdownFile', ''));
        const markdownInput = form?.querySelector(`textarea[name="${markdownTab}Markdown"]`);

        if (!file || !form || !markdownInput) {
          return;
        }

        try {
          markdownInput.value = await file.text();
          syncLessonMarkdownPreviewV3(form, markdownTab);
          showToast({
            title: 'Đã nạp file markdown',
            message: 'Nội dung markdown đã được đưa vào editor. Hãy kiểm tra lại rồi bấm lưu.',
            variant: 'success',
          });
        } catch {
          showToast({
            title: 'Không thể đọc file',
            message: 'File markdown này không thể đọc được ở trình duyệt hiện tại.',
            variant: 'danger',
          });
        } finally {
          target.value = '';
        }

        return;
      }

      if (target.name === 'bannerImageFile') {
        const form = target.closest('form');
        const file = target.files?.[0] || null;
        const uploadButton = form?.querySelector('[data-action="pick-banner-image"]');

        if (!file || !form) {
          return;
        }

        if (!isCloudinaryConfigured()) {
          showToast({
            title: 'Cloudinary chưa sẵn sàng',
            message: 'Hãy cấu hình Cloudinary trước khi tải banner cho bài học.',
            variant: 'warning',
          });
          target.value = '';
          return;
        }

        if (uploadButton) {
          uploadButton.setAttribute('disabled', 'disabled');
          uploadButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang tải...';
        }

        try {
          const image = await uploadCurriculumLessonImage(file);
          setLessonBannerFormStateV3(form, {
            ...image,
            id: image.id || createCurriculumItemId('lesson-banner'),
          });
          showToast({
            title: 'Đã tải banner',
            message: 'Banner đã sẵn sàng. Hãy bấm lưu buổi học để cập nhật vào chương trình.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể tải banner',
            message: mapFirebaseError(error, 'Không thể tải banner bài học lên Cloudinary.'),
            variant: 'danger',
          });
        } finally {
          target.value = '';

          if (uploadButton) {
            uploadButton.removeAttribute('disabled');
            uploadButton.innerHTML = '<i class="bi bi-card-image me-2"></i>Tải banner';
          }
        }

        return;
      }

      if (target.name === 'coverImageFile') {
        const form = target.closest('form');
        const files = Array.from(target.files || []);
        const uploadButton = form?.querySelector('[data-action="pick-lesson-image"]');

        if (files.length === 0 || !form) {
          return;
        }

        if (!isCloudinaryConfigured()) {
          showToast({
            title: 'Cloudinary chưa sẵn sàng',
            message: 'Hãy cấu hình Cloudinary trước khi tải ảnh minh họa cho bài học.',
            variant: 'warning',
          });
          target.value = '';
          return;
        }

        if (uploadButton) {
          uploadButton.setAttribute('disabled', 'disabled');
          uploadButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang tải ảnh...';
        }

        try {
          const currentImages = getLessonImagesFromFormV3(form);
          const uploadedImages = [];

          for (const file of files) {
            const image = await uploadCurriculumLessonImage(file);
            uploadedImages.push({
              ...image,
              id: image.id || createCurriculumItemId('lesson-image'),
            });
          }

          setLessonImagesFormStateV3(form, [...currentImages, ...uploadedImages]);
          showToast({
            title: 'Đã tải ảnh minh họa',
            message: 'Ảnh đã sẵn sàng. Hãy bấm lưu buổi học để cập nhật vào chương trình.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể tải ảnh',
            message: mapFirebaseError(error, 'Không thể tải ảnh minh họa lên Cloudinary.'),
            variant: 'danger',
          });
        } finally {
          target.value = '';

          if (uploadButton) {
            uploadButton.removeAttribute('disabled');
            uploadButton.innerHTML = '<i class="bi bi-images me-2"></i>Tải ảnh lên';
          }
        }

        return;
      }
      if (target.name === 'previewClassCode') {
        state.selectedClassCode = target.value;
        state.didInitializeActivitySession = false;
        const selectedClass = getSelectedClass();
        const draft = ensureDraftForClass(selectedClass);

        if (draft?.programId) {
          state.selectedProgramId = draft.programId;
          state.selectedActivitySessionNumber = Number(draft.currentSession || 1);
        }

        renderView();
        return;
      }

      if (target.name === 'editorProgramId') {
        state.selectedProgramId = target.value;
        selectCurriculumSession(1);
        renderView();
        return;
      }

      if (target.name === 'previewProgramId') {
        updateDraftForSelectedClass({ programId: target.value });
        state.selectedProgramId = target.value;
        selectCurriculumSession(1);
        renderView();
        return;
      }

      if (target.name === 'previewCurrentSession') {
        const nextSessionNumber = Number(target.value);
        updateDraftForSelectedClass({ currentSession: nextSessionNumber });
        selectCurriculumSession(nextSessionNumber);
        renderView();
        return;
      }

      if (target.name === 'previewExerciseVisible') {
        const selectedClass = getSelectedClass();
        const assignment = selectedClass ? ensureDraftForClass(selectedClass) : null;
        const program = state.programs.find((item) => item.id === assignment?.programId) || null;
        const sessionNumber = Number(target.dataset.sessionNumber || assignment?.currentSession || 1);

        updateDraftForSelectedClass({
          exerciseVisibleSessions: setCurriculumExerciseVisibleForSession(
            assignment,
            sessionNumber,
            target.checked,
            program,
          ),
        });
        state.previewTab = target.checked ? LESSON_MARKDOWN_TAB_EXERCISE : LESSON_MARKDOWN_TAB_LECTURE;
        renderView();
        return;
      }

      if (target.name === 'previewPhase') {
        updateDraftForSelectedClass({
          curriculumPhase: target.value === 'final' ? 'final' : 'learning',
        });
        renderView();
      }
    });

    const unsubscribers = [
      subscribeClasses(
        (items) => {
          state.classes = items;
          state.isLoadingClasses = false;
          state.error = '';
          renderView();
        },
        (error) => {
          state.isLoadingClasses = false;
          state.error = mapFirebaseError(error, 'Không tải được danh sách lớp cho trang bài giảng.');
          renderView();
        },
      ),
      subscribeCurriculumPrograms(
        (items) => {
          state.programs = items;
          state.isLoadingPrograms = false;
          state.error = '';
          renderView();
        },
        (error) => {
          state.isLoadingPrograms = false;
          state.error = mapFirebaseError(error, 'Không tải được danh sách chương trình học.');
          renderView();
        },
      ),
    ];

    renderView();

    return () => {
      cleanupQuizManagement();
      unsubscribers.forEach((unsubscribe) => unsubscribe?.());
    };
  },
};
