import {
  hasVisibleLessonExercises,
  LESSON_MARKDOWN_TAB_EXERCISE,
  LESSON_MARKDOWN_TAB_LECTURE,
  normalizeLessonMarkdownTab,
  renderLessonMarkdownEmptyState,
  renderLessonMarkdownHtml,
} from '../../utils/lesson-markdown.js';
import {
  getCurriculumActivityTypeLabel,
  getCurriculumSessionActivity,
  isCurriculumQuizActivity,
} from '../../utils/curriculum-program.js';
import { formatDateTime } from '../../utils/date.js';
import { escapeHtml } from '../../utils/html.js';
import { renderAlert } from './Alert.js';
import { renderLoadingOverlay } from './LoadingOverlay.js';
import { renderQuizForm } from './QuizForm.js';
import { renderStudentSelect } from './StudentSelect.js';

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

function getLargeImageUrl(url) {
  return buildCloudinaryVariant(url, 'f_auto,q_auto:best,c_fit,w_2400,h_1600');
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
  const currentActivity = getCurriculumSessionActivity(preview?.program, currentSession);
  const isQuizSession = isCurriculumQuizActivity(currentActivity.activityType);
  const phaseLabel = isFinal ? 'Giai đoạn cuối khóa' : getCurriculumActivityTypeLabel(currentActivity.activityType);
  const phaseBadgeClass = isFinal ? 'text-bg-success' : isQuizSession ? 'text-bg-warning text-dark' : 'text-bg-primary';

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
        <span class="badge ${phaseBadgeClass}">
          ${phaseLabel}
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
  const activeMediaUrl = activeMedia?.secureUrl ? getLargeImageUrl(activeMedia.secureUrl) : '';
  const activeMediaAlt = activeMedia?.alt || lesson.title || 'Ảnh minh họa bài học';
  const activeMediaLabel =
    activeMedia?.kind === 'banner'
      ? 'Banner bài học'
      : activeMedia?.kind === 'cover'
        ? 'Ảnh chính'
        : 'Ảnh minh họa';

  return `
    <div class="student-library-article__media">
      <div class="student-library-media__frame student-library-media__frame--article">
        ${
          activeMedia?.secureUrl
            ? `
              <button
                type="button"
                class="student-library-media__zoom-button"
                data-action="open-library-image"
                data-image-url="${escapeHtml(activeMediaUrl)}"
                data-image-alt="${escapeHtml(activeMediaAlt)}"
                data-image-label="${escapeHtml(activeMediaLabel)}"
                aria-label="Phóng to ${escapeHtml(activeMediaLabel.toLowerCase())}"
              >
                <img
                  src="${escapeHtml(activeMediaUrl)}"
                  alt="${escapeHtml(activeMediaAlt)}"
                  class="student-library-media__image"
                  loading="lazy"
                >
                <span class="student-library-media__zoom-hint">
                  <i class="bi bi-arrows-fullscreen me-1"></i>Bấm để phóng to
                </span>
              </button>
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

function renderLibraryImageLightbox(image = null) {
  if (!image?.url) {
    return '';
  }

  return `
    <div
      class="student-library-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Xem ảnh phóng to"
      data-action="close-library-image-lightbox"
    >
      <button
        type="button"
        class="student-library-lightbox__close"
        data-action="close-library-image-lightbox"
        aria-label="Đóng ảnh phóng to"
      >
        <i class="bi bi-x-lg"></i>
      </button>
      <figure class="student-library-lightbox__figure">
        <img
          src="${escapeHtml(image.url)}"
          alt="${escapeHtml(image.alt || image.label || 'Ảnh minh họa bài học')}"
          class="student-library-lightbox__image"
        >
        ${
          image.label || image.alt
            ? `<figcaption class="student-library-lightbox__caption">${escapeHtml(image.label || image.alt)}</figcaption>`
            : ''
        }
      </figure>
    </div>
  `;
}

function renderLessonContentTabs(activeTab, showExercises) {
  const tabs = [
    {
      id: LESSON_MARKDOWN_TAB_LECTURE,
      label: 'Bài giảng',
      icon: 'journal-text',
    },
  ];

  if (showExercises) {
    tabs.push({
      id: LESSON_MARKDOWN_TAB_EXERCISE,
      label: 'Bài tập',
      icon: 'pencil-square',
    });
  }

  return `
    <div class="student-library-tabbar mb-3" role="tablist" aria-label="Nội dung buổi học">
      ${tabs
        .map(
          (tab) => `
            <button
              type="button"
              class="student-library-tab ${tab.id === activeTab ? 'student-library-tab--active' : ''}"
              data-action="select-library-tab"
              data-tab="${tab.id}"
            >
              <i class="bi bi-${tab.icon} me-1"></i>${tab.label}
            </button>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderQuizSubmittedState(quizContext) {
  const quiz = quizContext?.quiz;
  const attempt = quizContext?.attempt;
  const sessionNumber = Number(quiz?.sessionNumber || quizContext?.availability?.sessionNumber || attempt?.sessionNumber || 0);
  const questionCount = Number(quiz?.questionCount || attempt?.questionCount || 0);

  return `
    <div class="card border-0 shadow-sm">
      <div class="card-body">
        ${renderAlert('Bạn đã nộp bài kiểm tra này thành công.', 'success')}
        <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start">
          <div>
            <div class="small text-secondary mb-1">Kiểm tra buổi ${sessionNumber || '?'}</div>
            <h4 class="h5 mb-1">${escapeHtml(quiz?.title || attempt?.quizTitle || 'Bài kiểm tra đã nộp')}</h4>
            <p class="text-secondary mb-0">Hệ thống đã ghi nhận bài làm của bạn. Giáo viên sẽ xem kết quả trong khu quản trị.</p>
          </div>
          ${questionCount > 0 ? `<span class="badge bg-white text-dark border">${questionCount} câu</span>` : ''}
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

function renderLessonQuizArticle(lesson, selectedImageId, preview, quizState = {}) {
  const currentSession = Number(preview?.assignment?.currentSession || 0);
  const lessonSession = Number(lesson?.sessionNumber || 0);
  const sessionActivity = getCurriculumSessionActivity(preview?.program, lessonSession);
  const activityLabel = getCurriculumActivityTypeLabel(sessionActivity.activityType);
  const selectedStudent = (quizState.students || []).find((student) => student.studentId === quizState.selectedStudentId) || null;
  const isCurrentSession = currentSession === lessonSession;
  const quizContext = quizState.quizContext || null;
  const draftAnswerCount = Object.keys(quizState.answers || {}).filter((questionId) =>
    String(quizState.answers?.[questionId] ?? '').trim(),
  ).length;

  return `
    <section class="student-library-workspace">
      <div class="student-library-workspace__top">
        <div>
          <div class="student-library-detail__label">Buổi ${lessonSession} · ${escapeHtml(activityLabel)}</div>
          <h3 class="h4 mb-1">${escapeHtml(lesson?.title || `Kiểm tra buổi ${lessonSession}`)}</h3>
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
          <div class="student-library-quiz-panel">
            <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start mb-3">
              <div>
                <div class="student-library-detail__label">Kiểm tra trắc nghiệm</div>
                <h4 class="h5 mb-1">${escapeHtml(quizContext?.quiz?.title || `Bài kiểm tra buổi ${lessonSession}`)}</h4>
                <p class="text-secondary mb-0">
                  Học sinh chọn đúng tên rồi làm từng câu một. Sau khi nộp chỉ hiện trạng thái đã nộp, không hiện điểm.
                </p>
              </div>
              ${
                quizState.isSavingDraft
                  ? '<span class="badge text-bg-light text-dark border"><span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Đang lưu tạm</span>'
                  : draftAnswerCount > 0
                    ? `<span class="badge text-bg-light text-dark border">Đã chọn ${draftAnswerCount} câu</span>`
                    : ''
              }
            </div>
            ${
              !isCurrentSession
                ? renderAlert(
                    `Bài kiểm tra buổi ${lessonSession} chỉ mở khi lớp đang ở đúng buổi ${lessonSession}. Lớp hiện tại đang ở buổi ${currentSession || '?'}.`,
                    'info',
                  )
                : `
                  <div class="row g-3 mb-3">
                    <div class="col-12 col-lg-6">
                      ${renderStudentSelect(quizState.students || [], quizState.selectedStudentId || '')}
                    </div>
                  </div>
                  ${
                    quizState.isRosterLoading
                      ? renderLoadingOverlay('Đang tải danh sách học sinh...')
                      : quizState.rosterError
                        ? renderAlert(escapeHtml(quizState.rosterError), 'danger')
                        : !selectedStudent
                          ? (
                              quizContext?.availability && !quizContext.availability.isEligible
                                ? renderAlert(escapeHtml(quizContext.availability.reason || 'Giáo viên chưa mở bài kiểm tra.'), 'info')
                                : renderAlert('Hãy chọn đúng tên của bạn để bắt đầu làm bài kiểm tra.', 'info')
                            )
                          : quizState.isLoading
                            ? renderLoadingOverlay('Đang tải bài kiểm tra...')
                            : quizState.error
                              ? renderAlert(escapeHtml(quizState.error), 'danger')
                              : quizContext?.attempt?.status === 'submitted'
                                  ? renderQuizSubmittedState(quizContext)
                                  : !quizContext?.availability?.isEligible
                                    ? renderAlert(escapeHtml(quizContext?.availability?.reason || 'Giáo viên chưa mở bài kiểm tra.'), 'info')
                                  : quizContext?.quiz
                                    ? renderQuizForm(quizContext.quiz, quizState.answers || {}, quizState.answerErrors || {}, {
                                        disabled: Boolean(quizState.isSubmitting),
                                        helperText:
                                          quizContext?.attempt?.status === 'reopened'
                                            ? 'Giáo viên đã mở lại lượt làm. Bạn có thể làm lại và hệ thống sẽ ghi nhận lần nộp mới.'
                                            : 'Mỗi lần chọn đáp án, hệ thống sẽ lưu tạm để nếu giáo viên kết thúc giữa chừng vẫn ghi nhận phần bạn đã chọn.',
                                        submitLabel: quizState.isSubmitting ? 'Đang nộp bài...' : 'Nộp bài kiểm tra',
                                        currentQuestionIndex: quizState.currentQuestionIndex || 0,
                                      })
                                    : renderAlert('Bài kiểm tra hiện chưa được cấu hình đầy đủ.', 'warning')
                  }
                `
            }
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderLessonArticle(
  lesson,
  selectedImageId,
  activeTab = LESSON_MARKDOWN_TAB_LECTURE,
  { preview = null, quizState = null } = {},
) {
  const sessionActivity = getCurriculumSessionActivity(preview?.program, lesson?.sessionNumber);

  if (isCurriculumQuizActivity(sessionActivity.activityType)) {
    return renderLessonQuizArticle(lesson, selectedImageId, preview, quizState || {});
  }

  const showExercises = hasVisibleLessonExercises(lesson);
  const normalizedTab =
    normalizeLessonMarkdownTab(activeTab) === LESSON_MARKDOWN_TAB_EXERCISE && showExercises
      ? LESSON_MARKDOWN_TAB_EXERCISE
      : LESSON_MARKDOWN_TAB_LECTURE;
  const articleHtml = renderLessonMarkdownHtml(lesson, normalizedTab);
  const emptyMessage =
    normalizedTab === LESSON_MARKDOWN_TAB_EXERCISE
      ? 'Giáo viên chưa thêm bài tập cho buổi học này.'
      : 'Giáo viên chưa thêm nội dung bài giảng cho buổi học này.';
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
          ${renderLessonContentTabs(normalizedTab, showExercises)}
          <article class="student-library-markdown">
            ${articleHtml || renderLessonMarkdownEmptyState(emptyMessage)}
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
  const resolvedActiveLessonIndex = activeLesson ? lessons.findIndex((lesson) => lesson.id === activeLesson.id) : -1;
  const selectedImageId = activeLesson ? selectedImageIds?.[activeLesson.id] || '' : '';
  const reportLink = options.reportLink || '';
  const embedded = Boolean(options.embedded);
  const lightboxImage = options.lightboxImage || null;
  const activeTab = normalizeLessonMarkdownTab(options.activeTab);

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
        previousLessonId: resolvedActiveLessonIndex > 0 ? lessons[resolvedActiveLessonIndex - 1]?.id || '' : '',
        nextLessonId:
          resolvedActiveLessonIndex >= 0 && resolvedActiveLessonIndex < lessons.length - 1
            ? lessons[resolvedActiveLessonIndex + 1]?.id || ''
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
                ? renderLessonArticle(enrichedLesson, selectedImageId, activeTab, {
                    preview,
                    quizState: options.quizState || null,
                  })
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
    ${renderLibraryImageLightbox(lightboxImage)}
  `;
}
