import { escapeHtml, renderTextWithCodeBlocks } from '../../../utils/html.js';
import { renderEmptyState } from '../../components/EmptyState.js';
import { buildAttemptReportSummary } from './attempt-grading.js';

function renderAttemptSummaryCard({
  title,
  value,
  description,
  tone = 'neutral',
}) {
  return `
    <div class="quiz-summary-card quiz-summary-card--${tone}">
      <div class="quiz-summary-card__label">${escapeHtml(title)}</div>
      <div class="quiz-summary-card__value">${escapeHtml(value)}</div>
      <div class="quiz-summary-card__description">${escapeHtml(description)}</div>
    </div>
  `;
}

function renderQuestionInsight(title, question, mode = 'wrong') {
  if (!question) {
    return renderEmptyState({
      icon: 'bar-chart',
      title,
      description: 'Chưa có đủ bài nộp để tổng hợp chỉ số cho câu hỏi này.',
    });
  }

  return `
    <div class="quiz-summary-insight">
      <div class="small text-secondary text-uppercase fw-semibold mb-2">${escapeHtml(title)}</div>
      <div class="fw-semibold mb-2">${renderTextWithCodeBlocks(question.prompt)}</div>
      <div class="small text-secondary">
        ${
          mode === 'wrong'
            ? `Bị sai ${question.wrongCount}/${question.appearanceCount} lượt (${question.wrongRate}%).`
            : `Làm đúng ${question.correctCount}/${question.appearanceCount} lượt (${question.correctRate}%).`
        }
      </div>
    </div>
  `;
}

export function renderAttemptOverviewReport(attempts = [], liveAttemptCount = 0) {
  const summary = buildAttemptReportSummary(attempts);

  return `
    <div class="card border-0 shadow-sm h-100">
      <div class="card-header bg-white border-0">
        <h2 class="h5 mb-1">Báo cáo nhanh</h2>
        <p class="text-secondary mb-0">Tóm tắt kết quả lớp theo bộ lọc hiện tại.</p>
      </div>
      <div class="card-body">
        ${
          summary.totalAttempts === 0
            ? renderEmptyState({
                icon: 'clipboard2-data',
                title: liveAttemptCount > 0 ? `${liveAttemptCount} học sinh đang làm bài` : 'Chưa có dữ liệu để tổng hợp',
                description:
                  liveAttemptCount > 0
                    ? 'Khi học sinh nộp hoặc admin kết thúc bài kiểm tra, thống kê điểm và câu đúng/sai sẽ hiển thị ở đây.'
                    : 'Khi học sinh nộp bài, thống kê điểm và câu khó/dễ sẽ hiển thị ở đây.',
              })
            : `
              <div class="quiz-summary-grid mb-4">
                ${renderAttemptSummaryCard({
                  title: 'Đang làm',
                  value: String(liveAttemptCount),
                  description: 'Số học sinh đã chọn ít nhất một đáp án và đang có bản nháp.',
                  tone: 'primary',
                })}
                ${renderAttemptSummaryCard({
                  title: 'Số bài đã nộp',
                  value: String(summary.totalAttempts),
                  description: 'Tính theo bộ lọc lớp và buổi hiện tại.',
                  tone: 'primary',
                })}
                ${renderAttemptSummaryCard({
                  title: 'Điểm trung bình',
                  value: `${summary.averageScore}%`,
                  description: `Cao nhất ${summary.highestScore}% · Thấp nhất ${summary.lowestScore}%`,
                  tone: 'success',
                })}
                ${renderAttemptSummaryCard({
                  title: 'Bài đạt tuyệt đối',
                  value: String(summary.perfectCount),
                  description: 'Số bài đạt 100% trong bộ lọc hiện tại.',
                  tone: 'warning',
                })}
              </div>
              <div class="row g-3">
                <div class="col-12 col-xl-6">
                  ${renderQuestionInsight('Câu bị sai nhiều nhất', summary.hardestQuestion, 'wrong')}
                </div>
                <div class="col-12 col-xl-6">
                  ${renderQuestionInsight('Câu làm tốt nhất', summary.easiestQuestion, 'correct')}
                </div>
              </div>
            `
        }
      </div>
    </div>
  `;
}
