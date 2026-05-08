import {
  getCurriculumProgram,
  listCurriculumPrograms,
} from '../../services/curriculum.service.js';
import {
  getActiveCurriculumLessons,
  getCurriculumActivityTypeLabel,
  getCurriculumSessionActivities,
  getCurriculumSessionActivity,
  isCurriculumQuizActivity,
} from '../../utils/curriculum-program.js';
import { escapeHtml } from '../../utils/html.js';
import { renderLessonMarkdownEmptyState, renderLessonMarkdownHtml } from '../../utils/lesson-markdown.js';
import {
  buildAdminLessonPreviewPath,
  buildAdminQuizPreviewPath,
  getHashRouteState,
} from '../../utils/route.js';
import { renderAlert } from '../components/Alert.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';

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
        <p class="text-secondary mb-0">Trang này chỉ dành cho admin, không cần chọn lớp hoặc học sinh.</p>
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

function getLessonMediaItems(lesson = {}) {
  const mediaItems = [];
  const seen = new Set();

  function pushImage(image, label) {
    if (!image?.secureUrl) {
      return;
    }

    const key = image.publicId || image.secureUrl;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    mediaItems.push({
      ...image,
      label,
    });
  }

  pushImage(lesson.bannerImage, 'Banner');
  pushImage(lesson.coverImage, 'Ảnh chính');
  (lesson.images || []).forEach((image, index) => pushImage(image, `Ảnh ${index + 1}`));
  return mediaItems;
}

function renderLessonMedia(lesson) {
  const mediaItems = getLessonMediaItems(lesson);

  if (!mediaItems.length) {
    return '';
  }

  return `
    <div class="row g-3 mb-4">
      ${mediaItems
        .map(
          (image) => `
            <div class="col-12 col-lg-6">
              <figure class="card border-0 bg-light-subtle h-100 overflow-hidden">
                <img
                  src="${escapeHtml(image.secureUrl)}"
                  alt="${escapeHtml(image.alt || image.label || lesson.title || 'Ảnh minh họa bài học')}"
                  class="w-100"
                  loading="lazy"
                  style="max-height: 360px; object-fit: cover;"
                />
                <figcaption class="card-body py-2 small text-secondary">${escapeHtml(image.label)}</figcaption>
              </figure>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderLessonPreview(program, sessionNumber) {
  const sessions = getCurriculumSessionActivities(program);
  const selectedActivity = getCurriculumSessionActivity(program, sessionNumber);
  const lessons = getActiveCurriculumLessons(program);
  const lesson = lessons.find((item) => Number(item.sessionNumber || 0) === Number(sessionNumber || 0)) || null;
  const quizPreviewPath = buildAdminQuizPreviewPath(program.id, sessionNumber);
  const lessonPreviewPath = buildAdminLessonPreviewPath(program.id, sessionNumber);

  return `
    <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start mb-3">
      <div>
        <div class="text-secondary small mb-1">Admin preview</div>
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
          <div class="col-12 col-md-7">
            <div class="d-flex flex-wrap gap-2">
              <a class="btn btn-primary" href="${escapeHtml(lessonPreviewPath)}">
                <i class="bi bi-journal-richtext me-2"></i>Xem nội dung buổi học
              </a>
              ${
                QUIZ_UI_ENABLED
                  ? `
                    <a class="btn btn-outline-primary" href="${escapeHtml(quizPreviewPath)}">
                      <i class="bi bi-patch-question me-2"></i>Làm thử quiz
                    </a>
                  `
                  : ''
              }
            </div>
          </div>
        </div>
      </div>
    </div>

    ${
      QUIZ_UI_ENABLED && isCurriculumQuizActivity(selectedActivity.activityType)
        ? renderAlert(
            'Buổi này đang được cấu hình là quiz/kiểm tra. Nội dung học liệu có thể trống và điều đó vẫn hợp lệ.',
            'info',
          )
        : ''
    }

    <article class="card border-0 shadow-sm">
      <div class="card-header bg-white border-0">
        <div class="d-flex flex-wrap justify-content-between gap-2 align-items-start">
          <div>
            <div class="small text-secondary mb-1">Buổi ${sessionNumber}</div>
            <h3 class="h5 mb-0">${escapeHtml(lesson?.title || 'Chưa có nội dung học liệu')}</h3>
          </div>
          <span class="badge text-bg-light text-dark border">${lesson ? 'Có học liệu' : 'Đang trống'}</span>
        </div>
      </div>
      <div class="card-body">
        ${
          lesson
            ? `
              ${renderLessonMedia(lesson)}
              <div class="student-library-markdown">
                ${
                  renderLessonMarkdownHtml(lesson) ||
                  renderLessonMarkdownEmptyState('Buổi này chưa có nội dung markdown để xem trước.')
                }
              </div>
            `
            : renderEmptyState({
                icon: 'journal-x',
                title: 'Buổi này chưa có học liệu',
                description:
                  'Nếu đây là buổi kiểm tra, bạn chỉ cần có bộ đề hợp lệ và dùng nút Test quiz admin ở phía trên.',
              })
        }
      </div>
    </article>
  `;
}

export const adminLessonPreviewPage = {
  async render({ authState }) {
    return renderAppShell({
      title: 'Xem thử học liệu',
      subtitle: 'Đường dẫn admin để xem nội dung theo chương trình và buổi, không cần mã lớp.',
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

        const program = await getCurriculumProgram(routeState.programId);

        if (!program) {
          throw new Error('Không tìm thấy chương trình học để preview.');
        }

        const sessionNumber = resolveSessionNumber(program, routeState.sessionNumber);

        if (!disposed) {
          root.innerHTML = renderLessonPreview(program, sessionNumber);
        }
      } catch (error) {
        if (!disposed) {
          root.innerHTML = renderAlert(escapeHtml(error?.message || 'Không thể tải preview học liệu.'), 'danger');
        }
      }
    }

    root.addEventListener('change', (event) => {
      const sessionSelect = event.target.closest('#admin-lesson-preview-session');
      const routeState = getHashRouteState();

      if (!sessionSelect || !routeState.programId) {
        return;
      }

      window.location.hash = buildAdminLessonPreviewPath(routeState.programId, Number(sessionSelect.value || 1));
    });

    await load();

    return () => {
      disposed = true;
    };
  },
};
