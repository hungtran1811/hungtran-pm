import { createCurriculumItemId } from '../../../utils/curriculum-program.js';
import { escapeHtml } from '../../../utils/html.js';
import {
  getLessonMarkdownSource,
  LESSON_MARKDOWN_TAB_EXERCISE,
  LESSON_MARKDOWN_TAB_LECTURE,
  normalizeLessonMarkdownTab,
  renderLessonMarkdownHtml,
} from '../../../utils/lesson-markdown.js';

export function getLessonImagesV3(lessonDraft) {
  if (Array.isArray(lessonDraft?.images) && lessonDraft.images.length > 0) {
    return [...lessonDraft.images].sort((left, right) => (left.order || 0) - (right.order || 0));
  }

  if (lessonDraft?.coverImage?.secureUrl) {
    return [{ ...lessonDraft.coverImage, id: lessonDraft.coverImage.id || `${lessonDraft.id || 'lesson'}-cover`, order: 1 }];
  }

  return [];
}

export function getLessonBannerImageV3(lessonDraft) {
  if (lessonDraft?.bannerImage?.secureUrl) {
    return lessonDraft.bannerImage;
  }

  if (lessonDraft?.coverImage?.secureUrl) {
    return {
      ...lessonDraft.coverImage,
      id: lessonDraft.coverImage.id || `${lessonDraft.id || 'lesson'}-banner`,
      order: 1,
    };
  }

  const firstImage = getLessonImagesV3(lessonDraft)[0] || null;
  return firstImage ? { ...firstImage, id: firstImage.id || `${lessonDraft.id || 'lesson'}-banner` } : null;
}

function getLessonMarkdownDraftV3(lessonDraft, tab = LESSON_MARKDOWN_TAB_LECTURE) {
  return getLessonMarkdownSource(lessonDraft, tab);
}

function getLessonReviewLinksV3(lessonDraft) {
  if (!Array.isArray(lessonDraft?.reviewLinks)) {
    return [];
  }

  return lessonDraft.reviewLinks.map((item, index) =>
    typeof item === 'string'
      ? {
          id: createCurriculumItemId('review-link'),
          label: item,
          url: item,
          order: index + 1,
        }
      : {
          id: item.id || createCurriculumItemId('review-link'),
          label: item.label || item.url || '',
          url: item.url || '',
          order: item.order || index + 1,
        },
  );
}

function renderLessonImageItemsV3(images = []) {
  if (!Array.isArray(images) || images.length === 0) {
    return `
      <div class="curriculum-image-upload__empty">
        Chưa có ảnh minh họa cho bài học này.
      </div>
    `;
  }

  return `
    <div class="curriculum-image-manager">
      ${images
        .map(
          (image, index) => `
            <div
              class="curriculum-image-manager__item"
              draggable="true"
              data-image-id="${escapeHtml(image.id)}"
            >
              <div class="curriculum-image-manager__thumb-wrap">
                <img
                  src="${escapeHtml(image.secureUrl)}"
                  alt="${escapeHtml(image.alt || `Ảnh ${index + 1}`)}"
                  class="curriculum-image-manager__thumb"
                  loading="lazy"
                >
                ${index === 0 ? '<span class="badge text-bg-primary curriculum-image-manager__primary">Ảnh chính</span>' : ''}
              </div>
              <input
                type="text"
                class="form-control form-control-sm"
                data-role="lesson-image-alt"
                data-image-id="${escapeHtml(image.id)}"
                value="${escapeHtml(image.alt || '')}"
                placeholder="Mô tả ảnh"
              >
              <div class="curriculum-image-manager__meta">
                <span class="small text-secondary">Kéo thả để đổi thứ tự</span>
                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm"
                  data-action="remove-lesson-image"
                  data-image-id="${escapeHtml(image.id)}"
                >
                  <i class="bi bi-trash me-1"></i>Xóa
                </button>
              </div>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderLessonImagesFieldV3(lessonDraft, cloudinaryReady) {
  const images = getLessonImagesV3(lessonDraft);

  return `
    <div class="col-12">
      <label class="form-label">Ảnh minh họa</label>
      <input
        type="hidden"
        name="lessonImagesJson"
        value="${escapeHtml(JSON.stringify(images))}"
      >
      <div class="curriculum-image-upload">
        <div id="curriculum-lesson-images-preview" class="curriculum-image-upload__preview curriculum-image-upload__preview--multi">
          ${renderLessonImageItemsV3(images)}
        </div>
        <div class="curriculum-image-upload__actions">
          <input
            id="curriculum-lesson-images-input"
            class="d-none"
            type="file"
            accept="image/*"
            name="coverImageFile"
            multiple
          >
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            data-action="pick-lesson-image"
            ${cloudinaryReady ? '' : 'disabled'}
          >
            <i class="bi bi-images me-2"></i>${cloudinaryReady ? 'Tải ảnh lên' : 'Cloudinary chưa sẵn sàng'}
          </button>
        </div>
        <div class="small text-secondary mt-2">
          ${cloudinaryReady ? 'Mỗi bài học có thể dùng nhiều ảnh. Ảnh đầu tiên sẽ là ảnh chính.' : 'Thêm VITE_CLOUDINARY_CLOUD_NAME và VITE_CLOUDINARY_UPLOAD_PRESET để bật upload ảnh.'}
        </div>
      </div>
    </div>
  `;
}

function renderLessonBannerPreviewV3(image = null) {
  if (!image?.secureUrl) {
    return `
      <div class="curriculum-image-upload__empty">
        Chưa có banner cho buổi học này.
      </div>
    `;
  }

  return `
    <div class="curriculum-image-upload__preview-card">
      <img
        src="${escapeHtml(image.secureUrl)}"
        alt="${escapeHtml(image.alt || 'Banner buổi học')}"
        class="curriculum-image-upload__preview-image"
        loading="lazy"
      >
    </div>
  `;
}

function renderLessonBannerFieldV3(lessonDraft, cloudinaryReady) {
  const bannerImage = getLessonBannerImageV3(lessonDraft);

  return `
    <div class="col-12">
      <label class="form-label">Banner buổi học</label>
      <input
        type="hidden"
        name="lessonBannerJson"
        value="${escapeHtml(JSON.stringify(bannerImage || null))}"
      >
      <div class="curriculum-image-upload">
        <div id="curriculum-lesson-banner-preview" class="curriculum-image-upload__preview">
          ${renderLessonBannerPreviewV3(bannerImage)}
        </div>
        <div class="curriculum-image-upload__actions">
          <input
            id="curriculum-lesson-banner-input"
            class="d-none"
            type="file"
            accept="image/*"
            name="bannerImageFile"
          >
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            data-action="pick-banner-image"
            ${cloudinaryReady ? '' : 'disabled'}
          >
            <i class="bi bi-card-image me-2"></i>${cloudinaryReady ? 'Tải banner' : 'Cloudinary chưa sẵn sàng'}
          </button>
          ${
            bannerImage?.secureUrl
              ? `
                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm"
                  data-action="remove-banner-image"
                >
                  <i class="bi bi-trash me-2"></i>Xóa banner
                </button>
              `
              : ''
          }
        </div>
        <div class="small text-secondary mt-2">
          ${cloudinaryReady ? 'Banner sẽ hiện ở đầu bài học cho học sinh xem cùng nội dung lesson.' : 'Thêm VITE_CLOUDINARY_CLOUD_NAME và VITE_CLOUDINARY_UPLOAD_PRESET để bật upload ảnh.'}
        </div>
      </div>
    </div>
    <div class="col-12">
      <label class="form-label">Mô tả banner</label>
      <input
        class="form-control"
        data-role="banner-image-alt"
        value="${escapeHtml(bannerImage?.alt || '')}"
        placeholder="Ví dụ: Banner minh họa giao diện trò chơi hoặc kết quả buổi học"
      >
    </div>
  `;
}

function renderLessonMarkdownPaneV3({
  tab,
  label,
  hint,
  markdown,
  previewHtml,
  placeholder,
  active = false,
}) {
  return `
    <div
      class="curriculum-lesson-markdown-pane ${active ? '' : 'd-none'}"
      data-markdown-pane="${tab}"
    >
      <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
        <div>
          <label class="form-label mb-0">${label}</label>
          <div class="form-text mt-1">${hint}</div>
        </div>
        <div class="d-flex flex-wrap gap-2">
          <input
            class="d-none"
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            name="${tab}MarkdownFile"
          >
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            data-action="pick-markdown-file"
            data-markdown-tab="${tab}"
          >
            <i class="bi bi-file-earmark-arrow-up me-2"></i>Upload file .md
          </button>
        </div>
      </div>
      <textarea
        class="form-control font-monospace"
        name="${tab}Markdown"
        rows="14"
        placeholder="${placeholder}"
      >${escapeHtml(markdown)}</textarea>
      <div class="form-text">Bạn có thể upload file markdown rồi chỉnh lại trực tiếp trong ô này trước khi lưu.</div>
      <div class="mt-3">
        <label class="form-label">Xem trước ${label.toLowerCase()}</label>
        <div
          id="curriculum-markdown-preview-${tab}"
          class="curriculum-markdown-preview student-library-markdown"
          data-markdown-preview="${tab}"
        >
          ${previewHtml || '<div class="student-library-markdown-empty">Chưa có nội dung markdown để xem trước.</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderLessonMarkdownFieldV3(lessonDraft) {
  const lectureMarkdown = getLessonMarkdownDraftV3(lessonDraft, LESSON_MARKDOWN_TAB_LECTURE);
  const exerciseMarkdown = getLessonMarkdownDraftV3(lessonDraft, LESSON_MARKDOWN_TAB_EXERCISE);
  const lecturePreviewHtml = renderLessonMarkdownHtml(
    {
      ...lessonDraft,
      lectureMarkdown,
      contentMarkdown: lectureMarkdown,
    },
    LESSON_MARKDOWN_TAB_LECTURE,
  );
  const exercisePreviewHtml = renderLessonMarkdownHtml(
    {
      ...lessonDraft,
      exerciseMarkdown,
    },
    LESSON_MARKDOWN_TAB_EXERCISE,
  );
  return `
    <div class="col-12">
      <div class="curriculum-lesson-markdown-editor">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <div class="student-library-tabbar" role="tablist" aria-label="Nội dung markdown">
            <button
              type="button"
              class="student-library-tab student-library-tab--active"
              data-action="switch-lesson-markdown-tab"
              data-markdown-tab="${LESSON_MARKDOWN_TAB_LECTURE}"
            >
              <i class="bi bi-journal-text me-1"></i>Bài giảng
            </button>
            <button
              type="button"
              class="student-library-tab"
              data-action="switch-lesson-markdown-tab"
              data-markdown-tab="${LESSON_MARKDOWN_TAB_EXERCISE}"
            >
              <i class="bi bi-pencil-square me-1"></i>Bài tập
            </button>
          </div>
        </div>
        ${renderLessonMarkdownPaneV3({
          tab: LESSON_MARKDOWN_TAB_LECTURE,
          label: 'Bài giảng',
          hint: 'Dùng cho khái niệm, code mẫu, giải thích và phần học sinh cần xem lại.',
          markdown: lectureMarkdown,
          previewHtml: lecturePreviewHtml,
          placeholder: '# Tiêu đề bài học&#10;&#10;## Khái niệm&#10;&#10;## Code mẫu&#10;&#10;## Giải thích',
          active: true,
        })}
        ${renderLessonMarkdownPaneV3({
          tab: LESSON_MARKDOWN_TAB_EXERCISE,
          label: 'Bài tập',
          hint: 'Dùng cho bài tập không đáp án.',
          markdown: exerciseMarkdown,
          previewHtml: exercisePreviewHtml,
          placeholder: '# Bài tập tự luyện&#10;&#10;## Bài 1&#10;&#10;Mô tả yêu cầu học sinh cần làm, không ghi đáp án.',
        })}
      </div>
    </div>
  `;
}

function renderReviewLinkRowsV3(reviewLinks = []) {
  if (!Array.isArray(reviewLinks) || reviewLinks.length === 0) {
    return `
      <div class="curriculum-link-editor__empty">
        Chưa có tài liệu đính kèm cho bài học này.
      </div>
    `;
  }

  return reviewLinks
    .map(
      (item, index) => `
        <div class="curriculum-link-row" data-link-id="${escapeHtml(item.id || createCurriculumItemId('review-link'))}">
          <div class="row g-2 align-items-start">
            <div class="col-12 col-lg-4">
              <label class="form-label small mb-1">Tên tài liệu</label>
              <input
                type="text"
                class="form-control form-control-sm"
                data-role="review-link-label"
                value="${escapeHtml(item.label || '')}"
                placeholder="Ví dụ: Slide bài học"
              >
            </div>
            <div class="col-12 col-lg-6">
              <label class="form-label small mb-1">Đường link</label>
              <input
                type="url"
                class="form-control form-control-sm"
                data-role="review-link-url"
                value="${escapeHtml(item.url || '')}"
                placeholder="https://..."
              >
            </div>
            <div class="col-12 col-lg-2">
              <label class="form-label small mb-1 d-block">Thao tác</label>
              <div class="d-flex gap-1 flex-wrap">
                <button type="button" class="btn btn-outline-secondary btn-sm" data-action="move-review-link" data-direction="up" ${index === 0 ? 'disabled' : ''}>
                  <i class="bi bi-arrow-up"></i>
                </button>
                <button type="button" class="btn btn-outline-secondary btn-sm" data-action="move-review-link" data-direction="down" ${index === reviewLinks.length - 1 ? 'disabled' : ''}>
                  <i class="bi bi-arrow-down"></i>
                </button>
                <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-review-link">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `,
    )
    .join('');
}

function renderLessonReviewLinksFieldV3(lessonDraft) {
  const reviewLinks = getLessonReviewLinksV3(lessonDraft);

  return `
    <div class="col-12">
      <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
        <label class="form-label mb-0">Tài liệu đính kèm</label>
        <button type="button" class="btn btn-outline-primary btn-sm" data-action="add-review-link-row">
          <i class="bi bi-plus-lg me-1"></i>Thêm tài liệu
        </button>
      </div>
      <div id="curriculum-review-links-list" class="curriculum-link-editor">
        ${renderReviewLinkRowsV3(reviewLinks)}
      </div>
    </div>
  `;
}

export function renderLessonFormV3(program, lessonDraft, busyKey, cloudinaryReady) {
  const isEditing = Boolean(lessonDraft?.id);
  const sessionNumber = Number(lessonDraft?.sessionNumber || 1);

  return `
    <form id="curriculum-lesson-form" class="curriculum-editor-form">
      <input type="hidden" name="lessonId" value="${escapeHtml(lessonDraft?.id || '')}">
      <input type="hidden" name="sessionNumber" value="${sessionNumber}">
      <div class="row g-3">
        <div class="col-12 col-md-4">
          <label class="form-label">Buổi đang chỉnh</label>
          <div class="form-control bg-body-tertiary fw-semibold">Buổi ${sessionNumber}</div>
          <div class="form-text">
            Chọn buổi ở cột danh sách bên trái. Form này chỉ sửa nội dung của buổi đang chọn.
          </div>
        </div>
        <div class="col-12 col-md-8">
          <label class="form-label">Tiêu đề buổi học</label>
          <input class="form-control" name="title" value="${escapeHtml(lessonDraft?.title || '')}" placeholder="Ví dụ: Hoàn thiện bố cục trang chủ">
        </div>
        <div class="col-12">
          <div class="curriculum-editor-subsection">
            <div class="curriculum-editor-subsection__title">Bài giảng & bài tập</div>
            <div class="curriculum-editor-subsection__hint">Tách phần giảng dạy và phần bài tập tự luyện để học sinh xem rõ ràng hơn.</div>
          </div>
        </div>
        ${renderLessonMarkdownFieldV3(lessonDraft)}
        <div class="col-12">
          <div class="curriculum-editor-subsection">
            <div class="curriculum-editor-subsection__title">Banner buổi học</div>
            <div class="curriculum-editor-subsection__hint">Banner sẽ hiện ở đầu bài học để học sinh xem cùng nội dung.</div>
          </div>
        </div>
        ${renderLessonBannerFieldV3(lessonDraft, cloudinaryReady)}
        <div class="col-12">
          <div class="curriculum-editor-subsection">
            <div class="curriculum-editor-subsection__title">Ảnh minh họa thêm</div>
            <div class="curriculum-editor-subsection__hint">Các ảnh này sẽ hiện dưới banner theo dạng thumbnail để học sinh chuyển qua lại.</div>
          </div>
        </div>
        ${renderLessonImagesFieldV3(lessonDraft, cloudinaryReady)}
        ${renderLessonReviewLinksFieldV3(lessonDraft)}
        <div class="col-12">
          <label class="form-label">Ghi chú cho giáo viên</label>
          <textarea class="form-control" name="teacherNote" rows="3" placeholder="Các lưu ý riêng khi dạy buổi này">${escapeHtml(lessonDraft?.teacherNote || '')}</textarea>
        </div>
      </div>
      <div class="curriculum-editor-form__actions mt-4">
        <button type="submit" class="btn btn-primary" ${busyKey === 'save-lesson' ? 'disabled' : ''}>
          ${
            busyKey === 'save-lesson'
              ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang lưu...'
              : `<i class="bi bi-save me-2"></i>${isEditing ? 'Lưu buổi học' : 'Thêm buổi học'}`
          }
        </button>
        ${
          isEditing
            ? `
              <button
                type="button"
                class="btn btn-outline-warning"
                data-action="archive-lesson"
                data-lesson-id="${escapeHtml(lessonDraft.id)}"
                ${busyKey === 'archive-lesson' ? 'disabled' : ''}
              >
                <i class="bi bi-archive me-2"></i>Lưu kho
              </button>
            `
            : ''
        }
      </div>
    </form>
  `;
}

export function getLessonImagesFromFormV3(form) {
  const jsonInput = form.querySelector('input[name="lessonImagesJson"]');

  if (!jsonInput?.value) {
    return [];
  }

  try {
    const images = JSON.parse(jsonInput.value);
    return Array.isArray(images)
      ? images.map((item, index) => ({
          ...item,
          order: index + 1,
        }))
      : [];
  } catch {
    return [];
  }
}

export function setLessonImagesFormStateV3(form, images = []) {
  if (!form) {
    return;
  }

  const nextImages = Array.isArray(images)
    ? images.map((item, index) => ({
        ...item,
        order: index + 1,
      }))
    : [];
  const jsonInput = form.querySelector('input[name="lessonImagesJson"]');
  const previewElement = form.querySelector('#curriculum-lesson-images-preview');

  if (jsonInput) {
    jsonInput.value = JSON.stringify(nextImages);
  }

  if (previewElement) {
    previewElement.innerHTML = renderLessonImageItemsV3(nextImages);
  }
}

export function getLessonBannerFromFormV3(form) {
  const jsonInput = form.querySelector('input[name="lessonBannerJson"]');

  if (!jsonInput?.value) {
    return null;
  }

  try {
    const image = JSON.parse(jsonInput.value);
    return image?.secureUrl ? image : null;
  } catch {
    return null;
  }
}

export function setLessonBannerFormStateV3(form, bannerImage = null) {
  if (!form) {
    return;
  }

  const jsonInput = form.querySelector('input[name="lessonBannerJson"]');
  const previewElement = form.querySelector('#curriculum-lesson-banner-preview');
  const altInput = form.querySelector('[data-role="banner-image-alt"]');
  const actionsElement = form.querySelector('#curriculum-lesson-banner-preview')?.closest('.curriculum-image-upload')?.querySelector('.curriculum-image-upload__actions');
  const existingRemoveButton = actionsElement?.querySelector('[data-action="remove-banner-image"]');

  if (jsonInput) {
    jsonInput.value = bannerImage ? JSON.stringify(bannerImage) : '';
  }

  if (altInput) {
    altInput.value = bannerImage?.alt || '';
  }

  if (previewElement) {
    previewElement.innerHTML = renderLessonBannerPreviewV3(bannerImage);
  }

  if (!actionsElement) {
    return;
  }

  if (bannerImage?.secureUrl) {
    if (!existingRemoveButton) {
      actionsElement.insertAdjacentHTML(
        'beforeend',
        `
          <button
            type="button"
            class="btn btn-outline-danger btn-sm"
            data-action="remove-banner-image"
          >
            <i class="bi bi-trash me-2"></i>Xóa banner
          </button>
        `,
      );
    }

    return;
  }

  existingRemoveButton?.remove();
}

export function syncBannerImageAltFormStateV3(input) {
  const form = input.closest('form');

  if (!form) {
    return;
  }

  const bannerImage = getLessonBannerFromFormV3(form);

  if (!bannerImage) {
    return;
  }

  setLessonBannerFormStateV3(form, {
    ...bannerImage,
    alt: input.value,
  });
}

export function syncLessonMarkdownPreviewV3(form, tab = '') {
  if (!form) {
    return;
  }

  const tabs = tab
    ? [normalizeLessonMarkdownTab(tab)]
    : [LESSON_MARKDOWN_TAB_LECTURE, LESSON_MARKDOWN_TAB_EXERCISE];
  const titleInput = form.querySelector('input[name="title"]');

  tabs.forEach((currentTab) => {
    const previewElement = form.querySelector(`[data-markdown-preview="${currentTab}"]`);
    const markdownInput = form.querySelector(`textarea[name="${currentTab}Markdown"]`);

    if (!previewElement || !markdownInput) {
      return;
    }

    const html = renderLessonMarkdownHtml(
      {
        title: titleInput?.value || '',
        lectureMarkdown: currentTab === LESSON_MARKDOWN_TAB_LECTURE ? markdownInput.value : '',
        contentMarkdown: currentTab === LESSON_MARKDOWN_TAB_LECTURE ? markdownInput.value : '',
        exerciseMarkdown: currentTab === LESSON_MARKDOWN_TAB_EXERCISE ? markdownInput.value : '',
      },
      currentTab,
    );

    previewElement.innerHTML =
      html || '<div class="student-library-markdown-empty">Chưa có nội dung markdown để xem trước.</div>';
  });
}

export function syncLessonImageAltFormStateV3(input) {
  const form = input.closest('form');
  const imageId = input.dataset.imageId || '';

  if (!form || !imageId) {
    return;
  }

  const nextImages = getLessonImagesFromFormV3(form).map((item) =>
    item.id === imageId
      ? {
          ...item,
          alt: input.value,
        }
      : item,
  );

  const jsonInput = form.querySelector('input[name="lessonImagesJson"]');

  if (jsonInput) {
    jsonInput.value = JSON.stringify(nextImages);
  }
}

export function getReviewLinksFromFormV3(form) {
  return Array.from(form.querySelectorAll('.curriculum-link-row'))
    .map((row, index) => {
      const labelInput = row.querySelector('[data-role="review-link-label"]');
      const urlInput = row.querySelector('[data-role="review-link-url"]');
      const label = String(labelInput?.value || '').trim();
      const url = String(urlInput?.value || '').trim();

      if (!label && !url) {
        return null;
      }

      return {
        id: row.dataset.linkId || createCurriculumItemId('review-link'),
        label,
        url,
        order: index + 1,
      };
    })
    .filter(Boolean);
}

export function createReviewLinkRowV3(label = '', url = '') {
  return `
    <div class="curriculum-link-row" data-link-id="${escapeHtml(createCurriculumItemId('review-link'))}">
      <div class="row g-2 align-items-start">
        <div class="col-12 col-lg-4">
          <label class="form-label small mb-1">Tên tài liệu</label>
          <input
            type="text"
            class="form-control form-control-sm"
            data-role="review-link-label"
            value="${escapeHtml(label)}"
            placeholder="Ví dụ: Slide bài học"
          >
        </div>
        <div class="col-12 col-lg-6">
          <label class="form-label small mb-1">Đường link</label>
          <input
            type="url"
            class="form-control form-control-sm"
            data-role="review-link-url"
            value="${escapeHtml(url)}"
            placeholder="https://..."
          >
        </div>
        <div class="col-12 col-lg-2">
          <label class="form-label small mb-1 d-block">Thao tác</label>
          <div class="d-flex gap-1 flex-wrap">
            <button type="button" class="btn btn-outline-secondary btn-sm" data-action="move-review-link" data-direction="up">
              <i class="bi bi-arrow-up"></i>
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm" data-action="move-review-link" data-direction="down">
              <i class="bi bi-arrow-down"></i>
            </button>
            <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-review-link">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function refreshReviewLinkControlsV3(container) {
  if (!container) {
    return;
  }

  const rows = Array.from(container.querySelectorAll('.curriculum-link-row'));

  rows.forEach((row, index) => {
    const moveUpButton = row.querySelector('[data-action="move-review-link"][data-direction="up"]');
    const moveDownButton = row.querySelector('[data-action="move-review-link"][data-direction="down"]');

    if (moveUpButton) {
      moveUpButton.disabled = index === 0;
    }

    if (moveDownButton) {
      moveDownButton.disabled = index === rows.length - 1;
    }
  });
}
