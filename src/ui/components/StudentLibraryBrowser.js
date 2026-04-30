import { renderLessonMarkdownEmptyState, renderLessonMarkdownHtml } from '../../utils/lesson-markdown.js';
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

function buildCloudinaryVariant(url, transformation) {
  const rawUrl = String(url ?? '').trim();

  if (!rawUrl || !rawUrl.includes('/image/upload/')) {
    return rawUrl;
  }

  return rawUrl.replace('/image/upload/', `/image/upload/${transformation}/`);
}

function getLessonMediaItems(lesson) {
  const normalizedImages = Array.isArray(lesson?.images)
    ? [...lesson.images].sort((left, right) => (left.order || 0) - (right.order || 0))
    : [];
  const mediaItems = [];
  const seen = new Set();

  function pushImage(image, kind = 'image') {
    if (!image?.secureUrl) {
      return;
    }

    const uniqueKey = image.publicId || image.secureUrl;

    if (seen.has(uniqueKey)) {
      return;
    }

    seen.add(uniqueKey);
    mediaItems.push({
      ...image,
      kind,
      id: image.id || `${lesson?.id || 'lesson'}-${kind}-${mediaItems.length + 1}`,
    });
  }

  pushImage(lesson?.bannerImage, 'banner');
  pushImage(lesson?.coverImage, 'cover');
  normalizedImages.forEach((image) => pushImage(image, 'image'));

  return mediaItems;
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

function renderLessonMediaFrame(lesson, selectedImageId) {
  const mediaItems = getLessonMediaItems(lesson);
  const activeMedia = mediaItems.find((item) => item.id === selectedImageId) || mediaItems[0] || null;

  return `
    <div class="student-library-article__media">
      <div class="student-library-media__frame student-library-media__frame--article">
        ${
          activeMedia?.secureUrl
            ? `
              <img
                src="${escapeHtml(buildCloudinaryVariant(activeMedia.secureUrl, 'f_auto,q_auto,c_fit,w_1440,h_880'))}"
                alt="${escapeHtml(activeMedia.alt || lesson.title || 'Ảnh minh họa bài học')}"
                class="student-library-media__image"
                loading="lazy"
              >
            `
            : `
              <div class="student-library-media__empty">
                Buổi học này chưa có banner hoặc ảnh minh họa.
              </div>
            `
        }
      </div>
      ${
        mediaItems.length > 0
          ? `
            <div class="student-library-media__thumbs student-library-media__thumbs--article" role="list" aria-label="Ảnh minh họa buổi học">
              ${mediaItems
                .map(
                  (image, index) => `
                    <button
                      type="button"
                      class="student-library-thumb ${image.id === activeMedia?.id ? 'student-library-thumb--active' : ''}"
                      data-action="select-library-image"
                      data-lesson-id="${escapeHtml(lesson.id)}"
                      data-image-id="${escapeHtml(image.id)}"
                      aria-label="${escapeHtml(image.kind === 'banner' ? 'Banner bài học' : `Ảnh minh họa ${index + 1}`)}"
                    >
                      <img
                        src="${escapeHtml(buildCloudinaryVariant(image.secureUrl, 'f_auto,q_auto,c_fill,w_220,h_150'))}"
                        alt="${escapeHtml(image.alt || `Ảnh minh họa ${index + 1}`)}"
                        class="student-library-thumb__image"
                        loading="lazy"
                      >
                      ${
                        image.kind === 'banner'
                          ? '<span class="student-library-thumb__badge">Banner</span>'
                          : ''
                      }
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

function renderLessonReferences(lesson) {
  const links = Array.isArray(lesson?.reviewLinks) ? lesson.reviewLinks : [];

  if (links.length === 0) {
    return '';
  }

  return `
    <section class="student-library-resources">
      <div class="student-library-detail__label">Tài liệu & tham khảo</div>
      <div class="student-library-resources__list">
        ${links
          .map((item) => {
            const label = typeof item === 'string' ? item : item?.label || item?.url || '';
            const url = typeof item === 'string' ? item : item?.url || '';
            const href = getSafeLinkHref(url);

            if (!href) {
              return `
                <div class="student-library-resource-card student-library-resource-card--muted">
                  <div class="student-library-resource-card__title">${escapeHtml(label)}</div>
                  <div class="small text-secondary">Chưa có đường link hợp lệ</div>
                </div>
              `;
            }

            return `
              <a
                class="student-library-resource-card"
                href="${escapeHtml(href)}"
                target="_blank"
                rel="noreferrer"
              >
                <div class="student-library-resource-card__title">
                  <i class="bi bi-link-45deg me-2"></i>${escapeHtml(label)}
                </div>
                <div class="student-library-resource-card__url">${escapeHtml(href)}</div>
              </a>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
}

function renderLessonArticle(lesson, selectedImageId) {
  const articleHtml = renderLessonMarkdownHtml(lesson);
  const references = renderLessonReferences(lesson);

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
            ${lesson?.previousLessonId ? `data-lesson-id="${escapeHtml(lesson.previousLessonId)}"` : 'disabled'}
          >
            <i class="bi bi-chevron-left me-1"></i>Buổi trước
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            data-action="go-to-library-neighbor"
            data-direction="next"
            ${lesson?.nextLessonId ? `data-lesson-id="${escapeHtml(lesson.nextLessonId)}"` : 'disabled'}
          >
            Buổi sau<i class="bi bi-chevron-right ms-1"></i>
          </button>
        </div>
      </div>

      <div class="student-library-article">
        ${renderLessonMediaFrame(lesson, selectedImageId)}

        <div class="student-library-article__body">
          <article class="student-library-markdown">
            ${
              articleHtml ||
              renderLessonMarkdownEmptyState('Giáo viên chưa thêm nội dung markdown cho buổi học này.')
            }
          </article>
        </div>
        ${references}
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
  const activeLessonIndex = lessons.findIndex((lesson) => lesson.id === selectedLessonId);
  const activeLesson =
    lessons[activeLessonIndex] ||
    lessons.find((lesson) => lesson.sessionNumber === preview?.assignment?.currentSession) ||
    lessons[lessons.length - 1] ||
    null;
  const selectedImageId = activeLesson ? selectedImageIds?.[activeLesson.id] || '' : '';
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

  const enrichedLesson = activeLesson
    ? {
        ...activeLesson,
        previousLessonId: activeLessonIndex > 0 ? lessons[activeLessonIndex - 1]?.id || '' : '',
        nextLessonId:
          activeLessonIndex >= 0 && activeLessonIndex < lessons.length - 1
            ? lessons[activeLessonIndex + 1]?.id || ''
            : '',
      }
    : null;

  return `
    <div class="card border-0 shadow-sm student-library-card ${embedded ? 'student-library-card--embedded' : ''}">
      <div class="card-body">
        ${renderLessonMeta(preview, reportLink)}
        <div class="student-library-layout student-library-layout--article">
          ${renderLessonList(lessons, activeLesson?.id || '')}
          <div class="student-library-content">
            ${
              enrichedLesson
                ? renderLessonArticle(enrichedLesson, selectedImageId)
                : `
                  <div class="student-library-empty-panel">
                    Chọn một buổi học để xem nội dung chi tiết.
                  </div>
                `
            }
          </div>
        </div>
      </div>
    </div>
  `;
}
