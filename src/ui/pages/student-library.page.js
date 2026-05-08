import { getStudentLibraryView } from '../../services/curriculum.service.js';
import { attachHiddenAdminShortcut } from '../../utils/admin-shortcut.js';
import {
  buildPublicLibraryPath,
  buildPublicReportPath,
  getPublicLibraryPathMatch,
  getStudentLibraryRouteState,
} from '../../utils/route.js';
import { renderAlert } from '../components/Alert.js';
import { renderBrandLogo } from '../components/BrandLogo.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderStudentLibraryBrowser } from '../components/StudentLibraryBrowser.js';

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
  return ['overview', 'images', 'links'].includes(value) ? value : 'overview';
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
      </div>
    `;
  },
  async mount() {
    const slot = document.getElementById('student-library-slot');
    const brandTrigger = document.getElementById('student-library-brand-trigger');
    const routeState = getStudentLibraryRouteState();
    const lockedClassCode = routeState.classCode;

    let isLoading = true;
    let error = '';
    let preview = null;
    let activeLessonId = routeState.lessonId || '';
    let activeTab = normalizeLibraryTab(routeState.tab);
    let imageSelections = {};
    let lightboxImage = null;

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
      });
    }

    function setLesson(nextLessonId) {
      activeLessonId = nextLessonId || getDefaultLessonId(preview);
      syncUrlState();
      renderView();
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
        setTab(tabButton.dataset.tab || 'overview');
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

    document.addEventListener('keydown', handleKeydown);

    renderView();

    if (!lockedClassCode) {
      isLoading = false;
      error = 'Link học liệu không hợp lệ hoặc thiếu mã lớp.';
      renderView();
      return () => {
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

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      cleanupShortcut?.();
    };
  },
};
