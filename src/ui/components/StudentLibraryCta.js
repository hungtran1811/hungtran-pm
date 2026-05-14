import { buildPublicLibraryPath } from '../../utils/route.js';
import { escapeHtml } from '../../utils/html.js';
import { renderAlert } from './Alert.js';

export function renderStudentLibraryCta(curriculumPreview, classInfo, isLoading = false, error = '') {
  if (!classInfo?.classCode) {
    return '';
  }

  if (isLoading) {
    return `
      <div class="student-report-library-action student-report-library-action--muted">
        <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
        <span>Đang tải học liệu...</span>
      </div>
    `;
  }

  if (error) {
    return renderAlert(error, 'warning');
  }

  if (!curriculumPreview?.program) {
    return '';
  }

  const visibleLessonCount = curriculumPreview.visibleLessons?.length || 0;
  const currentSession = curriculumPreview.assignment?.currentSession || 1;
  const currentLessonId =
    curriculumPreview.visibleLessons?.find((lesson) => lesson.sessionNumber === currentSession)?.id ||
    curriculumPreview.visibleLessons?.[curriculumPreview.visibleLessons.length - 1]?.id ||
    '';
  const href = buildPublicLibraryPath(classInfo.classCode, {
    lessonId: currentLessonId,
    tab: 'lecture',
  });

  return `
    <a class="student-report-library-action" href="${escapeHtml(href)}">
      <span>
        <span class="student-report-eyebrow">Học liệu</span>
        <strong>${escapeHtml(curriculumPreview.program.name)}</strong>
        <small>${visibleLessonCount} buổi đã mở · Buổi hiện tại ${currentSession}</small>
      </span>
      <span class="btn btn-outline-primary btn-sm">
        <i class="bi bi-journal-richtext me-1"></i>Xem học liệu
      </span>
    </a>
  `;
}
