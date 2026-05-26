export function renderCurriculumWorkspaceSwitch(activeSection) {
  return `
    <div class="curriculum-workspace-switch" role="tablist" aria-label="Chuyển khu học liệu">
      <button
        type="button"
        class="curriculum-workspace-switch__button ${activeSection === 'assignment' ? 'curriculum-workspace-switch__button--active' : ''}"
        data-action="switch-workspace"
        data-workspace="assignment"
      >
        <i class="bi bi-diagram-3 me-2"></i>Gán cho lớp
      </button>
      <button
        type="button"
        class="curriculum-workspace-switch__button ${activeSection === 'editor' ? 'curriculum-workspace-switch__button--active' : ''}"
        data-action="switch-workspace"
        data-workspace="editor"
      >
        <i class="bi bi-pencil-square me-2"></i>Nội dung theo buổi
      </button>
      <button
        type="button"
        class="curriculum-workspace-switch__button ${activeSection === 'quiz-control' ? 'curriculum-workspace-switch__button--active' : ''}"
        data-action="switch-workspace"
        data-workspace="quiz-control"
      >
        <i class="bi bi-sliders2-vertical me-2"></i>Trung tâm điều khiển
      </button>
    </div>
  `;
}
