import { escapeHtml } from '../../utils/html.js';

function getSafeLinkHref(value) {
  const rawValue = String(value ?? '').trim();

  if (!rawValue) {
    return '';
  }

  if (/^https?:\/\//i.test(rawValue)) {
    return rawValue;
  }

  if (/^www\./i.test(rawValue)) {
    return `https://${rawValue}`;
  }

  return '';
}

function getLessonImages(lesson) {
  if (Array.isArray(lesson?.images) && lesson.images.length > 0) {
    return [...lesson.images].sort((left, right) => (left.order || 0) - (right.order || 0));
  }

  if (lesson?.coverImage?.secureUrl) {
    return [{ ...lesson.coverImage, id: lesson.coverImage.id || `${lesson.id}-cover`, order: 1 }];
  }

  return [];
}

function buildCloudinaryVariant(url, transformation) {
  const rawUrl = String(url ?? '').trim();

  if (!rawUrl || !rawUrl.includes('/image/upload/')) {
    return rawUrl;
  }

  return rawUrl.replace('/image/upload/', `/image/upload/${transformation}/`);
}

function getVisibleKeyPoints(lesson) {
  const items = Array.isArray(lesson?.keyPoints) ? lesson.keyPoints.filter(Boolean) : [];
  return {
    points: items.slice(0, 6),
    hiddenCount: Math.max(0, items.length - 6),
  };
}

function renderOverviewSection(label, content, { emptyMessage = '' } = {}) {
  const value = String(content ?? '').trim();

  if (!value) {
    if (!emptyMessage) {
      return '';
    }

    return `
      <div class="student-library-detail__section">
        <div class="student-library-detail__label">${label}</div>
        <div class="student-library-detail__box student-library-detail__box--muted">${escapeHtml(emptyMessage)}</div>
      </div>
    `;
  }

  return `
    <div class="student-library-detail__section">
      <div class="student-library-detail__label">${label}</div>
      <div class="student-library-detail__box">${escapeHtml(value)}</div>
    </div>
  `;
}

function renderLessonMeta(preview, reportLink = '') {
  const classCode = preview?.classInfo?.classCode || '';
  const className = preview?.classInfo?.className || '';
  const currentSession = preview?.assignment?.currentSession || 1;
  const isFinal = preview?.assignment?.curriculumPhase === 'final';

  return `
    <div class="student-library-header student-library-header--compact">
      <div>
        <div class="student-library-title-label">Học liệu</div>
        <h2 class="h4 mb-1">${escapeHtml(preview.program.name)}</h2>
        <div class="small text-secondary">
          ${escapeHtml(classCode)}${className ? ` · ${escapeHtml(className)}` : ''}
        </div>
      </div>
      <div class="student-library-header__actions">
        <span class="badge text-bg-light text-dark border">Buổi hiện tại: ${currentSession}</span>
        <span class="badge ${isFinal ? 'text-bg-success' : 'text-bg-primary'}">
          ${isFinal ? 'Giai đoạn cuối khóa' : 'Học kiến thức'}
        </span>
        ${
          reportLink
            ? `
              <a class="btn btn-outline-secondary btn-sm" href="${reportLink}">
                <i class="bi bi-arrow-left me-2"></i>Quay lại báo cáo
              </a>
            `
            : ''
        }
      </div>
    </div>
  `;
}

function renderLessonList(lessons, activeLessonId) {
  return `
    <aside class="student-library-sidebar">
      <div class="student-library-sidebar__label">Danh sách buổi học</div>
      <div class="student-library-lesson-list" role="tablist" aria-label="Danh sách buổi học">
        ${lessons
          .map(
            (lesson) => `
              <button
                type="button"
                class="student-library-lesson-item ${lesson.id === activeLessonId ? 'student-library-lesson-item--active' : ''}"
                data-action="select-library-lesson"
                data-lesson-id="${escapeHtml(lesson.id)}"
              >
                <span class="student-library-lesson-item__session">Buổi ${lesson.sessionNumber}</span>
                <span class="student-library-lesson-item__title">${escapeHtml(lesson.title)}</span>
              </button>
            `,
          )
          .join('')}
      </div>
    </aside>
  `;
}

function renderWorkspaceTabs(activeTab) {
  const tabs = [
    { id: 'overview', label: 'Tổng quan', icon: 'journal-text' },
    { id: 'images', label: 'Hình ảnh', icon: 'images' },
    { id: 'links', label: 'Tài liệu', icon: 'link-45deg' },
  ];

  return `
    <div class="student-library-tabbar" role="tablist" aria-label="Nội dung buổi học">
      ${tabs
        .map(
          (tab) => `
            <button
              type="button"
              class="student-library-tab ${tab.id === activeTab ? 'student-library-tab--active' : ''}"
              data-action="select-library-tab"
              data-tab="${tab.id}"
            >
              <i class="bi bi-${tab.icon} me-2"></i>${tab.label}
            </button>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderOverviewTab(lesson) {
  const { points, hiddenCount } = getVisibleKeyPoints(lesson);

  return `
    <div class="student-library-overview">
      ${renderOverviewSection('Tóm tắt', lesson.summary)}

      <div class="student-library-detail__section">
        <div class="student-library-detail__label">Ý chính cần nhớ</div>
        <div class="student-library-detail__box">
          <ul class="mb-0 ps-3">
            ${points.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
          ${
            hiddenCount > 0
              ? `<div class="small text-secondary mt-2">Còn ${hiddenCount} ý nữa trong nội dung bài học.</div>`
              : ''
          }
        </div>
      </div>

      ${renderOverviewSection('Bài toán gợi ý', lesson.practiceTask)}
      ${renderOverviewSection('Tự tìm hiểu thêm', lesson.selfStudyPrompt, {
        emptyMessage: 'Giáo viên chưa thêm phần gợi ý tự tìm hiểu cho buổi học này.',
      })}
    </div>
  `;
}

function renderImagesTab(lesson, selectedImageId) {
  const images = getLessonImages(lesson);
  const activeImage = images.find((item) => item.id === selectedImageId) || images[0] || null;

  return `
    <div class="student-library-media">
      <div class="student-library-media__frame">
        ${
          activeImage?.secureUrl
            ? `
              <img
                src="${escapeHtml(buildCloudinaryVariant(activeImage.secureUrl, 'f_auto,q_auto,c_fit,w_1280,h_720'))}"
                alt="${escapeHtml(activeImage.alt || lesson.title || 'Ảnh minh họa bài học')}"
                class="student-library-media__image"
                loading="lazy"
              >
            `
            : `
              <div class="student-library-media__empty">
                Bài học này chưa có ảnh minh họa.
              </div>
            `
        }
      </div>
      ${
        images.length > 1
          ? `
            <div class="student-library-media__thumbs" role="list" aria-label="Danh sách ảnh minh họa">
              ${images
                .map(
                  (image, index) => `
                    <button
                      type="button"
                      class="student-library-thumb ${image.id === activeImage?.id ? 'student-library-thumb--active' : ''}"
                      data-action="select-library-image"
                      data-lesson-id="${escapeHtml(lesson.id)}"
                      data-image-id="${escapeHtml(image.id)}"
                      aria-label="Ảnh ${index + 1}"
                    >
                      <img
                        src="${escapeHtml(buildCloudinaryVariant(image.secureUrl, 'f_auto,q_auto,c_fill,w_180,h_140'))}"
                        alt="${escapeHtml(image.alt || `Ảnh ${index + 1}`)}"
                        class="student-library-thumb__image"
                        loading="lazy"
                      >
                    </button>
                  `,
                )
                .join('')}
            </div>
          `
          : ''
      }
    </div>
  `;
}

function renderLinksTab(lesson) {
  const links = Array.isArray(lesson?.reviewLinks) ? lesson.reviewLinks : [];

  if (links.length === 0) {
    return `
      <div class="student-library-empty-panel">
        Bài học này chưa có tài liệu đính kèm.
      </div>
    `;
  }

  return `
    <div class="student-library-links-panel">
      ${links
        .map((item) => {
          const label = typeof item === 'string' ? item : item?.label || item?.url || '';
          const url = typeof item === 'string' ? item : item?.url || '';
          const href = getSafeLinkHref(url);

          if (!href) {
            return `
              <div class="student-library-link-card student-library-link-card--muted">
                <div class="student-library-link-card__title">${escapeHtml(label)}</div>
                <div class="small text-secondary">Chưa có đường link hợp lệ</div>
              </div>
            `;
          }

          return `
            <a
              class="student-library-link-card"
              href="${escapeHtml(href)}"
              target="_blank"
              rel="noreferrer"
            >
              <div class="student-library-link-card__title">
                <i class="bi bi-link-45deg me-2"></i>${escapeHtml(label)}
              </div>
              <div class="student-library-link-card__url">${escapeHtml(href)}</div>
            </a>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderWorkspaceBody(lesson, activeTab, selectedImageId) {
  if (!lesson) {
    return `
      <div class="student-library-detail__empty">
        Chọn một buổi học để xem nội dung chi tiết.
      </div>
    `;
  }

  if (activeTab === 'images') {
    return renderImagesTab(lesson, selectedImageId);
  }

  if (activeTab === 'links') {
    return renderLinksTab(lesson);
  }

  return renderOverviewTab(lesson);
}

function renderWorkspace(preview, lesson, activeTab, selectedImageId) {
  const lessons = preview?.visibleLessons || [];
  const currentIndex = lessons.findIndex((item) => item.id === lesson?.id);
  const previousLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;

  return `
    <section class="student-library-workspace">
      <div class="student-library-workspace__top">
        <div>
          <div class="student-library-detail__label">Buổi ${lesson?.sessionNumber || ''}</div>
          <h3 class="h4 mb-1">${escapeHtml(lesson?.title || '')}</h3>
        </div>
        <div class="student-library-workspace__nav">
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            data-action="go-to-library-neighbor"
            data-direction="prev"
            ${previousLesson ? `data-lesson-id="${escapeHtml(previousLesson.id)}"` : 'disabled'}
          >
            <i class="bi bi-chevron-left me-1"></i>Buổi trước
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            data-action="go-to-library-neighbor"
            data-direction="next"
            ${nextLesson ? `data-lesson-id="${escapeHtml(nextLesson.id)}"` : 'disabled'}
          >
            Buổi sau<i class="bi bi-chevron-right ms-1"></i>
          </button>
        </div>
      </div>

      ${renderWorkspaceTabs(activeTab)}

      <div class="student-library-workspace__body">
        ${renderWorkspaceBody(lesson, activeTab, selectedImageId)}
      </div>
    </section>
  `;
}

export function renderStudentLibraryBrowser(
  preview,
  selectedLessonId = '',
  selectedImageIds = {},
  options = {},
) {
  const lessons = preview?.visibleLessons || [];
  const activeLesson =
    lessons.find((lesson) => lesson.id === selectedLessonId) ||
    lessons.find((lesson) => lesson.sessionNumber === preview?.assignment?.currentSession) ||
    lessons[lessons.length - 1] ||
    null;
  const selectedImageId = activeLesson ? selectedImageIds?.[activeLesson.id] || '' : '';
  const activeTab = options.activeTab || 'overview';
  const reportLink = options.reportLink || '';
  const embedded = Boolean(options.embedded);

  if (!preview?.program || lessons.length === 0) {
    return `
      <div class="card border-0 shadow-sm student-library-card ${embedded ? 'student-library-card--embedded' : ''}">
        <div class="card-body">
          <div class="student-library-title-label">Học liệu</div>
          <h2 class="h5 mb-2">Chưa có bài học để hiển thị</h2>
          <p class="text-secondary mb-0">Giáo viên chưa cập nhật bài học cho lớp này hoặc lớp chưa học đến buổi nào.</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="card border-0 shadow-sm student-library-card ${embedded ? 'student-library-card--embedded' : ''}">
      <div class="card-body">
        ${renderLessonMeta(preview, reportLink)}
        <div class="student-library-layout">
          ${renderLessonList(lessons, activeLesson?.id || '')}
          <div class="student-library-content">
            ${renderWorkspace(preview, activeLesson, activeTab, selectedImageId)}
          </div>
        </div>
      </div>
    </div>
  `;
}
