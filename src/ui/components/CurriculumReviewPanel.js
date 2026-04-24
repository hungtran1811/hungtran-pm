import { getProjectFinalRangeLabel } from '../../demo/project-stage-guide.js';
import { escapeHtml } from '../../utils/html.js';

const FINAL_MODE_LABELS = {
  project: 'Sản phẩm cuối khóa',
  exam: 'Kiểm tra cuối khóa',
};

function toDomKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
}

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

function getLessonPreviewImage(lesson) {
  if (Array.isArray(lesson?.images) && lesson.images.length > 0) {
    return [...lesson.images].sort((left, right) => (left.order || 0) - (right.order || 0))[0] || null;
  }

  if (lesson?.coverImage?.secureUrl) {
    return lesson.coverImage;
  }

  return null;
}

function renderLessonImage(lesson) {
  const image = getLessonPreviewImage(lesson);

  if (!image?.secureUrl) {
    return '';
  }

  const alt = image.alt || lesson.title || 'Ảnh minh họa bài học';

  return `
    <figure class="student-library-lesson__figure">
      <img
        src="${escapeHtml(image.secureUrl)}"
        alt="${escapeHtml(alt)}"
        class="student-library-lesson__image"
        loading="lazy"
      >
    </figure>
  `;
}

function renderLessonLinks(links = []) {
  if (!Array.isArray(links) || links.length === 0) {
    return '';
  }

  return `
    <div class="student-review-focus__box mb-0">
      <strong class="d-block mb-1">Tài liệu đi kèm</strong>
      <div class="student-library-links">
        ${links
          .map((item) => {
            const label = typeof item === 'string' ? item : item?.label || item?.url || '';
            const url = typeof item === 'string' ? item : item?.url || '';
            const href = getSafeLinkHref(url);

            if (!href) {
              return `<div class="student-library-link-chip student-library-link-chip--muted">${escapeHtml(label)}</div>`;
            }

            return `
              <a
                class="student-library-link-chip"
                href="${escapeHtml(href)}"
                target="_blank"
                rel="noreferrer"
              >
                <i class="bi bi-link-45deg me-1"></i>${escapeHtml(label)}
              </a>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}

function renderLessonContent(lesson) {
  return `
    <div class="student-review-pane-grid">
      ${renderLessonImage(lesson)}
      <div class="student-review-focus__box">
        <strong class="d-block mb-1">Tóm tắt</strong>
        <div>${escapeHtml(lesson.summary)}</div>
      </div>
      <div class="student-review-focus__box">
        <strong class="d-block mb-1">Ý chính cần nhớ</strong>
        <ul class="mb-0 ps-3">
          ${(lesson.keyPoints || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>
      <div class="student-review-focus__box mb-0">
        <strong class="d-block mb-1">Nhiệm vụ gợi ý</strong>
        <div>${escapeHtml(lesson.practiceTask)}</div>
      </div>
      ${renderLessonLinks(lesson.reviewLinks)}
    </div>
  `;
}

function renderLessonTabs(lessons, activeLessonId, idPrefix) {
  const navId = `${idPrefix}-lesson-tabs`;
  const contentId = `${idPrefix}-lesson-content`;

  return `
    <div class="student-review-tab-shell">
      <div class="student-review-card__label mb-2">Chọn buổi để xem lại</div>
      <div class="student-review-pill-scroll">
        <div class="nav nav-pills student-review-lesson-pills" id="${navId}" role="tablist">
          ${lessons
            .map((lesson) => {
              const tabId = `${idPrefix}-tab-${lesson.sessionNumber}`;
              const paneId = `${idPrefix}-pane-${lesson.sessionNumber}`;
              const active = lesson.id === activeLessonId;

              return `
                <button
                  class="nav-link ${active ? 'active' : ''}"
                  id="${tabId}"
                  data-bs-toggle="pill"
                  data-bs-target="#${paneId}"
                  type="button"
                  role="tab"
                  aria-controls="${paneId}"
                  aria-selected="${active ? 'true' : 'false'}"
                >
                  Buổi ${lesson.sessionNumber}
                </button>
              `;
            })
            .join('')}
        </div>
      </div>
      <div class="tab-content student-review-tab-content" id="${contentId}">
        ${lessons
          .map((lesson) => {
            const paneId = `${idPrefix}-pane-${lesson.sessionNumber}`;
            const active = lesson.id === activeLessonId;

            return `
              <div
                class="tab-pane fade ${active ? 'show active' : ''}"
                id="${paneId}"
                role="tabpanel"
                aria-labelledby="${idPrefix}-tab-${lesson.sessionNumber}"
              >
                <div class="student-review-pane-card ${active ? 'student-review-pane-card--current' : ''}">
                  <div class="d-flex flex-wrap justify-content-between gap-2 align-items-start mb-3">
                    <div>
                      <div class="student-review-card__label">Buổi ${lesson.sessionNumber}</div>
                      <h4 class="h6 mb-1">${escapeHtml(lesson.title)}</h4>
                      <div class="small text-secondary">${escapeHtml(lesson.summary)}</div>
                    </div>
                    <span class="badge ${active ? 'text-bg-primary' : 'text-bg-light text-dark border'}">
                      ${active ? 'Buổi đang chọn' : 'Đã học'}
                    </span>
                  </div>
                  ${renderLessonContent(lesson)}
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}

function renderLearningReview(preview, idPrefix) {
  const currentSession = preview.assignment.currentSession;
  const currentLesson =
    preview.visibleLessons.find((lesson) => lesson.sessionNumber === currentSession) ||
    preview.visibleLessons[preview.visibleLessons.length - 1] ||
    null;

  if (!currentLesson) {
    return '';
  }

  return `
    <div class="student-review-card__section">
      <div class="student-review-card__section-head">
        <div>
          <div class="student-review-card__label">Ôn lại bài cũ</div>
          <h3 class="h5 mb-0">Các buổi đã học</h3>
        </div>
        <span class="badge text-bg-light text-dark border">
          ${preview.visibleLessons.length}/${preview.program.knowledgePhaseEndSession} buổi kiến thức · ${preview.program.totalSessionCount} buổi toàn khóa
        </span>
      </div>
      ${renderLessonTabs(preview.visibleLessons, currentLesson.id, `${idPrefix}-learning`)}
    </div>
  `;
}

function renderChecklist(preview) {
  const isProject = preview.program.finalMode === 'project';

  return `
    <div class="student-review-checklist">
      ${preview.program.finalChecklist
        .map(
          (item) => `
            <div class="student-review-checklist__item">
              <div class="student-review-checklist__order">${item.order}</div>
              <div class="w-100">
                <div class="fw-semibold">${escapeHtml(item.title)}</div>
                <div class="small text-secondary mt-1">${escapeHtml(item.description)}</div>
                ${
                  isProject
                    ? `
                      <div class="student-review-checklist__meta mt-3">
                        <div class="student-review-focus__box mb-0">
                          <strong class="d-block mb-1">Tự đối chiếu</strong>
                          <div>${escapeHtml(item.studentGuide)}</div>
                        </div>
                        <div class="student-review-focus__box mb-0">
                          <strong class="d-block mb-1">Ví dụ đầu ra</strong>
                          <div>${escapeHtml(item.exampleOutput)}</div>
                        </div>
                      </div>
                    `
                    : ''
                }
              </div>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderFinalReview(preview, idPrefix) {
  const highlightedSession = Math.min(
    preview.assignment.currentSession,
    preview.program.knowledgePhaseEndSession,
  );
  const activeLesson =
    preview.lessons.find((lesson) => lesson.sessionNumber === highlightedSession) ||
    preview.lessons[0] ||
    null;
  const isProject = preview.program.finalMode === 'project';
  const outerNavId = `${idPrefix}-outer-tabs`;
  const checklistPaneId = `${idPrefix}-checklist-pane`;
  const lessonsPaneId = `${idPrefix}-lessons-pane`;

  return `
    <div class="student-review-card__section">
      <div class="student-review-card__section-head">
        <div>
          <div class="student-review-card__label">Giai đoạn cuối khóa</div>
          <h3 class="h5 mb-0">${escapeHtml(
            isProject
              ? 'Quy trình làm sản phẩm cuối khóa'
              : FINAL_MODE_LABELS[preview.program.finalMode] || preview.program.finalMode,
          )}</h3>
        </div>
        <span class="badge ${preview.program.finalMode === 'project' ? 'text-bg-success' : 'text-bg-info'}">
          ${escapeHtml(
            isProject
              ? getProjectFinalRangeLabel(preview.program)
              : `Buổi ${preview.program.totalSessionCount}`,
          )}
        </span>
      </div>

      <div class="student-review-pill-scroll mb-3">
        <div class="nav nav-pills student-review-lesson-pills" id="${outerNavId}" role="tablist">
          <button
            class="nav-link active"
            id="${idPrefix}-checklist-tab"
            data-bs-toggle="pill"
            data-bs-target="#${checklistPaneId}"
            type="button"
            role="tab"
            aria-controls="${checklistPaneId}"
            aria-selected="true"
          >
            ${escapeHtml(isProject ? 'Quy trình cuối khóa' : 'Checklist ôn tập')}
          </button>
          <button
            class="nav-link"
            id="${idPrefix}-lessons-tab"
            data-bs-toggle="pill"
            data-bs-target="#${lessonsPaneId}"
            type="button"
            role="tab"
            aria-controls="${lessonsPaneId}"
            aria-selected="false"
          >
            Xem lại bài đã học
          </button>
        </div>
      </div>

      <div class="tab-content student-review-tab-content">
        <div
          class="tab-pane fade show active"
          id="${checklistPaneId}"
          role="tabpanel"
          aria-labelledby="${idPrefix}-checklist-tab"
        >
          <div class="student-review-pane-card">
            ${renderChecklist(preview)}
            <div class="curriculum-preview-note mt-3">
              ${
                isProject
                  ? 'Đọc từng giai đoạn rồi so sánh với mục "Giai đoạn hiện tại" trong form báo cáo để tự đánh giá mình đang ở đâu trong quy trình làm sản phẩm.'
                  : `Lớp này đang ôn kiểm tra cuối khóa ở buổi ${preview.program.totalSessionCount}.`
              }
            </div>
          </div>
        </div>

        <div
          class="tab-pane fade"
          id="${lessonsPaneId}"
          role="tabpanel"
          aria-labelledby="${idPrefix}-lessons-tab"
        >
          ${activeLesson ? renderLessonTabs(preview.lessons, activeLesson.id, `${idPrefix}-review`) : ''}
        </div>
      </div>
    </div>
  `;
}

export function renderCurriculumReviewPanel(preview, classInfo = null) {
  if (!classInfo?.classCode) {
    return '';
  }

  if (!preview || !preview.program || !preview.assignment) {
    return `
      <div class="card border-0 shadow-sm student-review-card">
        <div class="card-body">
          <div class="student-review-card__label">Ôn lại bài cũ</div>
          <h2 class="h5 mb-2">Lớp này chưa được gán học liệu</h2>
          <p class="text-secondary mb-0">
            Giáo viên chưa cập nhật chương trình học cho lớp ${escapeHtml(classInfo.classCode)} nên phần ôn tập chưa hiển thị.
          </p>
        </div>
      </div>
    `;
  }

  const idPrefix = `review-${toDomKey(classInfo.classCode)}-${toDomKey(preview.program.id)}`;

  return `
    <div class="card border-0 shadow-sm student-review-card">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start mb-3">
          <div>
            <div class="student-review-card__label">Ôn lại bài cũ</div>
            <h2 class="h5 mb-1">${escapeHtml(preview.program.name)}</h2>
            <div class="small text-secondary">
              ${classInfo?.classCode ? `${escapeHtml(classInfo.classCode)} · ` : ''}Mốc kiến thức đến buổi ${preview.program.knowledgePhaseEndSession} · Tổng ${preview.program.totalSessionCount} buổi
            </div>
          </div>
          <div class="d-flex flex-wrap gap-2">
            <span class="badge text-bg-light text-dark border">Buổi hiện tại: ${preview.assignment.currentSession}</span>
            <span class="badge ${preview.assignment.curriculumPhase === 'final' ? 'text-bg-success' : 'text-bg-primary'}">
              ${preview.assignment.curriculumPhase === 'final' ? 'Giai đoạn cuối khóa' : 'Học kiến thức'}
            </span>
          </div>
        </div>

        ${
          preview.assignment.curriculumPhase === 'final'
            ? renderFinalReview(preview, `${idPrefix}-final`)
            : renderLearningReview(preview, `${idPrefix}-learning`)
        }
      </div>
    </div>
  `;
}
