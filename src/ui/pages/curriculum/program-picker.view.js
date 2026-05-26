import { isCloudinaryConfigured } from '../../../services/cloudinary.service.js';
import {
  buildAdminLessonPreviewPath,
  buildAdminQuizPreviewPath,
} from '../../../utils/route.js';
import {
  CURRICULUM_ACTIVITY_TYPES,
  getActiveCurriculumLessons,
  getArchivedCurriculumLessons,
  getCurriculumActivityTypeLabel,
  getCurriculumSessionActivities,
  getCurriculumSessionActivity,
  isCurriculumQuizActivity,
} from '../../../utils/curriculum-program.js';
import { escapeHtml } from '../../../utils/html.js';
import { renderEmptyState } from '../../components/EmptyState.js';
import { renderQuizManagementContent } from '../quizzes.page.js';
import { renderArchivedLessonVault } from './archive-workspace.view.js';
import { renderLessonFormV3 } from './lesson-editor.view.js';

const LEVEL_BADGE_CLASSES = {
  Basic: 'text-bg-light text-dark border',
  Advanced: 'text-bg-primary',
  Intensive: 'text-bg-warning text-dark',
};

export function getSuggestedLessonSession(program) {
  const maxSession = Math.max(1, Number(program?.totalSessionCount || program?.knowledgePhaseEndSession || 1));
  const activeSessions = new Set(getActiveCurriculumLessons(program).map((lesson) => lesson.sessionNumber));

  for (let sessionNumber = 1; sessionNumber <= maxSession; sessionNumber += 1) {
    if (!activeSessions.has(sessionNumber)) {
      return sessionNumber;
    }
  }

  return maxSession;
}

export function getLessonSessionLimit(program) {
  return Math.max(1, Number(program?.totalSessionCount || program?.knowledgePhaseEndSession || 1));
}

export function getNewLessonDraft(program) {
  return {
    id: '',
    sessionNumber: getSuggestedLessonSession(program),
    title: '',
    contentMarkdown: '',
    lectureMarkdown: '',
    exerciseMarkdown: '',
    summary: '',
    keyPoints: [],
    practiceTask: '',
    selfStudyPrompt: '',
    reviewLinks: [],
    teacherNote: '',
    bannerImage: null,
    images: [],
  };
}

export function findLessonBySession(program, sessionNumber) {
  const normalizedSessionNumber = Number(sessionNumber || 0);
  return (
    getActiveCurriculumLessons(program).find(
      (lesson) => Number(lesson.sessionNumber || 0) === normalizedSessionNumber,
    ) || null
  );
}

export function getLessonDraftForSession(program, sessionNumber) {
  const normalizedSessionNumber = Math.max(1, Number(sessionNumber || 1));
  const savedLesson = findLessonBySession(program, normalizedSessionNumber);

  if (savedLesson) {
    return savedLesson;
  }

  return {
    ...getNewLessonDraft(program),
    sessionNumber: normalizedSessionNumber,
    title: `Buổi ${normalizedSessionNumber}`,
  };
}

function renderSessionActivityInlineForm(program, selectedSessionNumber, busyKey = '', quizUiEnabled = false) {
  if (!program || !quizUiEnabled) {
    return '';
  }

  const selectedActivity = getCurriculumSessionActivity(program, selectedSessionNumber);

  return `
    <form id="curriculum-session-activity-form" class="curriculum-activity-inline-form">
      <input type="hidden" name="activitySessionNumber" value="${Number(selectedActivity.sessionNumber || selectedSessionNumber || 1)}">
      <div>
        <label class="form-label">Loại buổi</label>
        <select class="form-select" name="activityType">
          ${CURRICULUM_ACTIVITY_TYPES.map(
            (activityType) => `
              <option value="${escapeHtml(activityType)}" ${activityType === selectedActivity.activityType ? 'selected' : ''}>
                ${escapeHtml(getCurriculumActivityTypeLabel(activityType))}
              </option>
            `,
          ).join('')}
        </select>
      </div>
      <button type="submit" class="btn btn-primary" ${busyKey === 'save-session-activity' ? 'disabled' : ''}>
        ${
          busyKey === 'save-session-activity'
            ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang lưu...'
            : '<i class="bi bi-save me-2"></i>Lưu loại buổi'
        }
      </button>
    </form>
  `;
}

function renderProgramPickerBar(programGroups, selectedProgramId, busyKey = '') {
  const programs = programGroups.flatMap((group) => group.programs);
  const selectedProgram = programs.find((program) => program.id === selectedProgramId) || programs[0] || null;

  if (!programs.length) {
    return '';
  }

  return `
    <div class="card border-0 shadow-sm curriculum-content-picker">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-xl-6">
            <label class="form-label">Chương trình cần soạn</label>
            <select class="form-select" name="editorProgramId">
              ${programs
                .map(
                  (program) => `
                    <option value="${escapeHtml(program.id)}" ${program.id === selectedProgramId ? 'selected' : ''}>
                      ${escapeHtml(program.name)}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </div>
          <div class="col-12 col-xl-6">
            <div class="d-flex flex-wrap gap-2 align-items-center justify-content-xl-end">
              <span class="badge ${LEVEL_BADGE_CLASSES[selectedProgram?.level] || 'text-bg-light text-dark border'}">
                ${escapeHtml(selectedProgram?.level || 'Level')}
              </span>
              <span class="badge text-bg-light text-dark border">
                ${escapeHtml(selectedProgram?.subject || 'Môn học')}
              </span>
              <span class="badge text-bg-light text-dark border">
                ${Number(selectedProgram?.totalSessionCount || 0)} buổi
              </span>
              <span class="badge text-bg-warning-subtle text-dark border">Sửa mẫu chung</span>
              ${
                selectedProgram
                  ? `
                    <button
                      type="button"
                      class="btn btn-primary btn-sm"
                      data-action="add-program-session"
                      data-program-id="${escapeHtml(selectedProgram.id)}"
                      ${busyKey === 'add-program-session' ? 'disabled' : ''}
                    >
                      ${
                        busyKey === 'add-program-session'
                          ? '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Đang thêm...'
                          : '<i class="bi bi-plus-lg me-1"></i>Thêm buổi'
                      }
                    </button>
                  `
                  : ''
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderContentWorkspaceTabs(activeTab = 'lessons', archivedCount = 0) {
  const normalizedTab = activeTab === 'archived' ? 'archived' : 'lessons';

  return `
    <div class="curriculum-content-tabs">
      <button
        type="button"
        class="curriculum-content-tab ${normalizedTab === 'lessons' ? 'curriculum-content-tab--active' : ''}"
        data-action="switch-editor-tab"
        data-tab="lessons"
      >
        <i class="bi bi-pencil-square me-2"></i>Bài đang soạn
      </button>
      <button
        type="button"
        class="curriculum-content-tab ${normalizedTab === 'archived' ? 'curriculum-content-tab--active' : ''}"
        data-action="switch-editor-tab"
        data-tab="archived"
      >
        <i class="bi bi-archive me-2"></i>Kho lưu trữ
        <span class="badge text-bg-light text-dark border ms-2">${Number(archivedCount || 0)}</span>
      </button>
    </div>
  `;
}

function renderSessionPickerStrip(program, selectedSessionNumber, quizUiEnabled = false) {
  if (!program) {
    return '';
  }

  const activeLessons = getActiveCurriculumLessons(program);

  return `
    <div class="curriculum-session-strip">
      ${getCurriculumSessionActivities(program)
        .map((session) => {
          const sessionNumber = Number(session.sessionNumber || 0);
          const isSelected = sessionNumber === Number(selectedSessionNumber || 0);
          const isQuiz = quizUiEnabled && isCurriculumQuizActivity(session.activityType);
          const lesson = activeLessons.find((item) => Number(item.sessionNumber || 0) === sessionNumber) || null;
          const activityLabel = quizUiEnabled
            ? getCurriculumActivityTypeLabel(session.activityType)
            : 'Học kiến thức';

          return `
            <button
              type="button"
              class="curriculum-session-strip__item ${isSelected ? 'curriculum-session-strip__item--active' : ''}"
              data-action="select-curriculum-session"
              data-session-number="${sessionNumber}"
            >
              <span class="d-flex justify-content-between gap-2 align-items-start">
                <span class="fw-semibold">Buổi ${sessionNumber}</span>
              </span>
              <span class="small">
                <i class="bi bi-${isQuiz ? 'patch-question' : 'journal-richtext'} me-1"></i>${escapeHtml(activityLabel)}
              </span>
              <span class="curriculum-session-strip__title">${escapeHtml(lesson?.title || 'Chưa có nội dung')}</span>
            </button>
          `;
        })
        .join('')}
    </div>
  `;
}

export function renderContentWorkspaceHorizontal({
  programGroups,
  selectedProgramId,
  selectedSessionNumber,
  busyKey,
  editorTab = 'lessons',
  selectedClassCode = '',
  quizUiEnabled = false,
}) {
  const selectedProgram = programGroups.flatMap((group) => group.programs).find((program) => program.id === selectedProgramId) || null;
  const selectedActivity = selectedProgram ? getCurriculumSessionActivity(selectedProgram, selectedSessionNumber) : null;
  const isQuizSession = quizUiEnabled && isCurriculumQuizActivity(selectedActivity?.activityType);
  const lesson = selectedProgram ? getLessonDraftForSession(selectedProgram, selectedSessionNumber) : null;
  const selectedProgramSessionCount = Math.max(
    1,
    Number(selectedProgram?.totalSessionCount || selectedProgram?.knowledgePhaseEndSession || 1),
  );
  const isTrailingEmptySession =
    selectedProgramSessionCount > 1 && !lesson?.id && Number(selectedSessionNumber || 0) >= selectedProgramSessionCount;
  const archivedCount = selectedProgram ? getArchivedCurriculumLessons(selectedProgram).length : 0;
  const activeContentTab = editorTab === 'archived' ? 'archived' : 'lessons';
  const previewPath = selectedProgram
    ? (
        isQuizSession
          ? buildAdminQuizPreviewPath(selectedProgram.id, selectedSessionNumber, { classCode: selectedClassCode })
          : buildAdminLessonPreviewPath(selectedProgram.id, selectedSessionNumber)
      )
    : '';

  return `
    <section class="curriculum-workspace curriculum-workspace--editor curriculum-workspace--compact">
      <div class="curriculum-workspace__head curriculum-workspace__head--compact">
        <div class="curriculum-workspace__eyebrow">Soạn nội dung</div>
        <h2 class="h5 mb-1">Soạn theo chương trình và buổi</h2>
      </div>
      <div class="curriculum-workspace__body">
        <div class="d-grid gap-3">
          ${renderProgramPickerBar(programGroups, selectedProgramId, busyKey)}
          ${
            selectedProgram
              ? `
                ${renderContentWorkspaceTabs(activeContentTab, archivedCount)}
                ${
                  activeContentTab === 'archived'
                    ? renderArchivedLessonVault(selectedProgram, busyKey)
                    : `
                      ${renderSessionPickerStrip(selectedProgram, selectedSessionNumber, quizUiEnabled)}
                      <div class="card border-0 shadow-sm">
                        <div class="card-header bg-white border-0">
                          <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
                            <div>
                              <div class="text-uppercase small fw-bold text-secondary mb-1">Buổi ${Number(selectedSessionNumber || 0)}</div>
                              <h3 class="h5 mb-1">${isQuizSession ? 'Bộ đề kiểm tra' : 'Bài giảng và bài tập'}</h3>
                              <p class="text-secondary mb-0">
                                ${
                                  isQuizSession
                                    ? 'Soạn ngân hàng câu hỏi cho buổi kiểm tra này.'
                                    : 'Soạn bài giảng và bài tập cho học sinh xem trong học liệu.'
                                }
                              </p>
                            </div>
                            <div class="d-flex flex-wrap gap-2 align-items-end">
                              ${renderSessionActivityInlineForm(selectedProgram, selectedSessionNumber, busyKey, quizUiEnabled)}
                              ${
                                previewPath
                                  ? `
                                    <a class="btn btn-outline-secondary" href="${escapeHtml(previewPath)}" target="_blank" rel="noreferrer">
                                      <i class="bi bi-eye me-2"></i>${isQuizSession ? 'Xem như học sinh' : 'Xem thử'}
                                    </a>
                                  `
                                  : ''
                              }
                              ${
                                !isQuizSession && lesson?.id
                                  ? `
                                    <button
                                      type="button"
                                      class="btn btn-outline-warning"
                                      data-action="archive-lesson"
                                      data-lesson-id="${escapeHtml(lesson.id)}"
                                      ${busyKey === 'archive-lesson' ? 'disabled' : ''}
                                    >
                                      ${
                                        busyKey === 'archive-lesson'
                                          ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang lưu kho...'
                                          : '<i class="bi bi-archive me-2"></i>Lưu kho buổi này'
                                      }
                                    </button>
                                  `
                                  : ''
                              }
                              ${
                                !isQuizSession && !lesson?.id
                                  ? `
                                    <button
                                      type="button"
                                      class="btn btn-outline-warning"
                                      data-action="archive-empty-session"
                                      data-session-number="${Number(selectedSessionNumber || 0)}"
                                      ${busyKey === 'archive-empty-session' ? 'disabled' : ''}
                                    >
                                      ${
                                        busyKey === 'archive-empty-session'
                                          ? `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${isTrailingEmptySession ? 'Đang xóa...' : 'Đang lưu kho...'}`
                                          : `<i class="bi ${isTrailingEmptySession ? 'bi-trash' : 'bi-archive'} me-2"></i>${isTrailingEmptySession ? 'Xóa buổi trống' : 'Lưu kho buổi trống'}`
                                      }
                                    </button>
                                  `
                                  : ''
                              }
                            </div>
                          </div>
                        </div>
                        <div class="card-body">
                          ${
                            isQuizSession
                              ? renderQuizManagementContent({
                                  hideTabs: true,
                                  mode: 'editor',
                                  enableOperations: false,
                                })
                              : renderLessonFormV3(selectedProgram, lesson, busyKey, isCloudinaryConfigured())
                          }
                        </div>
                      </div>
                    `
                }
              `
              : renderEmptyState({
                  icon: 'journal-richtext',
                  title: 'Chưa chọn chương trình',
                  description: 'Chọn một chương trình để bắt đầu soạn nội dung.',
                })
          }
        </div>
      </div>
    </section>
  `;
}

export function renderQuizOperationsWorkspace() {
  return `
    <section class="curriculum-workspace curriculum-workspace--editor curriculum-workspace--compact">
      <div class="curriculum-workspace__head curriculum-workspace__head--compact">
        <div class="curriculum-workspace__eyebrow">Trung tâm điều khiển</div>
        <h2 class="h5 mb-1">Kết quả bài kiểm tra</h2>
      </div>
      <div class="curriculum-workspace__body">
        <div class="d-grid gap-3">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              ${renderQuizManagementContent({
                hideTabs: true,
                mode: 'operations',
                showLaunchControl: false,
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}
