import { buildPublicLibraryPath } from '../../utils/route.js';
import { escapeHtml } from '../../utils/html.js';
import { renderAlert } from './Alert.js';
import { renderLoadingOverlay } from './LoadingOverlay.js';

export function renderStudentLibraryCta(curriculumPreview, classInfo, isLoading = false, error = '') {
  if (!classInfo?.classCode) {
    return '';
  }

  if (isLoading) {
    return renderLoadingOverlay('Đang tải học liệu...');
  }

  if (error) {
    return renderAlert(error, 'warning');
  }

  if (!curriculumPreview?.program) {
    return renderAlert('Giáo viên chưa cập nhật học liệu cho lớp này.', 'light');
  }

  const visibleLessonCount = curriculumPreview.visibleLessons?.length || 0;
  const currentLessonId =
    curriculumPreview.visibleLessons?.find((lesson) => lesson.sessionNumber === curriculumPreview.assignment?.currentSession)?.id ||
    curriculumPreview.visibleLessons?.[curriculumPreview.visibleLessons.length - 1]?.id ||
    '';
  const href = buildPublicLibraryPath(classInfo.classCode, {
    lessonId: currentLessonId,
    tab: 'overview',
  });

  return `
    <div class="card border-0 shadow-sm student-library-cta-card">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <div class="student-review-card__label">Học liệu</div>
            <h3 class="h5 mb-1">${escapeHtml(curriculumPreview.program.name)}</h3>
            <div class="small text-secondary">
              Đang có ${visibleLessonCount} buổi đã học để xem lại · Buổi hiện tại ${curriculumPreview.assignment?.currentSession || 1}
            </div>
          </div>
          <a class="btn btn-outline-primary" href="${href}">
            <i class="bi bi-journal-richtext me-2"></i>Xem học liệu
          </a>
        </div>
      </div>
    </div>
  `;
}
