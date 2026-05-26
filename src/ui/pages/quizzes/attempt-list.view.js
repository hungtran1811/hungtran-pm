import { getCurriculumActivityTypeLabel } from '../../../utils/curriculum-program.js';
import { formatDateTime } from '../../../utils/date.js';
import { escapeHtml } from '../../../utils/html.js';
import { renderAlert } from '../../components/Alert.js';
import { renderEmptyState } from '../../components/EmptyState.js';
import { renderLoadingOverlay } from '../../components/LoadingOverlay.js';
import { getAttemptSourceBadge, getAttemptStatusBadge, renderAttemptScore } from './attempt-status.view.js';

export function renderAttemptList({
  classes,
  selectedClassCode,
  selectedSessionFilter,
  sessionFilterOptions = [],
  attempts,
  isLoading,
  error,
  selectedAttemptId,
}) {
  return `
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-white border-0">
        <h2 class="h5 mb-1">Bài nộp của học sinh</h2>
        <p class="text-secondary mb-0">Theo dõi trạng thái nộp bài, điểm chấm tự động và mở lại khi cần.</p>
      </div>
      <div class="card-body">
        <div class="row g-3 mb-3">
          <div class="col-12 col-lg-8">
            <label class="form-label">Lớp</label>
            <select id="quiz-attempt-class-select" class="form-select">
              <option value="">Chọn lớp để xem bài nộp</option>
              ${classes
                .map(
                  (classItem) => `
                    <option value="${escapeHtml(classItem.classCode)}" ${classItem.classCode === selectedClassCode ? 'selected' : ''}>
                      ${escapeHtml(classItem.classCode)} - ${escapeHtml(classItem.className)}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </div>
          <div class="col-12 col-lg-4">
            <label class="form-label">Lọc theo buổi</label>
            <select id="quiz-attempt-session-filter" class="form-select">
              <option value="all" ${selectedSessionFilter === 'all' ? 'selected' : ''}>Tất cả</option>
              ${sessionFilterOptions
                .map(
                  (item) => `
                  <option value="${item.sessionNumber}" ${Number(selectedSessionFilter) === item.sessionNumber ? 'selected' : ''}>
                    Buổi ${item.sessionNumber} - ${escapeHtml(getCurriculumActivityTypeLabel(item.activityType))}
                  </option>
                `,
                )
                .join('')}
            </select>
          </div>
        </div>
        ${
          !selectedClassCode
            ? renderEmptyState({
                icon: 'inboxes',
                title: 'Chưa chọn lớp',
                description: 'Chọn một lớp ở trên để xem danh sách bài nộp trắc nghiệm.',
              })
            : isLoading
              ? renderLoadingOverlay('Đang tải danh sách bài nộp...')
              : error
                ? renderAlert(escapeHtml(error), 'danger')
                : attempts.length > 0
                  ? `
                    <div class="quiz-attempt-card-list">
                      ${attempts
                        .map(
                          (attempt) => `
                            <article class="quiz-attempt-card ${attempt.id === selectedAttemptId ? 'quiz-attempt-card--active' : ''}">
                              <button
                                type="button"
                                class="quiz-attempt-card__main"
                                data-action="open-attempt-modal"
                                data-attempt-id="${escapeHtml(attempt.id)}"
                              >
                                <span class="quiz-attempt-card__student">${escapeHtml(attempt.studentName)}</span>
                                <span class="quiz-attempt-card__meta">
                                  ${escapeHtml(attempt.quizTitle || 'Bài kiểm tra')} · Buổi ${Number(attempt.sessionNumber || 0)}
                                </span>
                              </button>
                              <div class="quiz-attempt-card__status">
                                ${getAttemptStatusBadge(attempt)}
                                ${getAttemptSourceBadge(attempt)}
                              </div>
                              <div class="quiz-attempt-card__score">${renderAttemptScore(attempt)}</div>
                              <div class="quiz-attempt-card__time">${escapeHtml(formatDateTime(attempt.submittedAt))}</div>
                            </article>
                          `,
                        )
                        .join('')}
                    </div>
                  `
                  : renderEmptyState({
                      icon: 'clipboard2-x',
                      title: 'Chưa có bài nộp',
                      description: 'Lớp này chưa có học sinh nộp bài trong phạm vi lọc hiện tại.',
                    })
        }
      </div>
    </div>
  `;
}
