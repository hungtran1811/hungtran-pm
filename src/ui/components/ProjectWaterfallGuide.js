import { getProjectStageChecklist } from '../../demo/project-stage-guide.js';
import { escapeHtml } from '../../utils/html.js';

const WATERFALL_TONES = ['analysis', 'design', 'build', 'test', 'improve'];

function normalizeStageText(value = '') {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getChecklistItems(curriculumPreview) {
  const checklist = Array.isArray(curriculumPreview?.program?.finalChecklist)
    ? curriculumPreview.program.finalChecklist
    : [];

  if (checklist.length > 0) {
    return checklist;
  }

  return getProjectStageChecklist(curriculumPreview?.program?.id || 'project');
}

export function shouldShowProjectWaterfallGuide(curriculumPreview) {
  return (
    curriculumPreview?.assignment?.curriculumPhase === 'final'
    && curriculumPreview?.program?.finalMode === 'project'
  );
}

export function renderProjectWaterfallGuide(curriculumPreview, student = null) {
  if (!shouldShowProjectWaterfallGuide(curriculumPreview)) {
    return '';
  }

  const stages = getChecklistItems(curriculumPreview);
  const currentStage = student?.currentStage || '';
  const currentStageKey = normalizeStageText(currentStage);
  const currentIndex = stages.findIndex((item) => normalizeStageText(item.title) === currentStageKey);
  const hasCurrentStage = currentIndex >= 0;

  return `
    <section class="project-waterfall-card" aria-label="Quy trình Waterfall sản phẩm cuối khóa">
      <div class="project-waterfall-card__head">
        <div>
          <div class="student-report-eyebrow">Quy trình Waterfall</div>
          <h2>Tự đánh giá giai đoạn dự án</h2>
          <p>Đọc từ trái sang phải, rồi chọn đúng giai đoạn hiện tại trong form báo cáo.</p>
        </div>
        <span class="project-waterfall-card__status">
          ${
            hasCurrentStage
              ? `Đang ở: ${escapeHtml(stages[currentIndex].title)}`
              : 'Sản phẩm cuối khóa'
          }
        </span>
      </div>

      <div class="project-waterfall-steps">
        ${stages
          .map((item, index) => {
            const stateClass = hasCurrentStage
              ? index < currentIndex
                ? 'project-waterfall-step--done'
                : index === currentIndex
                  ? 'project-waterfall-step--active'
                  : 'project-waterfall-step--next'
              : '';

            return `
              <article class="project-waterfall-step project-waterfall-step--tone-${WATERFALL_TONES[index] || 'default'} ${stateClass}">
                <div class="project-waterfall-step__top">
                  <span class="project-waterfall-step__number">${item.order || index + 1}</span>
                  <div>
                    <h3>${escapeHtml(item.title)}</h3>
                    <p>${escapeHtml(item.description || '')}</p>
                  </div>
                </div>
                ${
                  item.studentGuide
                    ? `
                      <div class="project-waterfall-step__hint">
                        <span>${escapeHtml(item.studentGuide)}</span>
                      </div>
                    `
                    : ''
                }
              </article>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
}
