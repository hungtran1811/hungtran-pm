import { buildPublicQuizPath } from '../../utils/route.js';
import {
  getCurriculumActivityTypeLabel,
  getCurriculumSessionActivity,
  isCurriculumQuizActivity,
} from '../../utils/curriculum-program.js';
import { isQuizStartedForClass, QUIZ_QUESTION_LIMIT } from '../../utils/quiz.js';
import { escapeHtml } from '../../utils/html.js';

export function renderStudentQuizCta(curriculumPreview, classInfo) {
  if (!classInfo?.classCode || !curriculumPreview?.program) {
    return '';
  }

  const currentSession = Number(
    curriculumPreview?.assignment?.currentSession || curriculumPreview?.classInfo?.curriculumCurrentSession || 0,
  );
  const sessionActivity = getCurriculumSessionActivity(curriculumPreview.program, currentSession);

  if (!isCurriculumQuizActivity(sessionActivity.activityType)) {
    return '';
  }

  const href = buildPublicQuizPath(classInfo.classCode);
  const programName = String(curriculumPreview?.program?.name || classInfo.className || '').trim();
  const isStarted = isQuizStartedForClass(curriculumPreview?.classInfo || classInfo, currentSession);
  const activityLabel = getCurriculumActivityTypeLabel(sessionActivity.activityType);

  return `
    <div class="card border-0 shadow-sm student-library-cta-card">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <div class="student-review-card__label">${escapeHtml(activityLabel)}</div>
            <h3 class="h5 mb-1">Bài kiểm tra buổi ${currentSession}</h3>
            <div class="small text-secondary">
              ${programName ? `${escapeHtml(programName)} · ` : ''}Mỗi học sinh nhận ${QUIZ_QUESTION_LIMIT} câu ngẫu nhiên theo tỉ lệ 4 dễ, 4 trung bình, 2 khó.
            </div>
            <div class="small mt-2 ${isStarted ? 'text-success' : 'text-secondary'}">
              ${
                isStarted
                  ? 'Giáo viên đã mở bài kiểm tra cho lớp này.'
                  : 'Giáo viên chưa mở cho cả lớp. Nếu bạn đã được mở lại riêng, hãy vào trang kiểm tra để làm lại.'
              }
            </div>
          </div>
          <a class="btn ${isStarted ? 'btn-primary' : 'btn-outline-secondary'}" href="${href}">
            <i class="bi ${isStarted ? 'bi-ui-radios-grid' : 'bi-box-arrow-up-right'} me-2"></i>
            ${isStarted ? 'Làm bài kiểm tra' : 'Vào trang kiểm tra'}
          </a>
        </div>
      </div>
    </div>
  `;
}
