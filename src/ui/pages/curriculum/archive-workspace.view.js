import { getArchivedCurriculumLessons } from '../../../utils/curriculum-program.js';
import { escapeHtml } from '../../../utils/html.js';
import {
  getLessonMarkdownSource,
  LESSON_MARKDOWN_TAB_EXERCISE,
  LESSON_MARKDOWN_TAB_LECTURE,
} from '../../../utils/lesson-markdown.js';

export function renderArchivedLessonVault(program, busyKey = '') {
  const archivedLessons = getArchivedCurriculumLessons(program);

  return `
    <section class="card border-0 shadow-sm curriculum-lesson-vault">
      <div class="card-header bg-white border-0">
        <div class="d-flex flex-wrap justify-content-between gap-2 align-items-start">
          <div>
            <h3 class="h6 mb-1">Kho lưu trữ bài học</h3>
            <div class="small text-secondary">Các buổi đã lưu kho nằm ở đây. Chỉ bài trong kho mới có lựa chọn xóa vĩnh viễn.</div>
          </div>
          <span class="badge text-bg-light text-dark border">${archivedLessons.length} bài</span>
        </div>
      </div>
      <div class="card-body">
        ${
          archivedLessons.length === 0
            ? `
              <div class="curriculum-editor-empty">
                Chưa có bài học nào trong kho. Khi bạn bấm <strong>Lưu kho buổi này</strong>, bài sẽ xuất hiện ở đây để khôi phục hoặc xóa hẳn.
              </div>
            `
            : `
              <div class="curriculum-lesson-vault__grid">
                ${archivedLessons
                  .map(
                    (lesson) => `
                      <article class="curriculum-lesson-vault__item">
                        <div>
                          <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
                            <span class="badge text-bg-light text-dark border">Buổi ${Number(lesson.sessionNumber || 0)}</span>
                            <span class="badge text-bg-warning-subtle text-dark border">Đang lưu kho</span>
                          </div>
                          <h4 class="h6 mb-1">${escapeHtml(lesson.title || 'Chưa có tiêu đề')}</h4>
                          <div class="small text-secondary">
                            ${getLessonMarkdownSource(lesson, LESSON_MARKDOWN_TAB_LECTURE) ? 'Có bài giảng' : 'Chưa có bài giảng'}
                            ·
                            ${getLessonMarkdownSource(lesson, LESSON_MARKDOWN_TAB_EXERCISE) ? 'Có bài tập' : 'Chưa có bài tập'}
                          </div>
                        </div>
                        <div class="curriculum-lesson-vault__actions">
                          <button
                            type="button"
                            class="btn btn-outline-primary btn-sm"
                            data-action="restore-lesson"
                            data-lesson-id="${escapeHtml(lesson.id)}"
                            ${busyKey === `restore-lesson:${lesson.id}` ? 'disabled' : ''}
                          >
                            ${
                              busyKey === `restore-lesson:${lesson.id}`
                                ? '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Đang khôi phục...'
                                : '<i class="bi bi-arrow-counterclockwise me-1"></i>Khôi phục'
                            }
                          </button>
                          <button
                            type="button"
                            class="btn btn-outline-danger btn-sm"
                            data-action="delete-archived-lesson"
                            data-lesson-id="${escapeHtml(lesson.id)}"
                            ${busyKey === `delete-lesson:${lesson.id}` ? 'disabled' : ''}
                          >
                            ${
                              busyKey === `delete-lesson:${lesson.id}`
                                ? '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Đang xóa...'
                                : '<i class="bi bi-trash3 me-1"></i>Xóa vĩnh viễn'
                            }
                          </button>
                        </div>
                      </article>
                    `,
                  )
                  .join('')}
              </div>
            `
        }
      </div>
    </section>
  `;
}
