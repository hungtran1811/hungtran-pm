import {
  getClassCurriculumView,
  getCurriculumProgram,
  listCurriculumPrograms,
} from '../../services/curriculum.service.js';
import {
  getCurriculumActivityTypeLabel,
  getCurriculumSessionActivities,
  getCurriculumSessionActivity,
} from '../../utils/curriculum-program.js';
import { escapeHtml } from '../../utils/html.js';
import { normalizeLessonMarkdownTab } from '../../utils/lesson-markdown.js';
import {
  buildProgramStudentExperienceContext,
  buildStudentExperienceCapabilities,
} from '../../utils/student-experience.js';
import {
  buildAdminLessonPreviewPath,
  getHashRouteState,
} from '../../utils/route.js';
import { renderAlert } from '../components/Alert.js';
import { renderBrandLogo } from '../components/BrandLogo.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderStudentLibraryBrowser } from '../components/StudentLibraryBrowser.js';
import { renderToastStack } from '../components/ToastStack.js';

function resolveSessionNumber(program, requestedSessionNumber) {
  const sessions = getCurriculumSessionActivities(program);
  const requested = Number(requestedSessionNumber || 0);

  if (sessions.some((item) => item.sessionNumber === requested)) {
    return requested;
  }

  return sessions[0]?.sessionNumber || 1;
}

function getDefaultPreviewLessonId(preview, sessionNumber, preferredLessonId = '') {
  const lessons = preview?.visibleLessons || [];

  if (preferredLessonId && lessons.some((lesson) => lesson.id === preferredLessonId)) {
    return preferredLessonId;
  }

  return (
    lessons.find((lesson) => Number(lesson.sessionNumber || 0) === Number(sessionNumber || 0))?.id ||
    lessons.find((lesson) => Number(lesson.sessionNumber || 0) === Number(preview?.assignment?.currentSession || 0))?.id ||
    lessons[lessons.length - 1]?.id ||
    ''
  );
}

function isStudentAccessibleClass(classItem = {}) {
  return classItem.status === 'active' && !classItem.hidden;
}

function renderClassOption(classItem, selectedClassCode) {
  return `
    <option value="${escapeHtml(classItem.classCode)}" ${classItem.classCode === selectedClassCode ? 'selected' : ''}>
      ${escapeHtml(`${classItem.classCode} - ${classItem.className || 'Không tên'}`)}
    </option>
  `;
}

function renderPreviewControls({
  programs = [],
  classes = [],
  program = null,
  selectedClassCode = '',
  sessionNumber = 1,
}) {
  const sessions = program ? getCurriculumSessionActivities(program) : [];
  const selectedActivity = program ? getCurriculumSessionActivity(program, sessionNumber) : null;
  const activeClasses = classes.filter(isStudentAccessibleClass);
  const activityLabel = selectedActivity
    ? getCurriculumActivityTypeLabel(selectedActivity.activityType)
    : 'Học kiến thức';

  return `
    <div class="admin-student-preview-bar admin-student-preview-bar--compact">
      <a class="admin-student-preview-back" href="#/admin/curriculum" aria-label="Quay lại Bài giảng">
        <i class="bi bi-arrow-left"></i>
        <span>Bài giảng</span>
      </a>
      ${
        program
          ? `
            <div class="admin-student-preview-field admin-student-preview-field--readonly admin-student-preview-field--wide">
              <label class="form-label">Chương trình</label>
              <div class="admin-student-preview-readonly">${escapeHtml(program.name || 'Chưa chọn chương trình')}</div>
            </div>
          `
          : ''
      }
      <div class="admin-student-preview-field admin-student-preview-field--readonly">
        <label class="form-label">Buổi</label>
        <div class="admin-student-preview-readonly">Buổi ${Number(sessionNumber || 0) || '?'} · ${escapeHtml(activityLabel)}</div>
      </div>
    </div>
  `;

  return `
    <div class="admin-student-preview-bar">
      <a class="admin-student-preview-back" href="#/admin/curriculum" aria-label="Quay lại Bài giảng">
        <i class="bi bi-arrow-left"></i>
        <span>Bài giảng</span>
      </a>
      <div class="admin-student-preview-field">
        <label class="form-label" for="admin-lesson-preview-class">Lớp</label>
        <select class="form-select admin-student-preview-select" id="admin-lesson-preview-class">
          <option value="" ${selectedClassCode ? '' : 'selected'}>Xem nội dung mẫu</option>
          ${activeClasses.map((classItem) => renderClassOption(classItem, selectedClassCode)).join('')}
        </select>
      </div>
      ${
        selectedClassCode
          ? `
            <div class="admin-student-preview-field admin-student-preview-field--readonly">
              <label class="form-label">Buổi</label>
              <div class="admin-student-preview-readonly">
                Buổi ${Number(sessionNumber || 0)}${selectedActivity ? ` · ${escapeHtml(getCurriculumActivityTypeLabel(selectedActivity.activityType))}` : ''}
              </div>
            </div>
          `
          : `
            <div class="admin-student-preview-field">
              <label class="form-label" for="admin-lesson-preview-program">Chương trình</label>
              <select class="form-select admin-student-preview-select" id="admin-lesson-preview-program">
                ${programs
                  .map(
                    (item) => `
                      <option value="${escapeHtml(item.id)}" ${item.id === program?.id ? 'selected' : ''}>
                        ${escapeHtml(item.name)}
                      </option>
                    `,
                  )
                  .join('')}
              </select>
            </div>
            <div class="admin-student-preview-field">
              <label class="form-label" for="admin-lesson-preview-session">Buổi</label>
              <select class="form-select admin-student-preview-select" id="admin-lesson-preview-session">
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
          `
      }
    </div>
  `;
}

function renderProgramShortcutList(programs = []) {
  if (!programs.length) {
    return renderEmptyState({
      icon: 'diagram-3',
      title: 'Chưa có chương trình học',
      description: 'Hãy tạo hoặc seed chương trình học trước khi dùng màn xem thử.',
    });
  }

  return `
    <div class="student-library-card card border-0 shadow-sm">
      <div class="card-body">
        <div class="student-library-title-label">Xem nội dung mẫu</div>
        <h2 class="h5 mb-3">Chọn chương trình để xem thử</h2>
        <div class="admin-student-preview-program-grid">
          ${programs
            .map((program) => {
              const firstSession = getCurriculumSessionActivities(program)[0]?.sessionNumber || 1;

              return `
                <a class="admin-student-preview-program" href="${escapeHtml(buildAdminLessonPreviewPath(program.id, firstSession))}">
                  <span>${escapeHtml(program.subject || 'Chương trình')}</span>
                  <strong>${escapeHtml(program.name)}</strong>
                  <small>${Number(program.totalSessionCount || 0)} buổi</small>
                </a>
              `;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function renderStudentPreviewContent({
  preview,
  activeLessonId,
  activeTab,
  imageSelections,
  lightboxImage,
  capabilities,
  selectedClassCode,
}) {
  if (!preview && !selectedClassCode) {
    return renderLoadingOverlay('Đang tải nội dung xem thử...');
  }

  if (!capabilities?.hasProgram) {
    return renderAlert('Lớp này chưa được gán chương trình học nên học sinh chưa thể xem bài giảng.', 'warning');
  }

  if (!capabilities.canViewLibrary) {
    return renderAlert(
      'Lớp này hiện không mở để học sinh xem bài giảng. Nếu lớp đang ẩn hoặc đã hoàn thành, học sinh thật cũng sẽ không truy cập được.',
      'warning',
    );
  }

  const sampleNotice = '';
  /*
  const unusedSampleNotice = selectedClassCode
    ? ''
    : renderAlert('Đây là bản xem nội dung mẫu theo chương trình và buổi, không phải quyền truy cập của một lớp học thật.', 'info');

  */
  return `
    ${sampleNotice}
    ${renderStudentLibraryBrowser(preview, activeLessonId, imageSelections || {}, {
      activeTab: normalizeLessonMarkdownTab(activeTab),
      embedded: false,
      lightboxImage: lightboxImage || null,
    })}
  `;
}

export const adminLessonPreviewPage = {
  async render() {
    return `
      <div class="student-layout admin-student-preview-layout">
        <section class="admin-student-preview-controls">
          <div class="container-fluid student-page-shell">
            <div id="admin-lesson-preview-controls">${renderLoadingOverlay('Đang tải điều khiển...')}</div>
          </div>
        </section>
        <section class="student-library-shell py-3 py-lg-4">
          <div class="container-fluid student-page-shell">
            <div class="student-library-page">
              <div class="student-library-page__brand">
                ${renderBrandLogo({
                  id: 'admin-lesson-preview-brand',
                  className: 'student-library-page__brand-lockup',
                  tone: 'dark',
                  compact: true,
                })}
              </div>
              <div id="admin-lesson-preview-root">${renderLoadingOverlay('Đang tải bài giảng...')}</div>
            </div>
          </div>
        </section>
        ${renderToastStack()}
      </div>
    `;
  },

  async mount() {
    const root = document.getElementById('admin-lesson-preview-root');
    const controls = document.getElementById('admin-lesson-preview-controls');

    if (!root || !controls) {
      return null;
    }

    let disposed = false;
    let programs = [];
    let classes = [];
    let program = null;
    let preview = null;
    let capabilities = null;
    let selectedClassCode = '';
    let sessionNumber = 1;
    let activeLessonId = '';
    let activeTab = 'lecture';
    let imageSelections = {};
    let lightboxImage = null;

    function renderControls() {
      controls.innerHTML = renderPreviewControls({
        programs,
        classes,
        program,
        selectedClassCode,
        sessionNumber,
      });
    }

    function renderView() {
      if (disposed) {
        return;
      }

      renderControls();

      if (!program && !selectedClassCode) {
        root.innerHTML = renderProgramShortcutList(programs);
        return;
      }

      root.innerHTML = renderStudentPreviewContent({
        preview,
        activeLessonId,
        activeTab,
        imageSelections,
        lightboxImage,
        capabilities,
        selectedClassCode,
      });
    }

    function setHash(nextHash) {
      if (window.location.hash !== nextHash) {
        window.history.replaceState({}, '', nextHash);
      }
    }

    function syncHash() {
      setHash(buildAdminLessonPreviewPath(program?.id || '', sessionNumber));
    }

    function setLesson(nextLessonId) {
      const lessons = preview?.visibleLessons || [];
      const lesson = lessons.find((item) => item.id === nextLessonId) || null;

      if (!lesson) {
        return;
      }

      activeLessonId = lesson.id;

      if (!selectedClassCode) {
        sessionNumber = Number(lesson.sessionNumber || sessionNumber);
        syncHash();
      }

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
      selectedClassCode = routeState.programId ? '' : routeState.classCode || '';
      program = null;
      preview = null;
      capabilities = null;
      root.innerHTML = renderLoadingOverlay('Đang tải bài giảng...');

      try {
        programs = await listCurriculumPrograms();
        classes = [];

        if (routeState.programId) {
          program = await getCurriculumProgram(routeState.programId);

          if (!program) {
            throw new Error('Không tìm thấy chương trình học để xem thử.');
          }

          sessionNumber = resolveSessionNumber(program, routeState.sessionNumber);
          const context = buildProgramStudentExperienceContext(program, sessionNumber);
          preview = context.preview;
          capabilities = context.capabilities;
        }

        if (!preview && selectedClassCode) {
          preview = await getClassCurriculumView(selectedClassCode, { publicAccess: false });
          program = preview?.program || null;
          sessionNumber = Number(preview?.assignment?.currentSession || routeState.sessionNumber || 1);
          capabilities = buildStudentExperienceCapabilities(preview, {
            mode: 'class_review',
          });
        } else if (!preview && routeState.programId) {
          program = await getCurriculumProgram(routeState.programId);

          if (!program) {
            throw new Error('Không tìm thấy chương trình học để xem thử.');
          }

          sessionNumber = resolveSessionNumber(program, routeState.sessionNumber);
          const context = buildProgramStudentExperienceContext(program, sessionNumber);
          preview = context.preview;
          capabilities = context.capabilities;
        } else if (!preview) {
          program = null;
          preview = null;
          capabilities = null;
        }

        activeTab = normalizeLessonMarkdownTab(routeState.tab || activeTab);
        activeLessonId = preview
          ? getDefaultPreviewLessonId(preview, sessionNumber, activeLessonId)
          : '';
        imageSelections = {};
        lightboxImage = null;

        renderView();
      } catch (error) {
        root.innerHTML = renderAlert(
          escapeHtml(error?.message || 'Không thể tải bài giảng để xem thử.'),
          'danger',
        );
        renderControls();
      }
    }

    controls.addEventListener('change', (event) => {
      const classSelect = event.target.closest('#admin-lesson-preview-class');
      const programSelect = event.target.closest('#admin-lesson-preview-program');
      const sessionSelect = event.target.closest('#admin-lesson-preview-session');

      if (classSelect) {
        selectedClassCode = classSelect.value || '';
        activeLessonId = '';
        activeTab = 'lecture';
        setHash(
          selectedClassCode
            ? buildAdminLessonPreviewPath('', 0, { classCode: selectedClassCode })
            : buildAdminLessonPreviewPath(program?.id || programs[0]?.id || '', sessionNumber),
        );
        void load();
        return;
      }

      if (programSelect) {
        const nextProgram = programs.find((item) => item.id === programSelect.value) || null;

        if (!nextProgram) {
          return;
        }

        program = nextProgram;
        sessionNumber = resolveSessionNumber(program, sessionNumber);
        activeLessonId = '';
        setHash(buildAdminLessonPreviewPath(program.id, sessionNumber));
        void load();
        return;
      }

      if (sessionSelect && program) {
        sessionNumber = resolveSessionNumber(program, Number(sessionSelect.value || 1));
        activeLessonId = '';
        setHash(buildAdminLessonPreviewPath(program.id, sessionNumber));
        void load();
      }
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
          label: markdownImage.alt || 'Ảnh trong bài giảng',
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
