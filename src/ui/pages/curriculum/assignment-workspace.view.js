import { getSuggestedCurriculumAssignment } from '../../../services/curriculum.service.js';
import {
  isCurriculumExerciseVisibleForSession,
  normalizeCurriculumExerciseVisibleSessions,
} from '../../../utils/curriculum.js';
import {
  getActiveCurriculumLessons,
  getCurriculumActivityTypeLabel,
  getCurriculumSessionActivity,
  isCurriculumQuizActivity,
} from '../../../utils/curriculum-program.js';
import { escapeHtml } from '../../../utils/html.js';
import {
  getLessonMarkdownSource,
  LESSON_MARKDOWN_TAB_EXERCISE,
  LESSON_MARKDOWN_TAB_LECTURE,
} from '../../../utils/lesson-markdown.js';
import { buildPublicLibraryPath } from '../../../utils/route.js';
import {
  isQuizStartedForClass,
  QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS,
} from '../../../utils/quiz.js';
import { renderEmptyState } from '../../components/EmptyState.js';

const PHASE_LABELS = {
  learning: 'Học kiến thức',
  final: 'Giai đoạn cuối khóa',
};

export function getInitialDraft(classItem, programs) {
  return getSuggestedCurriculumAssignment(classItem, programs);
}

export function hasSavedCurriculumAssignment(classItem) {
  return Boolean(classItem?.curriculumProgramId);
}

export function isDraftDifferentFromSaved(classItem, assignment) {
  if (!classItem || !assignment) {
    return false;
  }

  if (!hasSavedCurriculumAssignment(classItem)) {
    return true;
  }

  const savedExerciseSessions = normalizeCurriculumExerciseVisibleSessions(classItem.curriculumExerciseVisibleSessions);
  const draftExerciseSessions = normalizeCurriculumExerciseVisibleSessions(assignment.exerciseVisibleSessions);

  return (
    classItem.curriculumProgramId !== assignment.programId ||
    Number(classItem.curriculumCurrentSession || 1) !== Number(assignment.currentSession || 1) ||
    (classItem.curriculumPhase === 'final' ? 'final' : 'learning') !== assignment.curriculumPhase ||
    savedExerciseSessions.join(',') !== draftExerciseSessions.join(',')
  );
}

function isOfficialQuizAssignmentSession(sessionNumber) {
  return QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS.includes(Number(sessionNumber || 0));
}

export function getAssignmentQuizControlState(classItem, assignment, program) {
  const sessionNumber = Number(assignment?.currentSession || 0);
  const sessionActivity = program ? getCurriculumSessionActivity(program, sessionNumber) : null;
  const isOfficialSession = isOfficialQuizAssignmentSession(sessionNumber);
  const isQuizActivity = isCurriculumQuizActivity(sessionActivity?.activityType);
  const isStarted =
    Boolean(classItem) &&
    Number(classItem.activeQuizSessionNumber || 0) === sessionNumber &&
    isQuizStartedForClass(classItem, sessionNumber);

  return {
    sessionNumber,
    sessionActivity,
    isOfficialSession,
    isQuizActivity,
    isStarted,
  };
}

function renderAssignmentQuizControl(classItem, assignment, program, { isDirty = false, isBusy = false } = {}) {
  const quizState = getAssignmentQuizControlState(classItem, assignment, program);

  if (!quizState.isOfficialSession || !program || !classItem) {
    return '';
  }

  const buttonLabel = quizState.isStarted
    ? 'Kết thúc bài kiểm tra'
    : isDirty
      ? 'Lưu và mở bài kiểm tra'
      : 'Mở bài kiểm tra';
  const buttonIcon = quizState.isStarted ? 'stop-circle' : 'play-circle';
  const buttonClass = quizState.isStarted ? 'btn-outline-danger' : 'btn-primary';
  const statusLabel = quizState.isStarted ? 'Đang mở cho học sinh' : 'Chưa mở cho học sinh';
  const statusClass = quizState.isStarted
    ? 'text-bg-success-subtle text-success-emphasis border'
    : 'text-bg-light text-dark border';
  const activityLabel = getCurriculumActivityTypeLabel(quizState.sessionActivity?.activityType);

  return `
    <div class="curriculum-compact-note curriculum-assignment-quiz mt-3">
      <div class="d-flex flex-wrap justify-content-between gap-2 align-items-start mb-2">
        <div>
          <div class="fw-semibold">Bài kiểm tra buổi ${quizState.sessionNumber}</div>
        </div>
        <span class="badge ${statusClass}">${escapeHtml(statusLabel)}</span>
      </div>
      ${
        quizState.isQuizActivity
          ? `
            <button
              type="button"
              class="btn ${buttonClass} w-100"
              data-action="toggle-assignment-quiz"
              data-quiz-command="${quizState.isStarted ? 'stop' : 'start'}"
              ${isBusy ? 'disabled' : ''}
            >
              ${
                isBusy
                  ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang cập nhật...'
                  : `<i class="bi bi-${buttonIcon} me-2"></i>${escapeHtml(buttonLabel)}`
              }
            </button>
          `
          : `
            ${renderEmptyState({
              icon: 'patch-question',
              title: 'Buổi này chưa đặt là Kiểm tra',
              description: `Hiện đang là ${activityLabel}. Hãy đổi loại buổi trong tab Nội dung theo buổi trước khi mở đề.`,
            })}
          `
      }
    </div>
  `;
}

function renderCompactAssignmentControls(classes, programs, selectedClassCode, classItem, assignment, busyKey = '') {
  const isSaving = busyKey === 'save-assignment';
  const isTogglingQuiz = busyKey === 'toggle-class-quiz';
  const selectedProgramId = assignment?.programId || '';
  const selectedProgram = programs.find((program) => program.id === selectedProgramId) || null;
  const maxSession = selectedProgram?.totalSessionCount || 1;
  const currentSession = assignment?.currentSession || 1;
  const currentPhase = assignment?.curriculumPhase || 'learning';
  const currentLesson =
    getActiveCurriculumLessons(selectedProgram).find((lesson) => Number(lesson.sessionNumber || 0) === currentSession) ||
    null;
  const hasExerciseContent = Boolean(
    currentLesson && getLessonMarkdownSource(currentLesson, LESSON_MARKDOWN_TAB_EXERCISE),
  );
  const exerciseVisible = isCurriculumExerciseVisibleForSession(assignment, currentSession);
  const libraryPath = selectedClassCode
    ? buildPublicLibraryPath(selectedClassCode, {
        lessonId: currentLesson?.id || '',
        tab: exerciseVisible && hasExerciseContent ? LESSON_MARKDOWN_TAB_EXERCISE : LESSON_MARKDOWN_TAB_LECTURE,
      })
    : '';
  const hasSavedConfig = hasSavedCurriculumAssignment(classItem);
  const isDirty = isDraftDifferentFromSaved(classItem, assignment);
  const statusLabel = !hasSavedConfig ? 'Chưa lưu' : isDirty ? 'Có thay đổi' : 'Đã lưu';
  const statusClass = hasSavedConfig && !isDirty
    ? 'text-bg-success-subtle text-success-emphasis border'
    : 'text-bg-light text-dark border';
  const finalModeNote =
    currentPhase === 'final' && selectedProgram?.finalMode === 'exam'
      ? 'Lớp này đang ở pha kiểm tra cuối khóa nên trang học sinh sẽ không hiện form báo cáo sản phẩm.'
      : '';
  const contextualNote = isDirty
    ? `Bạn đang có thay đổi chưa lưu.${finalModeNote ? ` ${finalModeNote}` : ''}`
    : finalModeNote;

  return `
    <div class="card border-0 shadow-sm h-100 curriculum-admin-card curriculum-admin-card--compact">
      <div class="card-header bg-white border-0 d-flex justify-content-between gap-2 align-items-center">
        <h2 class="h6 mb-0">Thiết lập cho lớp</h2>
        <span class="badge ${statusClass}">${escapeHtml(statusLabel)}</span>
      </div>
      <div class="card-body">
        <div class="row g-2">
          <div class="col-12">
            <label class="form-label">Lớp</label>
            <select class="form-select" name="previewClassCode">
              ${classes
                .map(
                  (item) => `
                    <option value="${escapeHtml(item.classCode)}" ${item.classCode === selectedClassCode ? 'selected' : ''}>
                      ${escapeHtml(item.classCode)} - ${escapeHtml(item.className)}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </div>
          <div class="col-12">
            <label class="form-label">Chương trình</label>
            <select class="form-select" name="previewProgramId">
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
          <div class="col-12 col-md-6">
            <label class="form-label">Buổi hiện tại</label>
            <select class="form-select" name="previewCurrentSession">
              ${Array.from({ length: maxSession }, (_, index) => index + 1)
                .map(
                  (sessionNumber) => `
                    <option value="${sessionNumber}" ${sessionNumber === currentSession ? 'selected' : ''}>
                      Buổi ${sessionNumber}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label">Giai đoạn</label>
            <select class="form-select" name="previewPhase">
              <option value="learning" ${currentPhase === 'learning' ? 'selected' : ''}>Học kiến thức</option>
              <option value="final" ${currentPhase === 'final' ? 'selected' : ''}>Giai đoạn cuối khóa</option>
            </select>
          </div>
        </div>
        <div class="curriculum-compact-note mt-3">
          <div class="d-flex flex-wrap justify-content-between gap-2 align-items-center">
            <div>
              <div class="fw-semibold">Bài tập buổi ${currentSession}</div>
              <div class="small text-secondary">
                ${hasExerciseContent ? 'Bật để học sinh lớp này thấy tab Bài tập.' : 'Buổi này chưa có nội dung Bài tập trong kho học liệu.'}
              </div>
            </div>
            <div class="form-check form-switch mb-0">
              <input
                class="form-check-input"
                type="checkbox"
                role="switch"
                id="assignment-exercise-visible"
                name="previewExerciseVisible"
                ${exerciseVisible && hasExerciseContent ? 'checked' : ''}
                ${hasExerciseContent ? '' : 'disabled'}
              >
              <label class="form-check-label" for="assignment-exercise-visible">
                ${exerciseVisible && hasExerciseContent ? 'Đang hiện' : 'Đang ẩn'}
              </label>
            </div>
          </div>
        </div>
        ${renderAssignmentQuizControl(classItem, assignment, selectedProgram, {
          isDirty,
          isBusy: isTogglingQuiz,
        })}
        <div class="curriculum-assignment-actions ${libraryPath ? '' : 'curriculum-assignment-actions--single'} mt-3">
          <button
            type="button"
            class="btn btn-primary"
            data-action="save-assignment"
            ${isSaving ? 'disabled' : ''}
          >
            ${
              isSaving
                ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang lưu...'
                : '<i class="bi bi-save me-2"></i>Lưu cấu hình lớp'
            }
          </button>
          ${
            libraryPath
              ? `
                <a class="btn btn-outline-secondary" href="${escapeHtml(libraryPath)}" target="_blank" rel="noreferrer">
                  <i class="bi bi-journal-richtext me-2"></i>Xem học liệu của lớp
                </a>
              `
              : ''
          }
        </div>
        ${contextualNote ? `<div class="curriculum-compact-note mt-3">${escapeHtml(contextualNote)}</div>` : ''}
      </div>
    </div>
  `;
}

function renderAssignmentStatusBoard(classes, programs, draftsByClassCode, selectedClassCode) {
  const cards = classes.map((classItem) => {
    const draft = draftsByClassCode[classItem.classCode] || getInitialDraft(classItem, programs);
    const program = programs.find((item) => item.id === draft?.programId) || null;
    const isSelected = classItem.classCode === selectedClassCode;
    const isDirty = isDraftDifferentFromSaved(classItem, draft);

    return `
      <article class="curriculum-class-card ${isSelected ? 'curriculum-class-card--active' : ''}">
        <div class="curriculum-class-card__top">
          <button
            type="button"
            class="btn btn-link p-0 fw-semibold text-start curriculum-class-card__code"
            data-action="select-assignment-class"
            data-class-code="${escapeHtml(classItem.classCode)}"
          >
            ${escapeHtml(classItem.classCode)}
          </button>
          <span class="badge ${isDirty ? 'text-bg-warning text-dark' : 'text-bg-success'}">
            ${isDirty ? 'Chưa lưu' : 'Đã lưu'}
          </span>
        </div>
        <div class="small text-secondary">${escapeHtml(classItem.className || '')}</div>
        <div class="curriculum-class-card__program">${escapeHtml(program?.name || 'Chưa gán chương trình')}</div>
        <div class="curriculum-class-card__meta">
          <span><i class="bi bi-calendar2-week me-1"></i>Buổi ${Number(draft?.currentSession || 1)}</span>
          <span><i class="bi bi-flag me-1"></i>${escapeHtml(PHASE_LABELS[draft?.curriculumPhase] || 'Học kiến thức')}</span>
        </div>
      </article>
    `;
  });

  return `
    <div class="card border-0 shadow-sm h-100 curriculum-admin-card curriculum-admin-card--compact">
      <div class="card-header bg-white border-0">
        <div class="d-flex flex-wrap justify-content-between gap-2 align-items-center">
          <div>
            <h2 class="h6 mb-1">Danh sách lớp đang dùng học liệu</h2>
            <div class="small text-secondary">Bấm vào một card để chỉnh nhanh cấu hình lớp đó.</div>
          </div>
          <span class="badge text-bg-light text-dark border">${classes.length} lớp</span>
        </div>
      </div>
      <div class="card-body">
        <div class="curriculum-class-card-grid">
          ${cards.join('')}
        </div>
      </div>
    </div>
  `;
}

export function renderAssignmentWorkspaceSimple(classes, programs, selectedClassCode, selectedClass, assignment, state) {
  return `
    <section class="curriculum-workspace curriculum-workspace--assignment curriculum-workspace--compact">
      <div class="curriculum-workspace__head curriculum-workspace__head--compact">
        <div class="curriculum-workspace__eyebrow">Gán cho lớp</div>
        <h2 class="h5 mb-1">Chỉ chọn lớp, chương trình và buổi hiện tại</h2>
      </div>
      <div class="curriculum-workspace__body">
        <div class="row g-3">
          <div class="col-12 col-xl-4">
            ${renderCompactAssignmentControls(
              classes,
              programs,
              selectedClassCode,
              selectedClass,
              assignment,
              state.busyKey,
            )}
          </div>
          <div class="col-12 col-xl-8">
            ${renderAssignmentStatusBoard(classes, programs, state.draftsByClassCode, selectedClassCode)}
          </div>
        </div>
      </div>
    </section>
  `;
}
