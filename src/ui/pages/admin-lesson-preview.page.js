import {
  getCurriculumProgram,
  listCurriculumPrograms,
} from '../../services/curriculum.service.js';
import {
  getActiveCurriculumLessons,
  getCurriculumActivityTypeLabel,
  getCurriculumSessionActivities,
  getCurriculumSessionActivity,
} from '../../utils/curriculum-program.js';
import { escapeHtml } from '../../utils/html.js';
import { hasLessonExerciseContent, normalizeLessonMarkdownTab } from '../../utils/lesson-markdown.js';
import {
  buildAdminLessonPreviewPath,
  buildAdminQuizPreviewPath,
  getHashRouteState,
} from '../../utils/route.js';
import { renderAlert } from '../components/Alert.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderStudentLibraryBrowser } from '../components/StudentLibraryBrowser.js';

const QUIZ_UI_ENABLED = false;

function resolveSessionNumber(program, requestedSessionNumber) {
  const sessions = getCurriculumSessionActivities(program);
  const requested = Number(requestedSessionNumber || 0);

  if (sessions.some((item) => item.sessionNumber === requested)) {
    return requested;
  }

  return sessions[0]?.sessionNumber || 1;
}

function renderProgramShortcutList(programs = [], target = 'lesson') {
  if (!programs.length) {
    return renderEmptyState({
      icon: 'diagram-3',
      title: 'Chưa có chương trình học',
      description: 'Hãy tạo hoặc seed chương trình học trước khi dùng đường dẫn test admin.',
    });
  }

  return `
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white border-0">
        <h2 class="h5 mb-1">Chọn chương trình để test nhanh</h2>
      </div>
      <div class="card-body">
        <div class="row g-3">
          ${programs
            .map((program) => {
              const firstSession = getCurriculumSessionActivities(program)[0]?.sessionNumber || 1;
              const href =
                target === 'quiz'
                  ? buildAdminQuizPreviewPath(program.id, firstSession)
                  : buildAdminLessonPreviewPath(program.id, firstSession);

              return `
                <div class="col-12 col-md-6 col-xl-4">
                  <a class="text-decoration-none" href="${escapeHtml(href)}">
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

function buildAdminStudentPreview(program, sessionNumber) {
  const lessons = getActiveCurriculumLessons(program).map((lesson) => ({
    ...lesson,
    exerciseVisible: hasLessonExerciseContent(lesson),
  }));
  const visibleLessons = lessons.filter((lesson) => Number(lesson.sessionNumber || 0) <= Number(sessionNumber || 1));

  return {
    classInfo: {
      classCode: '',
      className: '',
    },
    assignment: {
      currentSession: sessionNumber,
      curriculumPhase: 'learning',
    },
    program: {
      ...program,
      lessons,
    },
    lessons,
    visibleLessons,
    checklistItems: [],
  };
}

function getDefaultPreviewLessonId(preview, sessionNumber, preferredLessonId = '') {
  const lessons = preview?.visibleLessons || [];

  if (preferredLessonId && lessons.some((lesson) => lesson.id === preferredLessonId)) {
    return preferredLessonId;
  }

  return (
    lessons.find((lesson) => Number(lesson.sessionNumber || 0) === Number(sessionNumber || 0))?.id ||
    lessons[lessons.length - 1]?.id ||
    ''
  );
}

function renderLessonPreview(program, sessionNumber, previewState = {}) {
  const sessions = getCurriculumSessionActivities(program);
  const selectedActivity = getCurriculumSessionActivity(program, sessionNumber);
  const preview = buildAdminStudentPreview(program, sessionNumber);
  const activeLessonId = getDefaultPreviewLessonId(preview, sessionNumber, previewState.lessonId);
  const quizPreviewPath = buildAdminQuizPreviewPath(program.id, sessionNumber);

  return `
    <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start mb-3">
      <div>
        <h2 class="h4 mb-1">${escapeHtml(program.name)}</h2>
        <div class="text-secondary">Buổi ${sessionNumber} · ${escapeHtml(getCurriculumActivityTypeLabel(selectedActivity.activityType))}</div>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <a class="btn btn-outline-secondary" href="#/admin/curriculum">
          <i class="bi bi-arrow-left me-2"></i>Quay lại Học liệu
        </a>
        ${
          QUIZ_UI_ENABLED
            ? `
              <a class="btn btn-outline-primary" href="${escapeHtml(quizPreviewPath)}">
                <i class="bi bi-play-circle me-2"></i>Test quiz admin
              </a>
            `
            : ''
        }
      </div>
    </div>

    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-5">
            <label class="form-label">Buổi muốn xem</label>
            <select class="form-select" id="admin-lesson-preview-session">
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
        </div>
      </div>
    </div>

    <div class="admin-lesson-student-preview">
      ${renderStudentLibraryBrowser(preview, activeLessonId, previewState.imageSelections || {}, {
        activeTab: normalizeLessonMarkdownTab(previewState.activeTab),
        embedded: false,
        lightboxImage: previewState.lightboxImage || null,
      })}
    </div>
  `;
}

export const adminLessonPreviewPage = {
  async render({ authState }) {
    return renderAppShell({
      title: 'Xem thử học liệu',
      currentRoute: '/admin/curriculum',
      user: authState.user,
      content: '<div id="admin-lesson-preview-root"></div>',
    });
  },

  async mount() {
    const root = document.getElementById('admin-lesson-preview-root');

    if (!root) {
      return null;
    }

    let disposed = false;
    let program = null;
    let sessionNumber = 1;
    let activeLessonId = '';
    let activeTab = 'lecture';
    let imageSelections = {};
    let lightboxImage = null;

    function renderView() {
      if (!program) {
        return;
      }

      root.innerHTML = renderLessonPreview(program, sessionNumber, {
        lessonId: activeLessonId,
        activeTab,
        imageSelections,
        lightboxImage,
      });
    }

    function syncHash() {
      if (!program) {
        return;
      }

      const nextHash = buildAdminLessonPreviewPath(program.id, sessionNumber);

      if (window.location.hash !== nextHash) {
        window.history.replaceState({}, '', nextHash);
      }
    }

    function setLesson(nextLessonId) {
      const lessons = getActiveCurriculumLessons(program);
      const lesson = lessons.find((item) => item.id === nextLessonId) || null;

      if (!lesson) {
        return;
      }

      activeLessonId = lesson.id;
      sessionNumber = Number(lesson.sessionNumber || sessionNumber);
      syncHash();
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
      lightboxImage = null;
      renderView();
    }

    function handleKeydown(event) {
      if (event.key === 'Escape' && lightboxImage) {
        closeLightbox();
      }
    }

    async function load() {
      const routeState = getHashRouteState();
      root.innerHTML = renderLoadingOverlay('Đang tải nội dung preview...');

      try {
        if (!routeState.programId) {
          const programs = await listCurriculumPrograms();

          if (!disposed) {
            root.innerHTML = renderProgramShortcutList(programs, 'lesson');
          }
          return;
        }

        program = await getCurriculumProgram(routeState.programId);

        if (!program) {
          throw new Error('Không tìm thấy chương trình học để preview.');
        }

        sessionNumber = resolveSessionNumber(program, routeState.sessionNumber);
        activeTab = normalizeLessonMarkdownTab(routeState.tab || activeTab);
        activeLessonId = '';
        imageSelections = {};
        lightboxImage = null;

        if (!disposed) {
          renderView();
        }
      } catch (error) {
        if (!disposed) {
          root.innerHTML = renderAlert(escapeHtml(error?.message || 'Không thể tải preview học liệu.'), 'danger');
        }
      }
    }

    root.addEventListener('change', (event) => {
      const sessionSelect = event.target.closest('#admin-lesson-preview-session');

      if (!sessionSelect || !program) {
        return;
      }

      sessionNumber = resolveSessionNumber(program, Number(sessionSelect.value || 1));
      activeLessonId = '';
      syncHash();
      renderView();
    });

    root.addEventListener('click', (event) => {
      const closeLightboxButton = event.target.closest('[data-action="close-library-image-lightbox"]');
      const openImageButton = event.target.closest('[data-action="open-library-image"]');
      const markdownImage = event.target.closest('.student-library-markdown img');
      const lessonButton = event.target.closest('[data-action="select-library-lesson"]');
      const imageButton = event.target.closest('[data-action="select-library-image"]');
      const tabButton = event.target.closest('[data-action="select-library-tab"]');
      const neighborButton = event.target.closest('[data-action="go-to-library-neighbor"]');

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

      if (lessonButton) {
        setLesson(lessonButton.dataset.lessonId || '');
        return;
      }

      if (tabButton) {
        activeTab = normalizeLessonMarkdownTab(tabButton.dataset.tab || 'lecture');
        renderView();
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

    window.addEventListener('hashchange', load);
    document.addEventListener('keydown', handleKeydown);

    await load();

    return () => {
      disposed = true;
      window.removeEventListener('hashchange', load);
      document.removeEventListener('keydown', handleKeydown);
    };
  },
};
