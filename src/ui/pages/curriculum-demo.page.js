import {
  getClassCurriculumView,
  getCurriculumProgram,
  getCurriculumProgramGroups,
  getSuggestedCurriculumAssignment,
  archiveEmptyCurriculumSession,
  deleteArchivedCurriculumLesson,
  saveClassCurriculumAssignment,
  saveCurriculumExamChecklistItem,
  saveCurriculumLesson,
  saveCurriculumProjectStages,
  saveCurriculumSessionActivity,
  setCurriculumProgramSessionCount,
  setCurriculumExamChecklistItemArchived,
  setCurriculumLessonArchived,
  subscribeCurriculumPrograms,
} from '../../services/curriculum.service.js';
import { isCloudinaryConfigured, uploadCurriculumLessonImage } from '../../services/cloudinary.service.js';
import { subscribeClasses } from '../../services/classes.service.js';
import { getAuthState } from '../../state/auth.store.js';
import { mapFirebaseError } from '../../utils/firebase-error.js';
import { escapeHtml } from '../../utils/html.js';
import {
  clampCurriculumSession,
  isCurriculumExerciseVisibleForSession,
  normalizeCurriculumExerciseVisibleSessions,
  setCurriculumExerciseVisibleForSession,
} from '../../utils/curriculum.js';
import {
  buildAdminLessonPreviewPath,
  buildAdminQuizPreviewPath,
  buildPublicLibraryPath,
  getHashRouteState,
} from '../../utils/route.js';
import {
  getLessonMarkdownSource,
  LESSON_MARKDOWN_TAB_EXERCISE,
  LESSON_MARKDOWN_TAB_LECTURE,
  normalizeLessonMarkdownTab,
  renderLessonMarkdownHtml,
} from '../../utils/lesson-markdown.js';
import {
  CURRICULUM_ACTIVITY_TYPES,
  buildCurriculumVisibleLessons,
  getCurriculumActivityTypeLabel,
  getCurriculumSessionActivities,
  getCurriculumSessionActivity,
  isCurriculumQuizActivity,
  createCurriculumItemId,
  getActiveCurriculumChecklist,
  getActiveCurriculumLessons,
  getArchivedCurriculumChecklist,
  getArchivedCurriculumLessons,
} from '../../utils/curriculum-program.js';
import { mountQuizManagement, renderQuizManagementContent } from './quizzes.page.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderStudentLibraryBrowser } from '../components/StudentLibraryBrowser.js';
import { confirmDialog } from '../components/ConfirmDialog.js';
import { showToast } from '../components/ToastStack.js';

const FINAL_MODE_LABELS = {
  project: 'Sản phẩm cuối khóa',
  exam: 'Kiểm tra cuối khóa',
};

const PHASE_LABELS = {
  learning: 'Học kiến thức',
  final: 'Giai đoạn cuối khóa',
};

const LEVEL_BADGE_CLASSES = {
  Basic: 'text-bg-light text-dark border',
  Advanced: 'text-bg-primary',
  Intensive: 'text-bg-warning text-dark',
};

const FINAL_MODE_BADGE_CLASSES = {
  project: 'text-bg-success',
  exam: 'text-bg-info',
};

const QUIZ_UI_ENABLED = false;

function getOperationalClasses(classes) {
  return classes.filter((item) => item.status === 'active' && !item.hidden);
}

function splitLines(value) {
  return String(value ?? '')
    .split(/\r?\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinLines(values = []) {
  return Array.isArray(values) ? values.join('\n') : '';
}

function getInitialDraft(classItem, programs) {
  return getSuggestedCurriculumAssignment(classItem, programs);
}

function hasSavedCurriculumAssignment(classItem) {
  return Boolean(classItem?.curriculumProgramId);
}

function isDraftDifferentFromSaved(classItem, assignment) {
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

function applyAssignmentExerciseVisibility(lessons = [], assignment = null) {
  const visibleSessions = new Set(normalizeCurriculumExerciseVisibleSessions(assignment?.exerciseVisibleSessions));

  return lessons.map((lesson) => ({
    ...lesson,
    exerciseVisible: visibleSessions.has(Number(lesson.sessionNumber || 0)),
  }));
}

function buildPreviewView(classItem, assignment, program) {
  if (!classItem || !assignment || !program) {
    return null;
  }

  const lessons = applyAssignmentExerciseVisibility(getActiveCurriculumLessons(program), assignment);
  const checklistItems = getActiveCurriculumChecklist(program);
  const visibleLessons = buildCurriculumVisibleLessons(program, lessons, assignment);

  return {
    classInfo: classItem,
    assignment,
    program: {
      ...program,
      lessons,
      finalChecklist: checklistItems,
    },
    lessons,
    visibleLessons,
    checklistItems,
  };
}

function normalizePreviewTab(value) {
  return normalizeLessonMarkdownTab(value);
}

function getDefaultPreviewLessonId(preview, preferredLessonId = '') {
  const lessons = preview?.visibleLessons || [];

  if (preferredLessonId && lessons.some((lesson) => lesson.id === preferredLessonId)) {
    return preferredLessonId;
  }

  return (
    lessons.find((lesson) => lesson.sessionNumber === preview?.assignment?.currentSession)?.id ||
    lessons[lessons.length - 1]?.id ||
    ''
  );
}

function getSuggestedLessonSession(program) {
  const maxSession = Math.max(1, Number(program?.totalSessionCount || program?.knowledgePhaseEndSession || 1));
  const activeSessions = new Set(getActiveCurriculumLessons(program).map((lesson) => lesson.sessionNumber));

  for (let sessionNumber = 1; sessionNumber <= maxSession; sessionNumber += 1) {
    if (!activeSessions.has(sessionNumber)) {
      return sessionNumber;
    }
  }

  return maxSession;
}

function getLessonSessionLimit(program) {
  return Math.max(1, Number(program?.totalSessionCount || program?.knowledgePhaseEndSession || 1));
}

function getNewLessonDraft(program) {
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

function getNewExamChecklistDraft(program) {
  const nextOrder =
    getActiveCurriculumChecklist(program).reduce((highest, item) => Math.max(highest, item.order), 0) + 1;

  return {
    id: '',
    order: nextOrder,
    title: '',
    description: '',
  };
}

function renderProgramList(programGroups, selectedProgramId) {
  return programGroups
    .map(
      ({ subject, programs }) => `
        <div class="curriculum-program-group">
          <div class="curriculum-program-group__head">
            <div>
              <div class="fw-semibold">${escapeHtml(subject)}</div>
              <div class="small text-secondary">${programs.length} lộ trình</div>
            </div>
          </div>
          <div class="curriculum-program-group__chips">
            ${programs
              .map((program) => {
                const isActive = program.id === selectedProgramId;

                return `
                  <button
                    type="button"
                    class="curriculum-program-button ${isActive ? 'curriculum-program-button--active' : ''}"
                    data-action="select-program"
                    data-program-id="${escapeHtml(program.id)}"
                  >
                    <div class="d-flex align-items-center justify-content-between gap-2">
                      <span class="fw-semibold">${escapeHtml(program.level)}</span>
                      <span class="badge ${LEVEL_BADGE_CLASSES[program.level] || 'text-bg-light text-dark border'}">
                        ${escapeHtml(program.level)}
                      </span>
                    </div>
                    <div class="small text-secondary mt-2">
                      KT buổi ${program.knowledgePhaseEndSession} · Tổng ${program.totalSessionCount}
                    </div>
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>
      `,
    )
    .join('');
}

function renderProgramListCompact(programGroups, selectedProgramId) {
  return programGroups
    .map(
      ({ subject, programs }) => `
        <div class="curriculum-program-group curriculum-program-group--compact">
          <div class="curriculum-program-group__head curriculum-program-group__head--compact">
            <div>
              <div class="fw-semibold">${escapeHtml(subject)}</div>
              <div class="small text-secondary">${programs.length} lộ trình</div>
            </div>
          </div>
          <div class="curriculum-program-group__chips curriculum-program-group__chips--compact">
            ${programs
              .map((program) => {
                const isActive = program.id === selectedProgramId;

                return `
                  <button
                    type="button"
                    class="curriculum-program-button curriculum-program-button--compact ${isActive ? 'curriculum-program-button--active' : ''}"
                    data-action="select-program"
                    data-program-id="${escapeHtml(program.id)}"
                  >
                    <div class="curriculum-program-button__title">${escapeHtml(program.level)}</div>
                    <div class="curriculum-program-button__meta">
                      KT buổi ${program.knowledgePhaseEndSession} · Tổng ${program.totalSessionCount}
                    </div>
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>
      `,
    )
    .join('');
}

function renderAssignmentControls(classes, programs, selectedClassCode, classItem, assignment, isSaving = false) {
  const selectedProgramId = assignment?.programId || '';
  const selectedProgram = programs.find((program) => program.id === selectedProgramId) || null;
  const maxSession = selectedProgram?.totalSessionCount || 1;
  const hasSavedConfig = hasSavedCurriculumAssignment(classItem);
  const isDirty = isDraftDifferentFromSaved(classItem, assignment);
  const saveNote = !hasSavedConfig
    ? 'Lớp này chưa có học liệu thật. Bản preview bên phải mới chỉ là gợi ý, bạn cần bấm "Lưu cấu hình lớp" để trang học sinh dùng được.'
    : isDirty
      ? 'Bạn đang xem bản nháp mới. Hãy bấm "Lưu cấu hình lớp" để trang học sinh cập nhật theo cấu hình này.'
      : 'Cấu hình hiện tại đã được lưu vào Firestore và trang học sinh sẽ đọc đúng theo dữ liệu này.';
  const finalModeNote =
    assignment?.curriculumPhase === 'final' && selectedProgram?.finalMode === 'exam'
      ? 'Lưu ý: chương trình này kết thúc bằng kiểm tra, nên ở trang học sinh sẽ không hiển thị form báo cáo sản phẩm.'
      : '';

  return `
    <div class="card border-0 shadow-sm h-100">
      <div class="card-header bg-white border-0">
        <h2 class="h6 mb-0">Gán học liệu cho lớp</h2>
      </div>
      <div class="card-body">
        <div class="row g-3">
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
                    <option value="${sessionNumber}" ${sessionNumber === assignment.currentSession ? 'selected' : ''}>
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
              <option value="learning" ${assignment.curriculumPhase === 'learning' ? 'selected' : ''}>Học kiến thức</option>
              <option value="final" ${assignment.curriculumPhase === 'final' ? 'selected' : ''}>Giai đoạn cuối khóa</option>
            </select>
          </div>
        </div>
        <div class="curriculum-preview-note mt-3">
          Hệ thống đang tự gợi ý chương trình dựa trên tên lớp và mã lớp. Bạn vẫn có thể chỉnh tay rồi lưu lại để dùng lâu dài.
        </div>
        <div class="mt-3">
          ${
            hasSavedConfig
              ? '<span class="badge text-bg-success-subtle text-success-emphasis border">Đã có cấu hình lưu</span>'
              : '<span class="badge text-bg-warning-subtle text-warning-emphasis border">Chưa lưu cấu hình</span>'
          }
          ${isDirty ? '<span class="badge text-bg-info-subtle text-info-emphasis border ms-2">Đang có thay đổi chưa lưu</span>' : ''}
        </div>
        <div class="curriculum-preview-note mt-3">${escapeHtml(saveNote)}</div>
        ${finalModeNote ? `<div class="curriculum-preview-note mt-2">${escapeHtml(finalModeNote)}</div>` : ''}
      </div>
      <div class="card-footer bg-white border-0 pt-0">
        <button
          type="button"
          class="btn btn-primary w-100"
          data-action="save-assignment"
          ${isSaving ? 'disabled' : ''}
        >
          ${
            isSaving
              ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang lưu...'
              : '<i class="bi bi-save me-2"></i>Lưu cấu hình lớp'
          }
        </button>
      </div>
    </div>
  `;
}

function renderPreviewPanel(classItem, assignment, program, previewState = {}) {
  const preview = buildPreviewView(classItem, assignment, program);

  if (!preview) {
    return renderEmptyState({
      icon: 'journal-richtext',
      title: 'Chưa có dữ liệu để preview',
      description: 'Hãy chọn lớp và chương trình phù hợp để xem trước học sinh sẽ thấy gì ở trang báo cáo.',
    });
  }

  const activeLessonId = getDefaultPreviewLessonId(preview, previewState.lessonId);

  return renderStudentLibraryBrowser(preview, activeLessonId, previewState.imageSelections || {}, {
    activeTab: normalizePreviewTab(previewState.activeTab),
    embedded: true,
  });
}

function renderProgramOverview(program) {
  if (!program) {
    return renderEmptyState({
      icon: 'diagram-3',
      title: 'Chưa chọn chương trình',
      description: 'Hãy chọn một chương trình ở cột bên trái để bắt đầu chỉnh lesson hoặc quy trình cuối khóa.',
    });
  }

  return `
    <div class="card border-0 shadow-sm curriculum-overview-card">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start">
          <div>
            <div class="text-secondary small mb-1">Chương trình mẫu</div>
            <h2 class="h4 mb-2">${escapeHtml(program.name)}</h2>
            <p class="text-secondary mb-0">${escapeHtml(program.description)}</p>
          </div>
          <div class="d-flex flex-wrap gap-2">
            <span class="badge ${LEVEL_BADGE_CLASSES[program.level] || 'text-bg-light text-dark border'}">
              ${escapeHtml(program.level)}
            </span>
            <span class="badge ${FINAL_MODE_BADGE_CLASSES[program.finalMode] || 'text-bg-light text-dark border'}">
              ${escapeHtml(FINAL_MODE_LABELS[program.finalMode] || program.finalMode)}
            </span>
            <span class="badge text-bg-light text-dark border">
              Học kiến thức: buổi 1-${program.knowledgePhaseEndSession}
            </span>
            <span class="badge text-bg-light text-dark border">
              Tổng khóa: ${program.totalSessionCount} buổi
            </span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderProgramEditorTabs(program, activeTab) {
  const archivedCount =
    getArchivedCurriculumLessons(program).length + getArchivedCurriculumChecklist(program).length;

  return `
    <div class="curriculum-editor-tabs">
      <button
        type="button"
        class="curriculum-editor-tab ${activeTab === 'lessons' ? 'curriculum-editor-tab--active' : ''}"
        data-action="switch-editor-tab"
        data-tab="lessons"
      >
        Buổi học <span class="badge text-bg-light text-dark border ms-2">${getActiveCurriculumLessons(program).length}</span>
      </button>
      <button
        type="button"
        class="curriculum-editor-tab ${activeTab === 'final' ? 'curriculum-editor-tab--active' : ''}"
        data-action="switch-editor-tab"
        data-tab="final"
      >
        Cuối khóa
      </button>
      <button
        type="button"
        class="curriculum-editor-tab ${activeTab === 'archived' ? 'curriculum-editor-tab--active' : ''}"
        data-action="switch-editor-tab"
        data-tab="archived"
      >
        Đã lưu kho <span class="badge text-bg-light text-dark border ms-2">${archivedCount}</span>
      </button>
    </div>
  `;
}

function renderLessonList(program, selectedLessonId) {
  const lessons = getActiveCurriculumLessons(program);

  if (lessons.length === 0) {
    return `
      <div class="curriculum-editor-empty">
        Chương trình này chưa có buổi học nào. Hãy bấm <strong>Thêm buổi học</strong> để bắt đầu.
      </div>
    `;
  }

  return `
    <div class="curriculum-editor-list">
      ${lessons
        .map(
          (lesson) => `
            <button
              type="button"
              class="curriculum-editor-list__item ${lesson.id === selectedLessonId ? 'curriculum-editor-list__item--active' : ''}"
              data-action="select-lesson"
              data-lesson-id="${escapeHtml(lesson.id)}"
            >
              <div class="d-flex justify-content-between gap-2 align-items-center">
                <strong>Buổi ${lesson.sessionNumber}</strong>
                <span class="badge text-bg-light text-dark border">Đang dùng</span>
              </div>
              <div class="small text-secondary mt-2">${escapeHtml(lesson.title)}</div>
            </button>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderLessonCoverImagePreview(coverImage) {
  if (!coverImage?.secureUrl) {
    return `
      <div class="curriculum-image-upload__empty">
        Chưa có ảnh minh họa cho buổi học này.
      </div>
    `;
  }

  const alt = coverImage.alt || 'Ảnh minh họa bài học';

  return `
    <div class="curriculum-image-upload__preview-card">
      <img
        src="${escapeHtml(coverImage.secureUrl)}"
        alt="${escapeHtml(alt)}"
        class="curriculum-image-upload__preview-image"
        loading="lazy"
      >
    </div>
  `;
}

function renderLessonImageField(coverImage, cloudinaryReady) {
  const uploadDisabled = cloudinaryReady ? '' : 'disabled';

  return `
    <div class="col-12">
      <label class="form-label">Ảnh minh họa</label>
      <input type="hidden" name="coverImageSecureUrl" value="${escapeHtml(coverImage?.secureUrl || '')}">
      <input type="hidden" name="coverImagePublicId" value="${escapeHtml(coverImage?.publicId || '')}">
      <input type="hidden" name="coverImageWidth" value="${escapeHtml(String(coverImage?.width || ''))}">
      <input type="hidden" name="coverImageHeight" value="${escapeHtml(String(coverImage?.height || ''))}">
      <div class="curriculum-image-upload">
        <div id="curriculum-lesson-image-preview" class="curriculum-image-upload__preview">
          ${renderLessonCoverImagePreview(coverImage)}
        </div>
        <div class="curriculum-image-upload__actions">
          <input
            id="curriculum-lesson-cover-image"
            class="d-none"
            type="file"
            accept="image/*"
            name="coverImageFile"
          >
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            data-action="pick-lesson-image"
            ${uploadDisabled}
          >
            <i class="bi bi-image me-2"></i>${cloudinaryReady ? 'Tải ảnh lên' : 'Cloudinary chưa sẵn sàng'}
          </button>
          ${
            coverImage?.secureUrl
              ? `
                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm"
                  data-action="remove-lesson-image"
                >
                  <i class="bi bi-trash me-2"></i>X&oacute;a &#7843;nh</button>
              `
              : ''
          }
        </div>
        <div class="small text-secondary mt-2">
          ${cloudinaryReady ? 'Mỗi bài học hỗ trợ 1 ảnh minh họa.' : 'Thêm VITE_CLOUDINARY_CLOUD_NAME và VITE_CLOUDINARY_UPLOAD_PRESET để bật upload ảnh.'}
        </div>
      </div>
    </div>
    <div class="col-12">
      <label class="form-label">Mô tả ảnh</label>
      <input
        class="form-control"
        name="coverImageAlt"
        value="${escapeHtml(coverImage?.alt || '')}"
        placeholder="Ví dụ: Ảnh giao diện trang chủ mẫu"
      >
    </div>
  `;
}

function renderLessonFormV2(program, lessonDraft, busyKey, cloudinaryReady) {
  const isEditing = Boolean(lessonDraft?.id);
  const sessionNumber = Number(lessonDraft?.sessionNumber || 1);

  return `
    <form id="curriculum-lesson-form" class="curriculum-editor-form">
      <input type="hidden" name="lessonId" value="${escapeHtml(lessonDraft?.id || '')}">
      <div class="row g-3">
        <div class="col-12 col-md-4">
          <label class="form-label">Buổi</label>
          <select class="form-select" name="sessionNumber">
            ${Array.from({ length: Number(program.knowledgePhaseEndSession || 1) }, (_, index) => index + 1)
              .map(
                (value) => `
                  <option value="${value}" ${value === sessionNumber ? 'selected' : ''}>
                    Buổi ${value}
                  </option>
                `,
              )
              .join('')}
          </select>
        </div>
        <div class="col-12 col-md-8">
          <label class="form-label">Tiêu đề buổi học</label>
          <input class="form-control" name="title" value="${escapeHtml(lessonDraft?.title || '')}" placeholder="Ví dụ: Hoàn thiện bố cục trang chủ">
        </div>
        <div class="col-12">
          <label class="form-label">Tóm tắt</label>
          <textarea class="form-control" name="summary" rows="3" placeholder="Tóm tắt ngắn gọn nội dung chính của buổi học">${escapeHtml(lessonDraft?.summary || '')}</textarea>
        </div>
        ${renderLessonImageField(lessonDraft?.coverImage || null, cloudinaryReady)}
        <div class="col-12">
          <label class="form-label">Ý chính cần nhớ</label>
          <textarea class="form-control" name="keyPoints" rows="4" placeholder="Mỗi dòng là một ý chính">${escapeHtml(joinLines(lessonDraft?.keyPoints || []))}</textarea>
        </div>
        <div class="col-12">
          <label class="form-label">Nhiệm vụ gợi ý</label>
          <textarea class="form-control" name="practiceTask" rows="3" placeholder="Ví dụ: Làm xong giao diện, thêm hình ảnh và hoàn thiện nút đăng nhập">${escapeHtml(lessonDraft?.practiceTask || '')}</textarea>
        </div>
        <div class="col-12">
          <label class="form-label">Tài liệu đi kèm</label>
          <textarea class="form-control" name="reviewLinks" rows="3" placeholder="Mỗi dòng là một tài liệu hoặc nguồn ôn tập">${escapeHtml(joinLines(lessonDraft?.reviewLinks || []))}</textarea>
        </div>
        <div class="col-12">
          <label class="form-label">Ghi chú cho giáo viên</label>
          <textarea class="form-control" name="teacherNote" rows="3" placeholder="Các lưu ý riêng khi dạy buổi này">${escapeHtml(lessonDraft?.teacherNote || '')}</textarea>
        </div>
      </div>
      <div class="curriculum-editor-form__actions mt-4">
        <button type="submit" class="btn btn-primary" ${busyKey === 'save-lesson' ? 'disabled' : ''}>
          ${
            busyKey === 'save-lesson'
              ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang lưu...'
              : `<i class="bi bi-save me-2"></i>${isEditing ? 'Lưu buổi học' : 'Thêm buổi học'}`
          }
        </button>
        ${
          isEditing
            ? `
              <button
                type="button"
                class="btn btn-outline-warning"
                data-action="archive-lesson"
                data-lesson-id="${escapeHtml(lessonDraft.id)}"
                ${busyKey === 'archive-lesson' ? 'disabled' : ''}
              >
                <i class="bi bi-archive me-2"></i>Lưu kho
              </button>
            `
            : ''
        }
      </div>
    </form>
  `;
}

function renderLessonsTabV2(program, selectedLessonId, busyKey, cloudinaryReady) {
  const activeLessons = getActiveCurriculumLessons(program);
  const selectedLesson =
    selectedLessonId === 'new'
      ? getNewLessonDraft(program)
      : activeLessons.find((lesson) => lesson.id === selectedLessonId) || getNewLessonDraft(program);

  return `
    <div class="row g-4">
      <div class="col-12 col-xl-4">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white border-0 d-flex justify-content-between align-items-center gap-2">
            <div>
              <h3 class="h6 mb-0">Danh sách buổi học</h3>
              <div class="small text-secondary">${activeLessons.length} buổi đang hiển thị cho học sinh</div>
            </div>
            <button type="button" class="btn btn-sm btn-primary" data-action="create-lesson">
              <i class="bi bi-plus-lg me-1"></i>Thêm buổi
            </button>
          </div>
          <div class="card-body">
            ${renderLessonList(program, selectedLessonId)}
          </div>
        </div>
      </div>
      <div class="col-12 col-xl-8">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white border-0">
            <h3 class="h6 mb-0">${selectedLessonId === 'new' || !selectedLessonId ? 'Thêm buổi học mới' : 'Chỉnh sửa buổi học'}</h3>
          </div>
          <div class="card-body">
            ${renderLessonFormV2(program, selectedLesson, busyKey, cloudinaryReady)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function getLessonCoverImageFromFormData(formData) {
  const secureUrl = String(formData.get('coverImageSecureUrl') || '').trim();

  if (!secureUrl) {
    return null;
  }

  return {
    secureUrl,
    publicId: String(formData.get('coverImagePublicId') || '').trim(),
    width: Number(formData.get('coverImageWidth') || 0),
    height: Number(formData.get('coverImageHeight') || 0),
    alt: String(formData.get('coverImageAlt') || '').trim(),
  };
}

function setLessonImageFormState(form, coverImage = null) {
  if (!form) {
    return;
  }

  const previewElement = form.querySelector('#curriculum-lesson-image-preview');
  const actionsElement = form.querySelector('.curriculum-image-upload__actions');
  const secureUrlInput = form.querySelector('input[name="coverImageSecureUrl"]');
  const publicIdInput = form.querySelector('input[name="coverImagePublicId"]');
  const widthInput = form.querySelector('input[name="coverImageWidth"]');
  const heightInput = form.querySelector('input[name="coverImageHeight"]');
  const altInput = form.querySelector('input[name="coverImageAlt"]');
  const existingRemoveButton = actionsElement?.querySelector('[data-action="remove-lesson-image"]');

  if (secureUrlInput) {
    secureUrlInput.value = coverImage?.secureUrl || '';
  }

  if (publicIdInput) {
    publicIdInput.value = coverImage?.publicId || '';
  }

  if (widthInput) {
    widthInput.value = coverImage?.width ? String(coverImage.width) : '';
  }

  if (heightInput) {
    heightInput.value = coverImage?.height ? String(coverImage.height) : '';
  }

  if (altInput && !coverImage?.secureUrl) {
    altInput.value = '';
  }

  if (previewElement) {
    previewElement.innerHTML = renderLessonCoverImagePreview(coverImage);
  }

  if (!actionsElement) {
    return;
  }

  if (coverImage?.secureUrl) {
    if (!existingRemoveButton) {
      actionsElement.insertAdjacentHTML(
        'beforeend',
        `
          <button
            type="button"
            class="btn btn-outline-danger btn-sm"
            data-action="remove-lesson-image"
          >
            <i class="bi bi-trash me-2"></i>X&oacute;a &#7843;nh</button>
        `,
      );
    }

    return;
  }

  existingRemoveButton?.remove();
}

function getLessonImagesV3(lessonDraft) {
  if (Array.isArray(lessonDraft?.images) && lessonDraft.images.length > 0) {
    return [...lessonDraft.images].sort((left, right) => (left.order || 0) - (right.order || 0));
  }

  if (lessonDraft?.coverImage?.secureUrl) {
    return [{ ...lessonDraft.coverImage, id: lessonDraft.coverImage.id || `${lessonDraft.id || 'lesson'}-cover`, order: 1 }];
  }

  return [];
}

function getLessonBannerImageV3(lessonDraft) {
  if (lessonDraft?.bannerImage?.secureUrl) {
    return lessonDraft.bannerImage;
  }

  if (lessonDraft?.coverImage?.secureUrl) {
    return {
      ...lessonDraft.coverImage,
      id: lessonDraft.coverImage.id || `${lessonDraft.id || 'lesson'}-banner`,
      order: 1,
    };
  }

  const firstImage = getLessonImagesV3(lessonDraft)[0] || null;
  return firstImage ? { ...firstImage, id: firstImage.id || `${lessonDraft.id || 'lesson'}-banner` } : null;
}

function getLessonMarkdownDraftV3(lessonDraft, tab = LESSON_MARKDOWN_TAB_LECTURE) {
  return getLessonMarkdownSource(lessonDraft, tab);
}

function getLessonReviewLinksV3(lessonDraft) {
  if (!Array.isArray(lessonDraft?.reviewLinks)) {
    return [];
  }

  return lessonDraft.reviewLinks.map((item, index) =>
    typeof item === 'string'
      ? {
          id: createCurriculumItemId('review-link'),
          label: item,
          url: item,
          order: index + 1,
        }
      : {
          id: item.id || createCurriculumItemId('review-link'),
          label: item.label || item.url || '',
          url: item.url || '',
          order: item.order || index + 1,
        },
  );
}

function renderLessonImageItemsV3(images = []) {
  if (!Array.isArray(images) || images.length === 0) {
    return `
      <div class="curriculum-image-upload__empty">
        Chưa có ảnh minh họa cho bài học này.
      </div>
    `;
  }

  return `
    <div class="curriculum-image-manager">
      ${images
        .map(
          (image, index) => `
            <div
              class="curriculum-image-manager__item"
              draggable="true"
              data-image-id="${escapeHtml(image.id)}"
            >
              <div class="curriculum-image-manager__thumb-wrap">
                <img
                  src="${escapeHtml(image.secureUrl)}"
                  alt="${escapeHtml(image.alt || `Ảnh ${index + 1}`)}"
                  class="curriculum-image-manager__thumb"
                  loading="lazy"
                >
                ${index === 0 ? '<span class="badge text-bg-primary curriculum-image-manager__primary">Ảnh chính</span>' : ''}
              </div>
              <input
                type="text"
                class="form-control form-control-sm"
                data-role="lesson-image-alt"
                data-image-id="${escapeHtml(image.id)}"
                value="${escapeHtml(image.alt || '')}"
                placeholder="Mô tả ảnh"
              >
              <div class="curriculum-image-manager__meta">
                <span class="small text-secondary">Kéo thả để đổi thứ tự</span>
                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm"
                  data-action="remove-lesson-image"
                  data-image-id="${escapeHtml(image.id)}"
                >
                  <i class="bi bi-trash me-1"></i>Xóa
                </button>
              </div>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderLessonImagesFieldV3(lessonDraft, cloudinaryReady) {
  const images = getLessonImagesV3(lessonDraft);

  return `
    <div class="col-12">
      <label class="form-label">Ảnh minh họa</label>
      <input
        type="hidden"
        name="lessonImagesJson"
        value="${escapeHtml(JSON.stringify(images))}"
      >
      <div class="curriculum-image-upload">
        <div id="curriculum-lesson-images-preview" class="curriculum-image-upload__preview curriculum-image-upload__preview--multi">
          ${renderLessonImageItemsV3(images)}
        </div>
        <div class="curriculum-image-upload__actions">
          <input
            id="curriculum-lesson-images-input"
            class="d-none"
            type="file"
            accept="image/*"
            name="coverImageFile"
            multiple
          >
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            data-action="pick-lesson-image"
            ${cloudinaryReady ? '' : 'disabled'}
          >
            <i class="bi bi-images me-2"></i>${cloudinaryReady ? 'Tải ảnh lên' : 'Cloudinary chưa sẵn sàng'}
          </button>
        </div>
        <div class="small text-secondary mt-2">
          ${cloudinaryReady ? 'Mỗi bài học có thể dùng nhiều ảnh. Ảnh đầu tiên sẽ là ảnh chính.' : 'Thêm VITE_CLOUDINARY_CLOUD_NAME và VITE_CLOUDINARY_UPLOAD_PRESET để bật upload ảnh.'}
        </div>
      </div>
    </div>
  `;
}

function renderLessonBannerPreviewV3(image = null) {
  if (!image?.secureUrl) {
    return `
      <div class="curriculum-image-upload__empty">
        Chưa có banner cho buổi học này.
      </div>
    `;
  }

  return `
    <div class="curriculum-image-upload__preview-card">
      <img
        src="${escapeHtml(image.secureUrl)}"
        alt="${escapeHtml(image.alt || 'Banner buổi học')}"
        class="curriculum-image-upload__preview-image"
        loading="lazy"
      >
    </div>
  `;
}

function renderLessonBannerFieldV3(lessonDraft, cloudinaryReady) {
  const bannerImage = getLessonBannerImageV3(lessonDraft);

  return `
    <div class="col-12">
      <label class="form-label">Banner buổi học</label>
      <input
        type="hidden"
        name="lessonBannerJson"
        value="${escapeHtml(JSON.stringify(bannerImage || null))}"
      >
      <div class="curriculum-image-upload">
        <div id="curriculum-lesson-banner-preview" class="curriculum-image-upload__preview">
          ${renderLessonBannerPreviewV3(bannerImage)}
        </div>
        <div class="curriculum-image-upload__actions">
          <input
            id="curriculum-lesson-banner-input"
            class="d-none"
            type="file"
            accept="image/*"
            name="bannerImageFile"
          >
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            data-action="pick-banner-image"
            ${cloudinaryReady ? '' : 'disabled'}
          >
            <i class="bi bi-card-image me-2"></i>${cloudinaryReady ? 'Tải banner' : 'Cloudinary chưa sẵn sàng'}
          </button>
          ${
            bannerImage?.secureUrl
              ? `
                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm"
                  data-action="remove-banner-image"
                >
                  <i class="bi bi-trash me-2"></i>Xóa banner
                </button>
              `
              : ''
          }
        </div>
        <div class="small text-secondary mt-2">
          ${cloudinaryReady ? 'Banner sẽ hiện ở đầu bài học cho học sinh xem cùng nội dung lesson.' : 'Thêm VITE_CLOUDINARY_CLOUD_NAME và VITE_CLOUDINARY_UPLOAD_PRESET để bật upload ảnh.'}
        </div>
      </div>
    </div>
    <div class="col-12">
      <label class="form-label">Mô tả banner</label>
      <input
        class="form-control"
        data-role="banner-image-alt"
        value="${escapeHtml(bannerImage?.alt || '')}"
        placeholder="Ví dụ: Banner minh họa giao diện trò chơi hoặc kết quả buổi học"
      >
    </div>
  `;
}

function renderLessonMarkdownPaneV3({
  tab,
  label,
  hint,
  markdown,
  previewHtml,
  placeholder,
  active = false,
}) {
  return `
    <div
      class="curriculum-lesson-markdown-pane ${active ? '' : 'd-none'}"
      data-markdown-pane="${tab}"
    >
      <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
        <div>
          <label class="form-label mb-0">${label}</label>
          <div class="form-text mt-1">${hint}</div>
        </div>
        <div class="d-flex flex-wrap gap-2">
          <input
            class="d-none"
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            name="${tab}MarkdownFile"
          >
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            data-action="pick-markdown-file"
            data-markdown-tab="${tab}"
          >
            <i class="bi bi-file-earmark-arrow-up me-2"></i>Upload file .md
          </button>
        </div>
      </div>
      <textarea
        class="form-control font-monospace"
        name="${tab}Markdown"
        rows="14"
        placeholder="${placeholder}"
      >${escapeHtml(markdown)}</textarea>
      <div class="form-text">Bạn có thể upload file markdown rồi chỉnh lại trực tiếp trong ô này trước khi lưu.</div>
      <div class="mt-3">
        <label class="form-label">Xem trước ${label.toLowerCase()}</label>
        <div
          id="curriculum-markdown-preview-${tab}"
          class="curriculum-markdown-preview student-library-markdown"
          data-markdown-preview="${tab}"
        >
          ${previewHtml || '<div class="student-library-markdown-empty">Chưa có nội dung markdown để xem trước.</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderLessonMarkdownFieldV3(lessonDraft) {
  const lectureMarkdown = getLessonMarkdownDraftV3(lessonDraft, LESSON_MARKDOWN_TAB_LECTURE);
  const exerciseMarkdown = getLessonMarkdownDraftV3(lessonDraft, LESSON_MARKDOWN_TAB_EXERCISE);
  const lecturePreviewHtml = renderLessonMarkdownHtml(
    {
      ...lessonDraft,
      lectureMarkdown,
      contentMarkdown: lectureMarkdown,
    },
    LESSON_MARKDOWN_TAB_LECTURE,
  );
  const exercisePreviewHtml = renderLessonMarkdownHtml(
    {
      ...lessonDraft,
      exerciseMarkdown,
    },
    LESSON_MARKDOWN_TAB_EXERCISE,
  );
  return `
    <div class="col-12">
      <div class="curriculum-lesson-markdown-editor">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <div class="student-library-tabbar" role="tablist" aria-label="Nội dung markdown">
            <button
              type="button"
              class="student-library-tab student-library-tab--active"
              data-action="switch-lesson-markdown-tab"
              data-markdown-tab="${LESSON_MARKDOWN_TAB_LECTURE}"
            >
              <i class="bi bi-journal-text me-1"></i>Bài giảng
            </button>
            <button
              type="button"
              class="student-library-tab"
              data-action="switch-lesson-markdown-tab"
              data-markdown-tab="${LESSON_MARKDOWN_TAB_EXERCISE}"
            >
              <i class="bi bi-pencil-square me-1"></i>Bài tập
            </button>
          </div>
        </div>
        ${renderLessonMarkdownPaneV3({
          tab: LESSON_MARKDOWN_TAB_LECTURE,
          label: 'Bài giảng',
          hint: 'Dùng cho khái niệm, code mẫu, giải thích và phần học sinh cần xem lại.',
          markdown: lectureMarkdown,
          previewHtml: lecturePreviewHtml,
          placeholder: '# Tiêu đề bài học&#10;&#10;## Khái niệm&#10;&#10;## Code mẫu&#10;&#10;## Giải thích',
          active: true,
        })}
        ${renderLessonMarkdownPaneV3({
          tab: LESSON_MARKDOWN_TAB_EXERCISE,
          label: 'Bài tập',
          hint: 'Dùng cho bài tập không đáp án.',
          markdown: exerciseMarkdown,
          previewHtml: exercisePreviewHtml,
          placeholder: '# Bài tập tự luyện&#10;&#10;## Bài 1&#10;&#10;Mô tả yêu cầu học sinh cần làm, không ghi đáp án.',
        })}
      </div>
    </div>
  `;
}

function renderReviewLinkRowsV3(reviewLinks = []) {
  if (!Array.isArray(reviewLinks) || reviewLinks.length === 0) {
    return `
      <div class="curriculum-link-editor__empty">
        Chưa có tài liệu đính kèm cho bài học này.
      </div>
    `;
  }

  return reviewLinks
    .map(
      (item, index) => `
        <div class="curriculum-link-row" data-link-id="${escapeHtml(item.id || createCurriculumItemId('review-link'))}">
          <div class="row g-2 align-items-start">
            <div class="col-12 col-lg-4">
              <label class="form-label small mb-1">Tên tài liệu</label>
              <input
                type="text"
                class="form-control form-control-sm"
                data-role="review-link-label"
                value="${escapeHtml(item.label || '')}"
                placeholder="Ví dụ: Slide bài học"
              >
            </div>
            <div class="col-12 col-lg-6">
              <label class="form-label small mb-1">Đường link</label>
              <input
                type="url"
                class="form-control form-control-sm"
                data-role="review-link-url"
                value="${escapeHtml(item.url || '')}"
                placeholder="https://..."
              >
            </div>
            <div class="col-12 col-lg-2">
              <label class="form-label small mb-1 d-block">Thao tác</label>
              <div class="d-flex gap-1 flex-wrap">
                <button type="button" class="btn btn-outline-secondary btn-sm" data-action="move-review-link" data-direction="up" ${index === 0 ? 'disabled' : ''}>
                  <i class="bi bi-arrow-up"></i>
                </button>
                <button type="button" class="btn btn-outline-secondary btn-sm" data-action="move-review-link" data-direction="down" ${index === reviewLinks.length - 1 ? 'disabled' : ''}>
                  <i class="bi bi-arrow-down"></i>
                </button>
                <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-review-link">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `,
    )
    .join('');
}

function renderLessonReviewLinksFieldV3(lessonDraft) {
  const reviewLinks = getLessonReviewLinksV3(lessonDraft);

  return `
    <div class="col-12">
      <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
        <label class="form-label mb-0">Tài liệu đính kèm</label>
        <button type="button" class="btn btn-outline-primary btn-sm" data-action="add-review-link-row">
          <i class="bi bi-plus-lg me-1"></i>Thêm tài liệu
        </button>
      </div>
      <div id="curriculum-review-links-list" class="curriculum-link-editor">
        ${renderReviewLinkRowsV3(reviewLinks)}
      </div>
    </div>
  `;
}

function renderLessonFormV3(program, lessonDraft, busyKey, cloudinaryReady) {
  const isEditing = Boolean(lessonDraft?.id);
  const sessionNumber = Number(lessonDraft?.sessionNumber || 1);

  return `
    <form id="curriculum-lesson-form" class="curriculum-editor-form">
      <input type="hidden" name="lessonId" value="${escapeHtml(lessonDraft?.id || '')}">
      <input type="hidden" name="sessionNumber" value="${sessionNumber}">
      <div class="row g-3">
        <div class="col-12 col-md-4">
          <label class="form-label">Buổi đang chỉnh</label>
          <div class="form-control bg-body-tertiary fw-semibold">Buổi ${sessionNumber}</div>
          <div class="form-text">
            Chọn buổi ở cột danh sách bên trái. Form này chỉ sửa nội dung của buổi đang chọn.
          </div>
        </div>
        <div class="col-12 col-md-8">
          <label class="form-label">Tiêu đề buổi học</label>
          <input class="form-control" name="title" value="${escapeHtml(lessonDraft?.title || '')}" placeholder="Ví dụ: Hoàn thiện bố cục trang chủ">
        </div>
        <div class="col-12">
          <div class="curriculum-editor-subsection">
            <div class="curriculum-editor-subsection__title">Bài giảng & bài tập</div>
            <div class="curriculum-editor-subsection__hint">Tách phần giảng dạy và phần bài tập tự luyện để học sinh xem rõ ràng hơn.</div>
          </div>
        </div>
        ${renderLessonMarkdownFieldV3(lessonDraft)}
        <div class="col-12">
          <div class="curriculum-editor-subsection">
            <div class="curriculum-editor-subsection__title">Banner buổi học</div>
            <div class="curriculum-editor-subsection__hint">Banner sẽ hiện ở đầu bài học để học sinh xem cùng nội dung.</div>
          </div>
        </div>
        ${renderLessonBannerFieldV3(lessonDraft, cloudinaryReady)}
        <div class="col-12">
          <div class="curriculum-editor-subsection">
            <div class="curriculum-editor-subsection__title">Ảnh minh họa thêm</div>
            <div class="curriculum-editor-subsection__hint">Các ảnh này sẽ hiện dưới banner theo dạng thumbnail để học sinh chuyển qua lại.</div>
          </div>
        </div>
        ${renderLessonImagesFieldV3(lessonDraft, cloudinaryReady)}
        ${renderLessonReviewLinksFieldV3(lessonDraft)}
        <div class="col-12">
          <label class="form-label">Ghi chú cho giáo viên</label>
          <textarea class="form-control" name="teacherNote" rows="3" placeholder="Các lưu ý riêng khi dạy buổi này">${escapeHtml(lessonDraft?.teacherNote || '')}</textarea>
        </div>
      </div>
      <div class="curriculum-editor-form__actions mt-4">
        <button type="submit" class="btn btn-primary" ${busyKey === 'save-lesson' ? 'disabled' : ''}>
          ${
            busyKey === 'save-lesson'
              ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang lưu...'
              : `<i class="bi bi-save me-2"></i>${isEditing ? 'Lưu buổi học' : 'Thêm buổi học'}`
          }
        </button>
        ${
          isEditing
            ? `
              <button
                type="button"
                class="btn btn-outline-warning"
                data-action="archive-lesson"
                data-lesson-id="${escapeHtml(lessonDraft.id)}"
                ${busyKey === 'archive-lesson' ? 'disabled' : ''}
              >
                <i class="bi bi-archive me-2"></i>Lưu kho
              </button>
            `
            : ''
        }
      </div>
    </form>
  `;
}

function renderLessonsTabV3(program, selectedLessonId, busyKey, cloudinaryReady) {
  const activeLessons = getActiveCurriculumLessons(program);
  const sessionLimit = getLessonSessionLimit(program);
  const canCreateLesson = activeLessons.length < sessionLimit;
  const selectedLesson =
    selectedLessonId === 'new'
      ? getNewLessonDraft(program)
      : activeLessons.find((lesson) => lesson.id === selectedLessonId) || getNewLessonDraft(program);
  const selectedSessionNumber = Number(selectedLesson?.sessionNumber || 1);
  const lessonPreviewPath = buildAdminLessonPreviewPath(program.id, selectedSessionNumber);

  return `
    <div class="row g-4">
      <div class="col-12 col-xl-4">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white border-0 d-flex justify-content-between align-items-center gap-2">
            <div>
              <h3 class="h6 mb-0">Danh sách buổi học</h3>
              <div class="small text-secondary">${activeLessons.length} buổi đang hiển thị cho học sinh · tối đa ${sessionLimit} buổi toàn khóa</div>
            </div>
            <button type="button" class="btn btn-sm btn-primary" data-action="create-lesson" ${canCreateLesson ? '' : 'disabled'}>
              <i class="bi bi-plus-lg me-1"></i>Thêm buổi
            </button>
          </div>
          <div class="card-body">
            ${renderLessonList(program, selectedLessonId)}
            ${
              !canCreateLesson
                ? `<div class="curriculum-compact-note mt-3">Chương trình này đã dùng đủ ${sessionLimit} buổi. Nếu muốn thêm nội dung mới, bạn cần thay thế hoặc lưu kho một buổi cũ trước.</div>`
                : ''
            }
          </div>
        </div>
      </div>
      <div class="col-12 col-xl-8">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white border-0 d-flex flex-wrap justify-content-between align-items-center gap-2">
            <h3 class="h6 mb-0">${selectedLessonId === 'new' || !selectedLessonId ? 'Thêm buổi học mới' : 'Chỉnh sửa buổi học'}</h3>
            <a class="btn btn-outline-secondary btn-sm" href="${escapeHtml(lessonPreviewPath)}" target="_blank" rel="noreferrer">
              <i class="bi bi-eye me-1"></i>Xem thử buổi này
            </a>
          </div>
          <div class="card-body">
            ${renderLessonFormV3(program, selectedLesson, busyKey, cloudinaryReady)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function getLessonImagesFromFormV3(form) {
  const jsonInput = form.querySelector('input[name="lessonImagesJson"]');

  if (!jsonInput?.value) {
    return [];
  }

  try {
    const images = JSON.parse(jsonInput.value);
    return Array.isArray(images)
      ? images.map((item, index) => ({
          ...item,
          order: index + 1,
        }))
      : [];
  } catch {
    return [];
  }
}

function setLessonImagesFormStateV3(form, images = []) {
  if (!form) {
    return;
  }

  const nextImages = Array.isArray(images)
    ? images.map((item, index) => ({
        ...item,
        order: index + 1,
      }))
    : [];
  const jsonInput = form.querySelector('input[name="lessonImagesJson"]');
  const previewElement = form.querySelector('#curriculum-lesson-images-preview');

  if (jsonInput) {
    jsonInput.value = JSON.stringify(nextImages);
  }

  if (previewElement) {
    previewElement.innerHTML = renderLessonImageItemsV3(nextImages);
  }
}

function getLessonBannerFromFormV3(form) {
  const jsonInput = form.querySelector('input[name="lessonBannerJson"]');

  if (!jsonInput?.value) {
    return null;
  }

  try {
    const image = JSON.parse(jsonInput.value);
    return image?.secureUrl ? image : null;
  } catch {
    return null;
  }
}

function setLessonBannerFormStateV3(form, bannerImage = null) {
  if (!form) {
    return;
  }

  const jsonInput = form.querySelector('input[name="lessonBannerJson"]');
  const previewElement = form.querySelector('#curriculum-lesson-banner-preview');
  const altInput = form.querySelector('[data-role="banner-image-alt"]');
  const actionsElement = form.querySelector('#curriculum-lesson-banner-preview')?.closest('.curriculum-image-upload')?.querySelector('.curriculum-image-upload__actions');
  const existingRemoveButton = actionsElement?.querySelector('[data-action="remove-banner-image"]');

  if (jsonInput) {
    jsonInput.value = bannerImage ? JSON.stringify(bannerImage) : '';
  }

  if (altInput) {
    altInput.value = bannerImage?.alt || '';
  }

  if (previewElement) {
    previewElement.innerHTML = renderLessonBannerPreviewV3(bannerImage);
  }

  if (!actionsElement) {
    return;
  }

  if (bannerImage?.secureUrl) {
    if (!existingRemoveButton) {
      actionsElement.insertAdjacentHTML(
        'beforeend',
        `
          <button
            type="button"
            class="btn btn-outline-danger btn-sm"
            data-action="remove-banner-image"
          >
            <i class="bi bi-trash me-2"></i>Xóa banner
          </button>
        `,
      );
    }

    return;
  }

  existingRemoveButton?.remove();
}

function syncBannerImageAltFormStateV3(input) {
  const form = input.closest('form');

  if (!form) {
    return;
  }

  const bannerImage = getLessonBannerFromFormV3(form);

  if (!bannerImage) {
    return;
  }

  setLessonBannerFormStateV3(form, {
    ...bannerImage,
    alt: input.value,
  });
}

function syncLessonMarkdownPreviewV3(form, tab = '') {
  if (!form) {
    return;
  }

  const tabs = tab
    ? [normalizeLessonMarkdownTab(tab)]
    : [LESSON_MARKDOWN_TAB_LECTURE, LESSON_MARKDOWN_TAB_EXERCISE];
  const titleInput = form.querySelector('input[name="title"]');

  tabs.forEach((currentTab) => {
    const previewElement = form.querySelector(`[data-markdown-preview="${currentTab}"]`);
    const markdownInput = form.querySelector(`textarea[name="${currentTab}Markdown"]`);

    if (!previewElement || !markdownInput) {
      return;
    }

    const html = renderLessonMarkdownHtml(
      {
        title: titleInput?.value || '',
        lectureMarkdown: currentTab === LESSON_MARKDOWN_TAB_LECTURE ? markdownInput.value : '',
        contentMarkdown: currentTab === LESSON_MARKDOWN_TAB_LECTURE ? markdownInput.value : '',
        exerciseMarkdown: currentTab === LESSON_MARKDOWN_TAB_EXERCISE ? markdownInput.value : '',
      },
      currentTab,
    );

    previewElement.innerHTML =
      html || '<div class="student-library-markdown-empty">Chưa có nội dung markdown để xem trước.</div>';
  });
}

function syncLessonImageAltFormStateV3(input) {
  const form = input.closest('form');
  const imageId = input.dataset.imageId || '';

  if (!form || !imageId) {
    return;
  }

  const nextImages = getLessonImagesFromFormV3(form).map((item) =>
    item.id === imageId
      ? {
          ...item,
          alt: input.value,
        }
      : item,
  );

  const jsonInput = form.querySelector('input[name="lessonImagesJson"]');

  if (jsonInput) {
    jsonInput.value = JSON.stringify(nextImages);
  }
}

function getReviewLinksFromFormV3(form) {
  return Array.from(form.querySelectorAll('.curriculum-link-row'))
    .map((row, index) => {
      const labelInput = row.querySelector('[data-role="review-link-label"]');
      const urlInput = row.querySelector('[data-role="review-link-url"]');
      const label = String(labelInput?.value || '').trim();
      const url = String(urlInput?.value || '').trim();

      if (!label && !url) {
        return null;
      }

      return {
        id: row.dataset.linkId || createCurriculumItemId('review-link'),
        label,
        url,
        order: index + 1,
      };
    })
    .filter(Boolean);
}

function createReviewLinkRowV3(label = '', url = '') {
  return `
    <div class="curriculum-link-row" data-link-id="${escapeHtml(createCurriculumItemId('review-link'))}">
      <div class="row g-2 align-items-start">
        <div class="col-12 col-lg-4">
          <label class="form-label small mb-1">Tên tài liệu</label>
          <input
            type="text"
            class="form-control form-control-sm"
            data-role="review-link-label"
            value="${escapeHtml(label)}"
            placeholder="Ví dụ: Slide bài học"
          >
        </div>
        <div class="col-12 col-lg-6">
          <label class="form-label small mb-1">Đường link</label>
          <input
            type="url"
            class="form-control form-control-sm"
            data-role="review-link-url"
            value="${escapeHtml(url)}"
            placeholder="https://..."
          >
        </div>
        <div class="col-12 col-lg-2">
          <label class="form-label small mb-1 d-block">Thao tác</label>
          <div class="d-flex gap-1 flex-wrap">
            <button type="button" class="btn btn-outline-secondary btn-sm" data-action="move-review-link" data-direction="up">
              <i class="bi bi-arrow-up"></i>
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm" data-action="move-review-link" data-direction="down">
              <i class="bi bi-arrow-down"></i>
            </button>
            <button type="button" class="btn btn-outline-danger btn-sm" data-action="remove-review-link">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function refreshReviewLinkControlsV3(container) {
  if (!container) {
    return;
  }

  const rows = Array.from(container.querySelectorAll('.curriculum-link-row'));

  rows.forEach((row, index) => {
    const moveUpButton = row.querySelector('[data-action="move-review-link"][data-direction="up"]');
    const moveDownButton = row.querySelector('[data-action="move-review-link"][data-direction="down"]');

    if (moveUpButton) {
      moveUpButton.disabled = index === 0;
    }

    if (moveDownButton) {
      moveDownButton.disabled = index === rows.length - 1;
    }
  });
}

function reorderItemsById(items, sourceId, targetId) {
  const nextItems = [...items];
  const sourceIndex = nextItems.findIndex((item) => item.id === sourceId);
  const targetIndex = nextItems.findIndex((item) => item.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return items;
  }

  const [movedItem] = nextItems.splice(sourceIndex, 1);
  nextItems.splice(targetIndex, 0, movedItem);

  return nextItems;
}

function renderLessonForm(program, lessonDraft, busyKey) {
  const isEditing = Boolean(lessonDraft?.id);
  const sessionNumber = Number(lessonDraft?.sessionNumber || 1);

  return `
    <form id="curriculum-lesson-form" class="curriculum-editor-form">
      <input type="hidden" name="lessonId" value="${escapeHtml(lessonDraft?.id || '')}">
      <div class="row g-3">
        <div class="col-12 col-md-4">
          <label class="form-label">Buổi</label>
          <select class="form-select" name="sessionNumber">
            ${Array.from({ length: Number(program.knowledgePhaseEndSession || 1) }, (_, index) => index + 1)
              .map(
                (value) => `
                  <option value="${value}" ${value === sessionNumber ? 'selected' : ''}>
                    Buổi ${value}
                  </option>
                `,
              )
              .join('')}
          </select>
        </div>
        <div class="col-12 col-md-8">
          <label class="form-label">Tiêu đề buổi học</label>
          <input class="form-control" name="title" value="${escapeHtml(lessonDraft?.title || '')}" placeholder="Ví dụ: Hoàn thiện bố cục trang chủ">
        </div>
        <div class="col-12">
          <label class="form-label">Tóm tắt</label>
          <textarea class="form-control" name="summary" rows="3" placeholder="Tóm tắt ngắn gọn nội dung chính của buổi học">${escapeHtml(lessonDraft?.summary || '')}</textarea>
        </div>
        <div class="col-12">
          <label class="form-label">Ý chính cần nhớ</label>
          <textarea class="form-control" name="keyPoints" rows="4" placeholder="Mỗi dòng là một ý chính">${escapeHtml(joinLines(lessonDraft?.keyPoints || []))}</textarea>
        </div>
        <div class="col-12">
          <label class="form-label">Nhiệm vụ gợi ý</label>
          <textarea class="form-control" name="practiceTask" rows="3" placeholder="Ví dụ: Làm xong giao diện, thêm hình ảnh và hoàn thiện nút đăng nhập">${escapeHtml(lessonDraft?.practiceTask || '')}</textarea>
        </div>
        <div class="col-12">
          <label class="form-label">Tài liệu đi kèm</label>
          <textarea class="form-control" name="reviewLinks" rows="3" placeholder="Mỗi dòng là một tài liệu hoặc nguồn ôn tập">${escapeHtml(joinLines(lessonDraft?.reviewLinks || []))}</textarea>
        </div>
        <div class="col-12">
          <label class="form-label">Ghi chú cho giáo viên</label>
          <textarea class="form-control" name="teacherNote" rows="3" placeholder="Các lưu ý riêng khi dạy buổi này">${escapeHtml(lessonDraft?.teacherNote || '')}</textarea>
        </div>
      </div>
      <div class="curriculum-editor-form__actions mt-4">
        <button type="submit" class="btn btn-primary" ${busyKey === 'save-lesson' ? 'disabled' : ''}>
          ${
            busyKey === 'save-lesson'
              ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang lưu...'
              : `<i class="bi bi-save me-2"></i>${isEditing ? 'Lưu buổi học' : 'Thêm buổi học'}`
          }
        </button>
        ${
          isEditing
            ? `
              <button
                type="button"
                class="btn btn-outline-warning"
                data-action="archive-lesson"
                data-lesson-id="${escapeHtml(lessonDraft.id)}"
                ${busyKey === 'archive-lesson' ? 'disabled' : ''}
              >
                <i class="bi bi-archive me-2"></i>Lưu kho
              </button>
            `
            : ''
        }
      </div>
    </form>
  `;
}

function renderLessonsTab(program, selectedLessonId, busyKey) {
  const activeLessons = getActiveCurriculumLessons(program);
  const selectedLesson =
    selectedLessonId === 'new'
      ? getNewLessonDraft(program)
      : activeLessons.find((lesson) => lesson.id === selectedLessonId) || getNewLessonDraft(program);

  return `
    <div class="row g-4">
      <div class="col-12 col-xl-4">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white border-0 d-flex justify-content-between align-items-center gap-2">
            <div>
              <h3 class="h6 mb-0">Danh sách buổi học</h3>
              <div class="small text-secondary">${activeLessons.length} buổi đang hiển thị cho học sinh</div>
            </div>
            <button type="button" class="btn btn-sm btn-primary" data-action="create-lesson">
              <i class="bi bi-plus-lg me-1"></i>Thêm buổi
            </button>
          </div>
          <div class="card-body">
            ${renderLessonList(program, selectedLessonId)}
          </div>
        </div>
      </div>
      <div class="col-12 col-xl-8">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white border-0">
            <h3 class="h6 mb-0">${selectedLessonId === 'new' || !selectedLessonId ? 'Thêm buổi học mới' : 'Chỉnh sửa buổi học'}</h3>
          </div>
          <div class="card-body">
            ${renderLessonForm(program, selectedLesson, busyKey)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderProjectFinalForm(program, busyKey) {
  return `
    <form id="curriculum-project-stages-form" class="curriculum-stage-grid">
      ${program.finalChecklist
        .map(
          (item) => `
            <div class="card border-0 shadow-sm curriculum-stage-card">
              <div class="card-header bg-white border-0 d-flex justify-content-between align-items-center gap-2">
                <div>
                  <div class="small text-secondary">Giai đoạn ${item.order}</div>
                  <h3 class="h6 mb-0">${escapeHtml(item.title)}</h3>
                </div>
                <span class="badge text-bg-light text-dark border">Cố định</span>
              </div>
              <div class="card-body">
                <input type="hidden" name="stageKey:${escapeHtml(item.stageKey)}" value="${escapeHtml(item.stageKey)}">
                <div class="mb-3">
                  <label class="form-label">Mô tả giai đoạn</label>
                  <textarea class="form-control" name="description:${escapeHtml(item.stageKey)}" rows="3">${escapeHtml(item.description || '')}</textarea>
                </div>
                <div class="mb-3">
                  <label class="form-label">Cách tự đối chiếu</label>
                  <textarea class="form-control" name="studentGuide:${escapeHtml(item.stageKey)}" rows="3">${escapeHtml(item.studentGuide || '')}</textarea>
                </div>
                <div>
                  <label class="form-label">Ví dụ đầu ra</label>
                  <textarea class="form-control" name="exampleOutput:${escapeHtml(item.stageKey)}" rows="3">${escapeHtml(item.exampleOutput || '')}</textarea>
                </div>
              </div>
            </div>
          `,
        )
        .join('')}
      <div class="curriculum-editor-form__actions">
        <button type="submit" class="btn btn-primary" ${busyKey === 'save-project-stages' ? 'disabled' : ''}>
          ${
            busyKey === 'save-project-stages'
              ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang lưu...'
              : '<i class="bi bi-save me-2"></i>Lưu quy trình cuối khóa'
          }
        </button>
      </div>
    </form>
  `;
}

function renderExamChecklistList(program, selectedChecklistId) {
  const checklist = getActiveCurriculumChecklist(program);

  if (checklist.length === 0) {
    return `
      <div class="curriculum-editor-empty">
        Chương trình này chưa có mục ôn tập cuối khóa nào. Hãy bấm <strong>Thêm mục</strong> để bắt đầu.
      </div>
    `;
  }

  return `
    <div class="curriculum-editor-list">
      ${checklist
        .map(
          (item) => `
            <button
              type="button"
              class="curriculum-editor-list__item ${item.id === selectedChecklistId ? 'curriculum-editor-list__item--active' : ''}"
              data-action="select-exam-item"
              data-checklist-id="${escapeHtml(item.id)}"
            >
              <div class="d-flex justify-content-between gap-2 align-items-center">
                <strong>Mục ${item.order}</strong>
                <span class="badge text-bg-light text-dark border">Đang dùng</span>
              </div>
              <div class="small text-secondary mt-2">${escapeHtml(item.title)}</div>
            </button>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderExamChecklistForm(program, selectedChecklistId, busyKey) {
  const activeChecklist = getActiveCurriculumChecklist(program);
  const draft =
    selectedChecklistId === 'new'
      ? getNewExamChecklistDraft(program)
      : activeChecklist.find((item) => item.id === selectedChecklistId) || getNewExamChecklistDraft(program);
  const isEditing = Boolean(draft?.id);

  return `
    <form id="curriculum-exam-checklist-form" class="curriculum-editor-form">
      <input type="hidden" name="checklistId" value="${escapeHtml(draft.id || '')}">
      <div class="row g-3">
        <div class="col-12 col-md-4">
          <label class="form-label">Thứ tự</label>
          <input class="form-control" type="number" min="1" name="order" value="${escapeHtml(String(draft.order || 1))}">
        </div>
        <div class="col-12 col-md-8">
          <label class="form-label">Tiêu đề mục</label>
          <input class="form-control" name="title" value="${escapeHtml(draft.title || '')}" placeholder="Ví dụ: Ôn lại toàn bộ kiến thức trọng tâm">
        </div>
        <div class="col-12">
          <label class="form-label">Mô tả</label>
          <textarea class="form-control" name="description" rows="4" placeholder="Mô tả ngắn gọn việc học sinh cần làm ở mục này">${escapeHtml(draft.description || '')}</textarea>
        </div>
      </div>
      <div class="curriculum-editor-form__actions mt-4">
        <button type="submit" class="btn btn-primary" ${busyKey === 'save-exam-item' ? 'disabled' : ''}>
          ${
            busyKey === 'save-exam-item'
              ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang lưu...'
              : `<i class="bi bi-save me-2"></i>${isEditing ? 'Lưu mục cuối khóa' : 'Thêm mục cuối khóa'}`
          }
        </button>
        ${
          isEditing
            ? `
              <button
                type="button"
                class="btn btn-outline-warning"
                data-action="archive-exam-item"
                data-checklist-id="${escapeHtml(draft.id)}"
                ${busyKey === 'archive-exam-item' ? 'disabled' : ''}
              >
                <i class="bi bi-archive me-2"></i>Lưu kho
              </button>
            `
            : ''
        }
      </div>
    </form>
  `;
}

function renderFinalTab(program, selectedChecklistId, busyKey) {
  if (program.finalMode === 'project') {
    return `
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-body">
          <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start">
            <div>
              <h3 class="h6 mb-1">Quy trình sản phẩm cuối khóa</h3>
              <p class="text-secondary mb-0">
                7 giai đoạn dưới đây giữ cố định theo đúng form báo cáo. Bạn chỉ chỉnh mô tả, cách tự đối chiếu và ví dụ đầu ra để học sinh đọc dễ hơn.
              </p>
            </div>
            <span class="badge text-bg-success">Áp dụng cho tất cả lớp dùng chương trình này</span>
          </div>
        </div>
      </div>
      ${renderProjectFinalForm(program, busyKey)}
    `;
  }

  return `
    <div class="row g-4">
      <div class="col-12 col-xl-4">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white border-0 d-flex justify-content-between align-items-center gap-2">
            <div>
              <h3 class="h6 mb-0">Checklist cuối khóa</h3>
              <div class="small text-secondary">${getActiveCurriculumChecklist(program).length} mục đang hiển thị</div>
            </div>
            <button type="button" class="btn btn-sm btn-primary" data-action="create-exam-item">
              <i class="bi bi-plus-lg me-1"></i>Thêm mục
            </button>
          </div>
          <div class="card-body">
            ${renderExamChecklistList(program, selectedChecklistId)}
          </div>
        </div>
      </div>
      <div class="col-12 col-xl-8">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white border-0">
            <h3 class="h6 mb-0">${selectedChecklistId === 'new' || !selectedChecklistId ? 'Thêm mục cuối khóa' : 'Chỉnh sửa mục cuối khóa'}</h3>
          </div>
          <div class="card-body">
            ${renderExamChecklistForm(program, selectedChecklistId, busyKey)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderArchivedTab(program, busyKey) {
  const archivedLessons = getArchivedCurriculumLessons(program);
  const archivedChecklist = getArchivedCurriculumChecklist(program);

  if (archivedLessons.length === 0 && archivedChecklist.length === 0) {
    return renderEmptyState({
      icon: 'archive',
      title: 'Chưa có gì trong kho lưu',
      description: 'Các buổi học hoặc mục cuối khóa được lưu kho sẽ xuất hiện ở đây để bạn khôi phục khi cần.',
    });
  }

  return `
    <div class="row g-4">
      <div class="col-12 col-xl-6">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white border-0">
            <h3 class="h6 mb-0">Buổi học đã lưu kho</h3>
          </div>
          <div class="card-body">
            ${
              archivedLessons.length === 0
                ? '<div class="curriculum-editor-empty">Chưa có buổi học nào được lưu kho.</div>'
                : `
                  <div class="curriculum-editor-list">
                    ${archivedLessons
                      .map(
                        (lesson) => `
                          <div class="curriculum-editor-list__item">
                            <div class="d-flex justify-content-between gap-3 align-items-start">
                              <div>
                                <div class="fw-semibold">Buổi ${lesson.sessionNumber}</div>
                                <div class="small text-secondary mt-1">${escapeHtml(lesson.title)}</div>
                              </div>
                              <button
                                type="button"
                                class="btn btn-sm btn-outline-primary"
                                data-action="restore-lesson"
                                data-lesson-id="${escapeHtml(lesson.id)}"
                                ${busyKey === `restore-lesson:${lesson.id}` ? 'disabled' : ''}
                              >
                                <i class="bi bi-arrow-counterclockwise me-1"></i>Khôi phục
                              </button>
                            </div>
                          </div>
                        `,
                      )
                      .join('')}
                  </div>
                `
            }
          </div>
        </div>
      </div>
      <div class="col-12 col-xl-6">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white border-0">
            <h3 class="h6 mb-0">${program.finalMode === 'project' ? 'Giai đoạn cuối khóa cố định' : 'Checklist cuối khóa đã lưu kho'}</h3>
          </div>
          <div class="card-body">
            ${
              program.finalMode === 'project'
                ? '<div class="curriculum-editor-empty">Quy trình sản phẩm cuối khóa giữ cố định 7 giai đoạn nên không có mục lưu kho riêng.</div>'
                : archivedChecklist.length === 0
                  ? '<div class="curriculum-editor-empty">Chưa có mục cuối khóa nào được lưu kho.</div>'
                  : `
                    <div class="curriculum-editor-list">
                      ${archivedChecklist
                        .map(
                          (item) => `
                            <div class="curriculum-editor-list__item">
                              <div class="d-flex justify-content-between gap-3 align-items-start">
                                <div>
                                  <div class="fw-semibold">Mục ${item.order}</div>
                                  <div class="small text-secondary mt-1">${escapeHtml(item.title)}</div>
                                </div>
                                <button
                                  type="button"
                                  class="btn btn-sm btn-outline-primary"
                                  data-action="restore-exam-item"
                                  data-checklist-id="${escapeHtml(item.id)}"
                                  ${busyKey === `restore-exam-item:${item.id}` ? 'disabled' : ''}
                                >
                                  <i class="bi bi-arrow-counterclockwise me-1"></i>Khôi phục
                                </button>
                              </div>
                            </div>
                          `,
                        )
                        .join('')}
                    </div>
                  `
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderProgramManagement(programGroups, selectedProgramId, editorTab, selectedLessonId, selectedChecklistId, busyKey) {
  const selectedProgram = programGroups
    .flatMap((group) => group.programs)
    .find((program) => program.id === selectedProgramId);

  if (programGroups.length === 0) {
    return `
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="alert alert-warning mb-0">
            Chưa có chương trình mẫu trong Firestore. Hãy chạy script seed curriculum để tiếp tục.
          </div>
        </div>
      </div>
    `;
  }

  let tabContent = '';

  if (selectedProgram) {
    if (editorTab === 'final') {
      tabContent = renderFinalTab(selectedProgram, selectedChecklistId, busyKey);
    } else if (editorTab === 'archived') {
      tabContent = renderArchivedTab(selectedProgram, busyKey);
    } else {
      tabContent = renderLessonsTab(selectedProgram, selectedLessonId, busyKey);
    }
  }

  return `
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start">
          <div>
            <h2 class="h5 mb-1">Quản lý chương trình mẫu</h2>
            <p class="text-secondary mb-0">
              Bạn đang sửa mẫu chung. Mọi lớp đang dùng chương trình này sẽ bị ảnh hưởng ngay sau khi lưu.
            </p>
          </div>
          <span class="badge text-bg-warning text-dark">Template live</span>
        </div>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-12 col-xl-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-header bg-white border-0">
            <h3 class="h6 mb-0">Danh sách chương trình</h3>
          </div>
          <div class="card-body">
            <div class="curriculum-program-list">
              ${renderProgramList(programGroups, selectedProgramId)}
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-xl-9">
        ${renderProgramOverview(selectedProgram)}
        ${
          selectedProgram
            ? `
              <div class="curriculum-live-warning mt-4">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Bạn đang sửa mẫu chung của <strong>${escapeHtml(selectedProgram.name)}</strong>. Sau khi lưu, mọi lớp đang dùng chương trình này sẽ thấy nội dung mới ngay.
              </div>
              <div class="mt-4">
                ${renderProgramEditorTabs(selectedProgram, editorTab)}
              </div>
              <div class="mt-4">
                ${tabContent}
              </div>
            `
            : ''
        }
      </div>
    </div>
  `;
}

function renderCurriculumPage(state) {
  const classes = getOperationalClasses(state.classes);
  const programGroups = getCurriculumProgramGroups(state.programs);
  const selectedClass = classes.find((item) => item.classCode === state.selectedClassCode) || null;
  const assignment = selectedClass ? state.draftsByClassCode[selectedClass.classCode] || null : null;
  const previewProgram =
    state.programs.find((program) => program.id === (assignment?.programId || '')) || null;

  return `
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start">
          <div>
            <h1 class="h5 mb-1">Học liệu theo lớp</h1>
            <p class="text-secondary mb-0">
              Chọn lớp, gán chương trình, buổi hiện tại và pha lớp học rồi lưu trực tiếp vào Firestore để học sinh xem đúng phần ôn tập của lớp mình.
            </p>
          </div>
          <div class="d-flex flex-wrap gap-2">
            <span class="badge text-bg-light text-dark border">Production v2</span>
            <span class="badge text-bg-light text-dark border">Lưu Firestore thật</span>
          </div>
        </div>
      </div>
    </div>

    ${state.error ? `<div class="alert alert-danger mb-4">${escapeHtml(state.error)}</div>` : ''}

    ${
      state.isLoadingClasses || state.isLoadingPrograms
        ? renderLoadingOverlay('Đang tải dữ liệu học liệu...')
        : state.programs.length === 0
          ? renderEmptyState({
              icon: 'journal-richtext',
              title: 'Chưa có chương trình mẫu trong Firestore',
              description: 'Hãy chạy script seed curriculum trước khi gán học liệu hoặc chỉnh lesson cho lớp.',
            })
          : classes.length === 0
            ? renderEmptyState({
                icon: 'collection',
                title: 'Chưa có lớp đang hoạt động',
                description: 'Tạo ít nhất một lớp active để bắt đầu gán chương trình học.',
              })
            : `
              <div class="row g-4 mb-5">
                <div class="col-12 col-xl-4">
                  ${renderAssignmentControls(
                    classes,
                    state.programs,
                    state.selectedClassCode,
                    selectedClass,
                    assignment,
                    state.busyKey === 'save-assignment',
                  )}
                </div>
                <div class="col-12 col-xl-8">
                  ${renderPreviewPanel(selectedClass, assignment, previewProgram)}
                </div>
              </div>
            `
    }

    ${renderProgramManagement(
      programGroups,
      state.selectedProgramId,
      state.editorTab,
      state.selectedLessonId,
      state.selectedChecklistId,
      state.busyKey,
    )}
  `;
}

function renderCompactAssignmentControls(classes, programs, selectedClassCode, classItem, assignment, isSaving = false) {
  const selectedProgramId = assignment?.programId || '';
  const selectedProgram = programs.find((program) => program.id === selectedProgramId) || null;
  const maxSession = selectedProgram?.totalSessionCount || 1;
  const hasSavedConfig = hasSavedCurriculumAssignment(classItem);
  const isDirty = isDraftDifferentFromSaved(classItem, assignment);
  const statusLabel = !hasSavedConfig
    ? 'Chưa lưu'
    : isDirty
      ? 'Có thay đổi'
      : 'Đã lưu';
  const statusClass = hasSavedConfig && !isDirty
    ? 'text-bg-success-subtle text-success-emphasis border'
    : 'text-bg-light text-dark border';
  const finalModeNote =
    assignment?.curriculumPhase === 'final' && selectedProgram?.finalMode === 'exam'
      ? 'Lớp này đang ở pha kiểm tra cuối khóa nên trang học sinh sẽ không hiện form báo cáo sản phẩm.'
      : '';

  return `
    <div class="card border-0 shadow-sm h-100 curriculum-admin-card">
      <div class="card-header bg-white border-0 d-flex justify-content-between gap-2 align-items-center">
        <h2 class="h6 mb-0">Gán cho lớp</h2>
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
                    <option value="${sessionNumber}" ${sessionNumber === assignment.currentSession ? 'selected' : ''}>
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
              <option value="learning" ${assignment.curriculumPhase === 'learning' ? 'selected' : ''}>Học kiến thức</option>
              <option value="final" ${assignment.curriculumPhase === 'final' ? 'selected' : ''}>Giai đoạn cuối khóa</option>
            </select>
          </div>
        </div>
        <div class="curriculum-compact-note mt-3">
          Gợi ý chương trình đang lấy theo tên lớp và mã lớp.
        </div>
        ${finalModeNote ? `<div class="curriculum-compact-note mt-2">${escapeHtml(finalModeNote)}</div>` : ''}
      </div>
      <div class="card-footer bg-white border-0 pt-0">
        <button
          type="button"
          class="btn btn-primary w-100"
          data-action="save-assignment"
          ${isSaving ? 'disabled' : ''}
        >
          ${
            isSaving
              ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang lưu...'
              : '<i class="bi bi-save me-2"></i>Lưu cấu hình lớp'
          }
        </button>
      </div>
    </div>
  `;
}

function renderCompactProgramManagement(programGroups, selectedProgramId, editorTab, selectedLessonId, selectedChecklistId, busyKey) {
  const selectedProgram = programGroups
    .flatMap((group) => group.programs)
    .find((program) => program.id === selectedProgramId);

  if (programGroups.length === 0) {
    return `
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="alert alert-warning mb-0">
            Chưa có chương trình mẫu trong Firestore. Hãy chạy script seed curriculum để tiếp tục.
          </div>
        </div>
      </div>
    `;
  }

  let tabContent = '';

  if (selectedProgram) {
    if (editorTab === 'final') {
      tabContent = renderFinalTab(selectedProgram, selectedChecklistId, busyKey);
    } else if (editorTab === 'archived') {
      tabContent = renderArchivedTab(selectedProgram, busyKey);
    } else {
      tabContent = renderLessonsTab(selectedProgram, selectedLessonId, busyKey);
    }
  }

  return `
    <section class="curriculum-section">
      <div class="curriculum-section-head">
        <div>
          <h2 class="h5 mb-1">Quản lý chương trình mẫu</h2>
          ${selectedProgram ? `<div class="small text-secondary">${escapeHtml(selectedProgram.name)}</div>` : ''}
        </div>
        ${selectedProgram ? '<span class="badge text-bg-warning text-dark">Sửa template live</span>' : ''}
      </div>

      ${selectedProgram ? '<div class="curriculum-compact-note mb-3">Sau khi lưu, mọi lớp đang dùng chương trình này sẽ thấy nội dung mới ngay.</div>' : ''}

      <div class="row g-3">
        <div class="col-12 col-xl-3">
          <div class="card border-0 shadow-sm h-100 curriculum-admin-card">
            <div class="card-header bg-white border-0">
              <h3 class="h6 mb-0">Danh sách chương trình</h3>
            </div>
            <div class="card-body">
              <div class="curriculum-program-list">
                ${renderProgramListCompact(programGroups, selectedProgramId)}
              </div>
            </div>
          </div>
        </div>
        <div class="col-12 col-xl-9">
          ${renderProgramOverview(selectedProgram)}
          ${
            selectedProgram
              ? `
                <div class="mt-3">
                  ${renderProgramEditorTabs(selectedProgram, editorTab)}
                </div>
                <div class="mt-3">
                  ${tabContent}
                </div>
              `
              : ''
          }
        </div>
      </div>
    </section>
  `;
}

function renderCompactCurriculumPage(state) {
  const classes = getOperationalClasses(state.classes);
  const programGroups = getCurriculumProgramGroups(state.programs);
  const selectedClass = classes.find((item) => item.classCode === state.selectedClassCode) || null;
  const assignment = selectedClass ? state.draftsByClassCode[selectedClass.classCode] || null : null;
  const previewProgram =
    state.programs.find((program) => program.id === (assignment?.programId || '')) || null;

  return `
    ${state.error ? `<div class="alert alert-danger mb-3">${escapeHtml(state.error)}</div>` : ''}

    ${
      state.isLoadingClasses || state.isLoadingPrograms
        ? renderLoadingOverlay('Đang tải dữ liệu học liệu...')
        : state.programs.length === 0
          ? renderEmptyState({
              icon: 'journal-richtext',
              title: 'Chưa có chương trình mẫu trong Firestore',
              description: 'Hãy chạy script seed curriculum trước khi gán học liệu hoặc chỉnh lesson cho lớp.',
            })
          : classes.length === 0
            ? renderEmptyState({
                icon: 'collection',
                title: 'Chưa có lớp đang hoạt động',
                description: 'Tạo ít nhất một lớp active để bắt đầu gán chương trình học.',
              })
            : `
              <section class="curriculum-section mb-4">
                <div class="row g-3 curriculum-page-grid">
                  <div class="col-12 col-xl-4">
                    ${renderCompactAssignmentControls(
                      classes,
                      state.programs,
                      state.selectedClassCode,
                      selectedClass,
                      assignment,
                      state.busyKey === 'save-assignment',
                    )}
                  </div>
                  <div class="col-12 col-xl-8">
                    ${renderPreviewPanel(selectedClass, assignment, previewProgram)}
                  </div>
                </div>
              </section>
            `
    }

    ${renderCompactProgramManagement(
      programGroups,
      state.selectedProgramId,
      state.editorTab,
      state.selectedLessonId,
      state.selectedChecklistId,
      state.busyKey,
    )}
  `;
}

function renderCompactAssignmentControlsV2(classes, programs, selectedClassCode, classItem, assignment, isSaving = false) {
  const selectedProgramId = assignment?.programId || '';
  const selectedProgram = programs.find((program) => program.id === selectedProgramId) || null;
  const maxSession = selectedProgram?.totalSessionCount || 1;
  const currentSession = assignment?.currentSession || 1;
  const currentPhase = assignment?.curriculumPhase || 'learning';
  const hasSavedConfig = hasSavedCurriculumAssignment(classItem);
  const isDirty = isDraftDifferentFromSaved(classItem, assignment);
  const statusLabel = !hasSavedConfig ? 'Chưa lưu' : isDirty ? 'Có thay đổi' : 'Đã lưu';
  const statusClass = hasSavedConfig && !isDirty
    ? 'text-bg-success-subtle text-success-emphasis border'
    : 'text-bg-light text-dark border';
  const finalModeNote =
    currentPhase === 'final' && selectedProgram?.finalMode === 'exam'
      ? 'Lớp này đang ở pha kiểm tra cuối khóa nên trang học sinh sẽ không hiển thị form báo cáo sản phẩm.'
      : '';

  return `
    <div class="card border-0 shadow-sm h-100 curriculum-admin-card">
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
          Hệ thống đang tự gợi ý chương trình theo tên lớp và mã lớp.
        </div>
        ${finalModeNote ? `<div class="curriculum-compact-note mt-2">${escapeHtml(finalModeNote)}</div>` : ''}
      </div>
      <div class="card-footer bg-white border-0 pt-0">
        <button
          type="button"
          class="btn btn-primary w-100"
          data-action="save-assignment"
          ${isSaving ? 'disabled' : ''}
        >
          ${
            isSaving
              ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang lưu...'
              : '<i class="bi bi-save me-2"></i>Lưu cấu hình lớp'
          }
        </button>
      </div>
    </div>
  `;
}

function renderCompactProgramManagementV2(programGroups, selectedProgramId, editorTab, selectedLessonId, selectedChecklistId, busyKey) {
  const selectedProgram = programGroups
    .flatMap((group) => group.programs)
    .find((program) => program.id === selectedProgramId);

  if (programGroups.length === 0) {
    return `
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="alert alert-warning mb-0">
            Chưa có chương trình mẫu trong Firestore. Hãy chạy script seed curriculum để tiếp tục.
          </div>
        </div>
      </div>
    `;
  }

  let tabContent = '';

  if (selectedProgram) {
    if (editorTab === 'final') {
      tabContent = renderFinalTab(selectedProgram, selectedChecklistId, busyKey);
    } else if (editorTab === 'archived') {
      tabContent = renderArchivedTab(selectedProgram, busyKey);
    } else {
      tabContent = renderLessonsTab(selectedProgram, selectedLessonId, busyKey);
    }
  }

  return `
    <div class="curriculum-management-shell">
      <div class="curriculum-management-topbar">
        <div>
          <div class="text-uppercase small fw-semibold text-secondary mb-1">Chương trình đang chọn</div>
          ${
            selectedProgram
              ? `<h2 class="h5 mb-0">${escapeHtml(selectedProgram.name)}</h2>`
              : '<h2 class="h5 mb-0">Chọn một chương trình để bắt đầu chỉnh sửa</h2>'
          }
        </div>
        ${
          selectedProgram
            ? '<span class="badge text-bg-warning-subtle text-dark border">Ảnh hưởng mọi lớp đang dùng</span>'
            : ''
        }
      </div>

      ${
        selectedProgram
          ? '<div class="curriculum-compact-note mb-3">Sau khi lưu, nội dung mới sẽ áp dụng ngay cho các lớp đang dùng chương trình này.</div>'
          : ''
      }

      <div class="row g-3">
        <div class="col-12 col-xl-3">
          <div class="card border-0 shadow-sm h-100 curriculum-admin-card">
            <div class="card-header bg-white border-0">
              <h3 class="h6 mb-0">Danh sách chương trình</h3>
            </div>
            <div class="card-body">
              <div class="curriculum-program-list">
                ${renderProgramList(programGroups, selectedProgramId)}
              </div>
            </div>
          </div>
        </div>
        <div class="col-12 col-xl-9">
          ${renderProgramOverview(selectedProgram)}
          ${
            selectedProgram
              ? `
                <div class="mt-3">
                  ${renderProgramEditorTabs(selectedProgram, editorTab)}
                </div>
                <div class="mt-3">
                  ${tabContent}
                </div>
              `
              : ''
          }
        </div>
      </div>
    </div>
  `;
}

function renderCompactCurriculumPageV2(state) {
  const classes = getOperationalClasses(state.classes);
  const programGroups = getCurriculumProgramGroups(state.programs);
  const selectedClass = classes.find((item) => item.classCode === state.selectedClassCode) || null;
  const assignment = selectedClass ? state.draftsByClassCode[selectedClass.classCode] || null : null;
  const previewProgram =
    state.programs.find((program) => program.id === (assignment?.programId || '')) || null;

  return `
    ${state.error ? `<div class="alert alert-danger mb-3">${escapeHtml(state.error)}</div>` : ''}

    ${
      state.isLoadingClasses || state.isLoadingPrograms
        ? renderLoadingOverlay('Đang tải dữ liệu học liệu...')
        : state.programs.length === 0
          ? renderEmptyState({
              icon: 'journal-richtext',
              title: 'Chưa có chương trình mẫu trong Firestore',
              description: 'Hãy chạy script seed curriculum trước khi gán học liệu hoặc chỉnh lesson cho lớp.',
            })
          : classes.length === 0
            ? renderEmptyState({
                icon: 'collection',
                title: 'Chưa có lớp đang hoạt động',
                description: 'Tạo ít nhất một lớp active để bắt đầu gán chương trình học.',
              })
            : `
              <section class="curriculum-workspace curriculum-workspace--assignment">
                <div class="curriculum-workspace__head">
                  <div class="curriculum-workspace__eyebrow">Bước 1</div>
                  <h2 class="h4 mb-1">Gán học liệu cho lớp</h2>
                  <p class="curriculum-workspace__hint mb-0">Chọn lớp, lưu cấu hình hiển thị rồi mới chuyển sang phần chỉnh sửa nội dung mẫu nếu cần.</p>
                </div>
                <div class="curriculum-workspace__body">
                  <div class="row g-3 curriculum-page-grid">
                    <div class="col-12 col-xl-4">
                      ${renderCompactAssignmentControlsV2(
                        classes,
                        state.programs,
                        state.selectedClassCode,
                        selectedClass,
                        assignment,
                        state.busyKey === 'save-assignment',
                      )}
                    </div>
                    <div class="col-12 col-xl-8">
                      ${renderPreviewPanel(selectedClass, assignment, previewProgram)}
                    </div>
                  </div>
                </div>
              </section>
            `
    }

    <section class="curriculum-workspace curriculum-workspace--editor">
      <div class="curriculum-workspace__head">
        <div class="curriculum-workspace__eyebrow">Bước 2</div>
        <h2 class="h4 mb-1">Chỉnh sửa chương trình mẫu</h2>
      </div>
      <div class="curriculum-workspace__body">
        ${renderCompactProgramManagementV2(
          programGroups,
          state.selectedProgramId,
          state.editorTab,
          state.selectedLessonId,
          state.selectedChecklistId,
          state.busyKey,
        )}
      </div>
    </section>
  `;
}

function renderCompactAssignmentControlsV3(classes, programs, selectedClassCode, classItem, assignment, isSaving = false) {
  const selectedProgramId = assignment?.programId || '';
  const selectedProgram = programs.find((program) => program.id === selectedProgramId) || null;
  const maxSession = selectedProgram?.totalSessionCount || 1;
  const currentSession = assignment?.currentSession || 1;
  const currentPhase = assignment?.curriculumPhase || 'learning';
  const currentLesson =
    getActiveCurriculumLessons(selectedProgram).find((lesson) => Number(lesson.sessionNumber || 0) === currentSession) ||
    null;
  const hasExerciseContent = Boolean(getLessonMarkdownSource(currentLesson, LESSON_MARKDOWN_TAB_EXERCISE));
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

function renderSessionActivityPanel(program, selectedSessionNumber = 1, busyKey = '') {
  if (!program) {
    return '';
  }

  const sessions = getCurriculumSessionActivities(program);
  const selectedActivity = getCurriculumSessionActivity(program, selectedSessionNumber);
  const lessonPreviewPath = buildAdminLessonPreviewPath(program.id, selectedActivity.sessionNumber);
  const quizPreviewPath = buildAdminQuizPreviewPath(program.id, selectedActivity.sessionNumber);

  return `
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-header bg-white border-0">
        <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start">
          <div>
            <h3 class="h6 mb-1">Thiết lập loại buổi</h3>
            <p class="text-secondary mb-0">Buổi 5 và 9 mặc định là kiểm tra. Các buổi khác có thể đổi giữa học kiến thức và kiểm tra khi cần.</p>
          </div>
          <span class="badge text-bg-light text-dark border">Theo từng chương trình</span>
        </div>
      </div>
      <div class="card-body">
        <form id="curriculum-session-activity-form" class="row g-3 align-items-end">
          <div class="col-12 col-md-4">
            <label class="form-label">Buổi</label>
            <select class="form-select" name="activitySessionNumber">
              ${sessions
                .map(
                  (item) => `
                    <option value="${item.sessionNumber}" ${item.sessionNumber === selectedActivity.sessionNumber ? 'selected' : ''}>
                      Buổi ${item.sessionNumber} - ${escapeHtml(getCurriculumActivityTypeLabel(item.activityType))}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </div>
          <div class="col-12 col-md-5">
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
          <div class="col-12 col-md-3">
            <button type="submit" class="btn btn-primary w-100" ${busyKey === 'save-session-activity' ? 'disabled' : ''}>
              ${
                busyKey === 'save-session-activity'
                  ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang lưu...'
                  : '<i class="bi bi-save me-2"></i>Lưu loại buổi'
              }
            </button>
          </div>
        </form>
        <div class="d-flex flex-wrap gap-2 mt-3">
          <a class="btn btn-outline-secondary btn-sm" href="${escapeHtml(lessonPreviewPath)}" target="_blank" rel="noreferrer">
            <i class="bi bi-journal-richtext me-1"></i>Xem thử học liệu
          </a>
          <a class="btn btn-outline-primary btn-sm" href="${escapeHtml(quizPreviewPath)}" target="_blank" rel="noreferrer">
            <i class="bi bi-play-circle me-1"></i>Test quiz không cần mã lớp
          </a>
        </div>
      </div>
    </div>
  `;
}

function renderCompactProgramManagementV3(
  programGroups,
  selectedProgramId,
  editorTab,
  selectedLessonId,
  selectedChecklistId,
  selectedActivitySessionNumber,
  busyKey,
) {
  const selectedProgram = programGroups
    .flatMap((group) => group.programs)
    .find((program) => program.id === selectedProgramId);
  const cloudinaryReady = isCloudinaryConfigured();

  if (programGroups.length === 0) {
    return `
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="alert alert-warning mb-0">
            Chưa có chương trình mẫu trong Firestore. Hãy chạy script seed curriculum để tiếp tục.
          </div>
        </div>
      </div>
    `;
  }

  let tabContent = '';

  if (selectedProgram) {
    if (editorTab === 'final') {
      tabContent = renderFinalTab(selectedProgram, selectedChecklistId, busyKey);
    } else if (editorTab === 'archived') {
      tabContent = renderArchivedTab(selectedProgram, busyKey);
    } else {
      tabContent = renderLessonsTabV3(selectedProgram, selectedLessonId, busyKey, cloudinaryReady);
    }
  }

  return `
    <div class="curriculum-management-shell curriculum-management-shell--compact">
      <div class="curriculum-management-topbar curriculum-management-topbar--compact">
        <div>
          ${
            selectedProgram
              ? `<h2 class="h5 mb-0">${escapeHtml(selectedProgram.name)}</h2>`
              : '<h2 class="h5 mb-0">Chọn một chương trình để chỉnh sửa</h2>'
          }
        </div>
        ${
          selectedProgram
            ? '<span class="badge text-bg-warning-subtle text-dark border">Ảnh hưởng các lớp đang dùng</span>'
            : ''
        }
      </div>

      <div class="row g-3">
        <div class="col-12 col-xl-3">
          <div class="card border-0 shadow-sm h-100 curriculum-admin-card curriculum-admin-card--compact">
            <div class="card-header bg-white border-0">
              <h3 class="h6 mb-0">Chương trình</h3>
            </div>
            <div class="card-body">
              <div class="curriculum-program-list">
                ${renderProgramListCompact(programGroups, selectedProgramId)}
              </div>
            </div>
          </div>
        </div>
        <div class="col-12 col-xl-9">
          ${renderProgramOverview(selectedProgram)}
          ${
            selectedProgram
              ? `
                ${QUIZ_UI_ENABLED ? renderSessionActivityPanel(selectedProgram, selectedActivitySessionNumber, busyKey) : ''}
                <div class="mt-2">
                  ${renderProgramEditorTabs(selectedProgram, editorTab)}
                </div>
                <div class="mt-2">
                  ${tabContent}
                </div>
              `
              : ''
          }
        </div>
      </div>
    </div>
  `;
}

function renderCurriculumWorkspaceSwitch(activeSection) {
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
      ${
        QUIZ_UI_ENABLED
          ? `
            <button
              type="button"
              class="curriculum-workspace-switch__button ${activeSection === 'quiz' ? 'curriculum-workspace-switch__button--active' : ''}"
              data-action="switch-workspace"
              data-workspace="quiz"
            >
              <i class="bi bi-bar-chart-steps me-2"></i>Điều khiển & thống kê
            </button>
          `
          : ''
      }
    </div>
  `;
}

function findLessonBySession(program, sessionNumber) {
  const normalizedSessionNumber = Number(sessionNumber || 0);
  return (
    getActiveCurriculumLessons(program).find(
      (lesson) => Number(lesson.sessionNumber || 0) === normalizedSessionNumber,
    ) || null
  );
}

function getLessonDraftForSession(program, sessionNumber) {
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

function renderCurriculumContextBar(classes, programs, selectedClassCode, classItem, assignment, isSaving = false) {
  const selectedProgramId = assignment?.programId || '';
  const selectedProgram = programs.find((program) => program.id === selectedProgramId) || null;
  const maxSession = selectedProgram?.totalSessionCount || 1;
  const currentSession = Number(assignment?.currentSession || 1);
  const currentPhase = assignment?.curriculumPhase || 'learning';
  const hasSavedConfig = hasSavedCurriculumAssignment(classItem);
  const isDirty = isDraftDifferentFromSaved(classItem, assignment);
  const statusLabel = !hasSavedConfig ? 'Chưa lưu' : isDirty ? 'Có thay đổi' : 'Đã lưu';
  const statusClass = hasSavedConfig && !isDirty
    ? 'text-bg-success-subtle text-success-emphasis border'
    : 'text-bg-light text-dark border';
  const publicLibraryPath = selectedClassCode ? buildPublicLibraryPath(selectedClassCode) : '';

  return `
    <section class="curriculum-redesign-context card border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
          <div>
            <div class="text-uppercase small fw-bold text-secondary mb-1">Lớp đang thao tác</div>
            <h2 class="h5 mb-1">${escapeHtml(classItem?.classCode || 'Chưa chọn lớp')}</h2>
            <p class="text-secondary mb-0">Chọn lớp, chương trình và buổi hiện tại ở một chỗ rồi bấm lưu.</p>
          </div>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <span class="badge ${statusClass}">${escapeHtml(statusLabel)}</span>
            ${
              publicLibraryPath
                ? `
                  <a class="btn btn-outline-secondary btn-sm" href="${escapeHtml(publicLibraryPath)}" target="_blank" rel="noreferrer">
                    <i class="bi bi-box-arrow-up-right me-1"></i>Xem học liệu của lớp
                  </a>
                `
                : ''
            }
            <button
              type="button"
              class="btn btn-primary btn-sm"
              data-action="save-assignment"
              ${isSaving ? 'disabled' : ''}
            >
              ${
                isSaving
                  ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang lưu...'
                  : '<i class="bi bi-save me-1"></i>Lưu cấu hình lớp'
              }
            </button>
          </div>
        </div>
        <div class="row g-3 align-items-end">
          <div class="col-12 col-xl-4">
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
          <div class="col-12 col-xl-4">
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
          <div class="col-12 col-md-6 col-xl-2">
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
          <div class="col-12 col-md-6 col-xl-2">
            <label class="form-label">Giai đoạn</label>
            <select class="form-select" name="previewPhase">
              <option value="learning" ${currentPhase === 'learning' ? 'selected' : ''}>Học kiến thức</option>
              <option value="final" ${currentPhase === 'final' ? 'selected' : ''}>Giai đoạn cuối khóa</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderCurriculumSessionRail(program, selectedSessionNumber, assignment = null) {
  if (!program) {
    return '';
  }

  const sessions = getCurriculumSessionActivities(program);
  const activeLessons = getActiveCurriculumLessons(program);
  const currentSession = Number(assignment?.currentSession || 0);

  return `
    <aside class="curriculum-session-rail card border-0 shadow-sm">
      <div class="card-header bg-white border-0">
        <div class="d-flex justify-content-between align-items-center gap-2">
          <div>
            <h3 class="h6 mb-1">Buổi học</h3>
            <div class="small text-secondary">Bấm một buổi để sửa nội dung hoặc đề kiểm tra.</div>
          </div>
          <span class="badge text-bg-light text-dark border">${sessions.length}</span>
        </div>
      </div>
      <div class="card-body">
        <div class="curriculum-session-rail__list">
          ${sessions
            .map((session) => {
              const sessionNumber = Number(session.sessionNumber || 0);
              const lesson = activeLessons.find((item) => Number(item.sessionNumber || 0) === sessionNumber) || null;
              const isSelected = sessionNumber === Number(selectedSessionNumber || 0);
              const isCurrent = sessionNumber === currentSession;
              const isQuiz = isCurriculumQuizActivity(session.activityType);
              const title = isQuiz
                ? 'Kiểm tra chính thức'
                : lesson?.title || 'Chưa có bài giảng';

              return `
                <button
                  type="button"
                  class="curriculum-session-rail__item ${isSelected ? 'curriculum-session-rail__item--active' : ''}"
                  data-action="select-curriculum-session"
                  data-session-number="${sessionNumber}"
                >
                  <span class="curriculum-session-rail__top">
                    <strong>Buổi ${sessionNumber}</strong>
                    ${isCurrent ? '<span class="badge text-bg-primary">Hiện tại</span>' : ''}
                  </span>
                  <span class="curriculum-session-rail__title">${escapeHtml(title)}</span>
                  <span class="curriculum-session-rail__meta">
                    <i class="bi bi-${isQuiz ? 'patch-question' : 'journal-richtext'} me-1"></i>${escapeHtml(getCurriculumActivityTypeLabel(session.activityType))}
                  </span>
                </button>
              `;
            })
            .join('')}
        </div>
      </div>
    </aside>
  `;
}

function renderSessionActivityInlineForm(program, selectedSessionNumber, busyKey = '') {
  if (!program || !QUIZ_UI_ENABLED) {
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

function renderLessonActionPanel({
  selectedClassCode,
  assignment,
  program,
  sessionNumber,
  lesson,
}) {
  const hasExerciseContent = Boolean(getLessonMarkdownSource(lesson, LESSON_MARKDOWN_TAB_EXERCISE));
  const exerciseVisible = isCurriculumExerciseVisibleForSession(assignment, sessionNumber);
  const adminPreviewPath = program ? buildAdminLessonPreviewPath(program.id, sessionNumber) : '';
  const publicPreviewPath = selectedClassCode
    ? buildPublicLibraryPath(selectedClassCode, {
        lessonId: lesson?.id || '',
        tab: exerciseVisible && hasExerciseContent ? LESSON_MARKDOWN_TAB_EXERCISE : LESSON_MARKDOWN_TAB_LECTURE,
      })
    : '';

  return `
    <aside class="curriculum-side-panel card border-0 shadow-sm">
      <div class="card-header bg-white border-0">
        <h3 class="h6 mb-1">Gán cho lớp</h3>
        <div class="small text-secondary">Các thao tác ảnh hưởng riêng lớp đang chọn.</div>
      </div>
      <div class="card-body">
        <div class="curriculum-side-panel__section">
          <div class="d-flex flex-wrap justify-content-between gap-2 align-items-center">
            <div>
              <div class="fw-semibold">Bài tập buổi ${Number(sessionNumber || 0)}</div>
              <div class="small text-secondary">
                ${hasExerciseContent ? 'Bật để học sinh thấy tab Bài tập.' : 'Buổi này chưa có nội dung Bài tập.'}
              </div>
            </div>
            <div class="form-check form-switch mb-0">
              <input
                class="form-check-input"
                type="checkbox"
                role="switch"
                id="assignment-exercise-visible"
                name="previewExerciseVisible"
                data-session-number="${Number(sessionNumber || 0)}"
                ${exerciseVisible && hasExerciseContent ? 'checked' : ''}
                ${hasExerciseContent ? '' : 'disabled'}
              >
              <label class="form-check-label" for="assignment-exercise-visible">
                ${exerciseVisible && hasExerciseContent ? 'Đang hiện' : 'Đang ẩn'}
              </label>
            </div>
          </div>
        </div>
        <div class="curriculum-side-panel__section">
          <div class="d-grid gap-2">
            ${
              adminPreviewPath
                ? `
                  <a class="btn btn-outline-primary" href="${escapeHtml(adminPreviewPath)}" target="_blank" rel="noreferrer">
                    <i class="bi bi-eye me-2"></i>Xem thử buổi này
                  </a>
                `
                : ''
            }
            ${
              publicPreviewPath
                ? `
                  <a class="btn btn-outline-secondary" href="${escapeHtml(publicPreviewPath)}" target="_blank" rel="noreferrer">
                    <i class="bi bi-person-video3 me-2"></i>Xem như học sinh
                  </a>
                `
                : ''
            }
          </div>
        </div>
        <div class="curriculum-side-panel__section">
          <div class="quiz-status-meta">
            <div class="quiz-status-meta__label">Buổi đang sửa</div>
            <div class="fw-semibold">Buổi ${Number(sessionNumber || 0)}</div>
            <div class="small text-secondary mt-1">${escapeHtml(lesson?.title || 'Chưa có tiêu đề')}</div>
          </div>
        </div>
      </div>
    </aside>
  `;
}

function renderQuizActionPanel(program, sessionNumber) {
  const adminQuizPreviewPath = program ? buildAdminQuizPreviewPath(program.id, sessionNumber) : '';

  return `
    <aside class="curriculum-side-panel card border-0 shadow-sm">
      <div class="card-header bg-white border-0">
        <h3 class="h6 mb-1">Kiểm tra</h3>
        <div class="small text-secondary">Bộ đề dùng theo môn + level + buổi.</div>
      </div>
      <div class="card-body">
        <div class="curriculum-side-panel__section">
          <div class="quiz-status-meta">
            <div class="quiz-status-meta__label">Ngân hàng</div>
            <div class="fw-semibold">${escapeHtml(program?.subject || 'Chưa rõ môn')} · ${escapeHtml(program?.level || 'Chưa rõ level')}</div>
            <div class="small text-secondary mt-1">Buổi ${Number(sessionNumber || 0)} · Random 4 dễ, 4 trung bình, 2 khó.</div>
          </div>
        </div>
        <div class="curriculum-side-panel__section">
          <div class="d-grid gap-2">
            ${
              adminQuizPreviewPath
                ? `
                  <a class="btn btn-outline-primary" href="${escapeHtml(adminQuizPreviewPath)}" target="_blank" rel="noreferrer">
                    <i class="bi bi-play-circle me-2"></i>Test quiz admin
                  </a>
                `
                : ''
            }
          </div>
        </div>
        <div class="curriculum-side-panel__section">
          <div class="curriculum-compact-note">
            Soạn đề ở khung chính. Phần điều khiển bắt đầu, kết thúc và bài nộp nằm ngay bên dưới editor để không phải chuyển trang.
          </div>
        </div>
      </div>
    </aside>
  `;
}

function renderSelectedSessionWorkspace({
  program,
  selectedClassCode,
  assignment,
  selectedSessionNumber,
  busyKey,
}) {
  const activity = getCurriculumSessionActivity(program, selectedSessionNumber);
  const isQuizSession = QUIZ_UI_ENABLED && isCurriculumQuizActivity(activity.activityType);
  const cloudinaryReady = isCloudinaryConfigured();
  const lesson = getLessonDraftForSession(program, selectedSessionNumber);

  if (isQuizSession) {
    return `
      <div class="curriculum-main-panel card border-0 shadow-sm">
        <div class="card-header bg-white border-0">
          <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div>
              <div class="text-uppercase small fw-bold text-secondary mb-1">Buổi ${Number(selectedSessionNumber || 0)}</div>
              <h3 class="h5 mb-1">Kiểm tra trắc nghiệm</h3>
              <p class="text-secondary mb-0">Soạn ngân hàng câu hỏi và điều khiển bài kiểm tra ngay trong học liệu.</p>
            </div>
            ${renderSessionActivityInlineForm(program, selectedSessionNumber, busyKey)}
          </div>
        </div>
        <div class="card-body">
          ${renderQuizManagementContent({ hideTabs: true, showBothPanels: true })}
        </div>
      </div>
      ${renderQuizActionPanel(program, selectedSessionNumber)}
    `;
  }

  return `
    <div class="curriculum-main-panel card border-0 shadow-sm">
      <div class="card-header bg-white border-0">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <div class="text-uppercase small fw-bold text-secondary mb-1">Buổi ${Number(selectedSessionNumber || 0)}</div>
            <h3 class="h5 mb-1">Bài giảng và bài tập</h3>
            <p class="text-secondary mb-0">Soạn nội dung học sinh sẽ xem trong trang học liệu.</p>
          </div>
          ${renderSessionActivityInlineForm(program, selectedSessionNumber, busyKey)}
        </div>
      </div>
      <div class="card-body">
        ${renderLessonFormV3(program, lesson, busyKey, cloudinaryReady)}
      </div>
    </div>
    ${renderLessonActionPanel({
      selectedClassCode,
      assignment,
      program,
      sessionNumber: selectedSessionNumber,
      lesson,
    })}
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

function renderAssignmentWorkspaceSimple(classes, programs, selectedClassCode, selectedClass, assignment, state) {
  return `
    <section class="curriculum-workspace curriculum-workspace--assignment curriculum-workspace--compact">
      <div class="curriculum-workspace__head curriculum-workspace__head--compact">
        <div class="curriculum-workspace__eyebrow">Gán cho lớp</div>
        <h2 class="h5 mb-1">Chỉ chọn lớp, chương trình và buổi hiện tại</h2>
      </div>
      <div class="curriculum-workspace__body">
        <div class="row g-3">
          <div class="col-12 col-xl-4">
            ${renderCompactAssignmentControlsV3(
              classes,
              programs,
              selectedClassCode,
              selectedClass,
              assignment,
              state.busyKey === 'save-assignment',
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

function renderArchivedLessonVault(program, busyKey = '') {
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

function renderSessionPickerStrip(program, selectedSessionNumber, assignment = null) {
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
          const isQuiz = QUIZ_UI_ENABLED && isCurriculumQuizActivity(session.activityType);
          const lesson = activeLessons.find((item) => Number(item.sessionNumber || 0) === sessionNumber) || null;
          const activityLabel = QUIZ_UI_ENABLED
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

function renderContentWorkspaceHorizontal(
  programGroups,
  selectedProgramId,
  selectedSessionNumber,
  busyKey,
  editorTab = 'lessons',
  assignment = null,
) {
  const selectedProgram = programGroups.flatMap((group) => group.programs).find((program) => program.id === selectedProgramId) || null;
  const selectedActivity = selectedProgram ? getCurriculumSessionActivity(selectedProgram, selectedSessionNumber) : null;
  const isQuizSession = QUIZ_UI_ENABLED && isCurriculumQuizActivity(selectedActivity?.activityType);
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
          ? buildAdminQuizPreviewPath(selectedProgram.id, selectedSessionNumber)
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
                      ${renderSessionPickerStrip(selectedProgram, selectedSessionNumber, assignment)}
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
                              ${renderSessionActivityInlineForm(selectedProgram, selectedSessionNumber, busyKey)}
                              ${
                                previewPath
                                  ? `
                                    <a class="btn btn-outline-secondary" href="${escapeHtml(previewPath)}" target="_blank" rel="noreferrer">
                                      <i class="bi bi-eye me-2"></i>${isQuizSession ? 'Test quiz' : 'Xem thử'}
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
                              ? renderQuizManagementContent({ hideTabs: true })
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

function renderQuizOperationsWorkspace(programGroups, selectedProgramId, selectedSessionNumber) {
  const selectedProgram = programGroups.flatMap((group) => group.programs).find((program) => program.id === selectedProgramId) || null;

  return `
    <section class="curriculum-workspace curriculum-workspace--editor curriculum-workspace--compact">
      <div class="curriculum-workspace__head curriculum-workspace__head--compact">
        <div class="curriculum-workspace__eyebrow">Điều khiển & thống kê</div>
        <h2 class="h5 mb-1">Mở bài kiểm tra và xem kết quả</h2>
      </div>
      <div class="curriculum-workspace__body">
        <div class="d-grid gap-3">
          ${renderProgramPickerBar(programGroups, selectedProgramId)}
          ${selectedProgram ? renderSessionPickerStrip(selectedProgram, selectedSessionNumber) : ''}
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              ${renderQuizManagementContent({ hideTabs: true })}
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderCompactCurriculumPageV3(state) {
  const classes = getOperationalClasses(state.classes);
  const programGroups = getCurriculumProgramGroups(state.programs);
  const selectedClass = classes.find((item) => item.classCode === state.selectedClassCode) || null;
  const assignment = selectedClass ? state.draftsByClassCode[selectedClass.classCode] || null : null;
  const selectedSessionNumber = Math.max(1, Number(state.selectedActivitySessionNumber || assignment?.currentSession || 1));

  return `
    ${state.error ? `<div class="alert alert-danger mb-3">${escapeHtml(state.error)}</div>` : ''}

    ${renderCurriculumWorkspaceSwitch(state.workspaceSection)}

    ${
      state.isLoadingClasses || state.isLoadingPrograms
        ? renderLoadingOverlay('Đang tải dữ liệu học liệu...')
        : state.programs.length === 0
          ? renderEmptyState({
              icon: 'journal-richtext',
              title: 'Chưa có chương trình mẫu trong Firestore',
              description: 'Hãy chạy script seed curriculum trước khi gán học liệu hoặc chỉnh lesson cho lớp.',
            })
          : classes.length === 0
            ? renderEmptyState({
                icon: 'collection',
                title: 'Chưa có lớp đang hoạt động',
                description: 'Tạo ít nhất một lớp active để bắt đầu gán chương trình học.',
              })
            : state.workspaceSection === 'assignment'
              ? renderAssignmentWorkspaceSimple(
                  classes,
                  state.programs,
                  state.selectedClassCode,
                  selectedClass,
                  assignment,
                  state,
                )
              : state.workspaceSection === 'editor'
                ? renderContentWorkspaceHorizontal(
                    programGroups,
                    state.selectedProgramId,
                    selectedSessionNumber,
                    state.busyKey,
                    state.editorTab,
                    assignment,
                  )
                : QUIZ_UI_ENABLED
                  ? renderQuizOperationsWorkspace(
                      programGroups,
                      state.selectedProgramId,
                      selectedSessionNumber,
                    )
                  : ''
    }
  `;
}

export const curriculumDemoPage = {
  title: 'Học liệu',
  async render() {
    const authState = getAuthState();

    return renderAppShell({
      title: 'Học liệu',
      subtitle: '',
      currentRoute: '/admin/curriculum',
      user: authState.user,
      content: '<div id="curriculum-demo-root" class="curriculum-page-root"></div>',
    });
  },
  async mount() {
    const root = document.getElementById('curriculum-demo-root');
    const routeState = getHashRouteState();
    const initialWorkspaceSection = QUIZ_UI_ENABLED && routeState.workspace === 'quiz' ? 'quiz' : 'assignment';
    const initialSessionNumber = initialWorkspaceSection === 'quiz' ? 5 : 1;
    const state = {
      classes: [],
      programs: [],
      isLoadingClasses: true,
      isLoadingPrograms: true,
      error: '',
      selectedProgramId: '',
      selectedLessonId: '',
      selectedChecklistId: '',
      selectedClassCode: '',
      workspaceSection: initialWorkspaceSection,
      editorTab: 'lessons',
      selectedActivitySessionNumber: initialSessionNumber,
      didInitializeActivitySession: false,
      previewLessonId: '',
      previewTab: LESSON_MARKDOWN_TAB_LECTURE,
      previewImageSelections: {},
      draftsByClassCode: {},
      busyKey: '',
    };

    function getSelectedClass() {
      return getOperationalClasses(state.classes).find((item) => item.classCode === state.selectedClassCode) || null;
    }

    function getSelectedProgram() {
      return state.programs.find((item) => item.id === state.selectedProgramId) || null;
    }

    function selectCurriculumSession(sessionNumber) {
      const selectedProgram = getSelectedProgram();
      const sessionLimit = getLessonSessionLimit(selectedProgram);
      const nextSessionNumber = Math.min(
        sessionLimit,
        Math.max(1, Number(sessionNumber || 1)),
      );
      const lesson = findLessonBySession(selectedProgram, nextSessionNumber);

      state.selectedActivitySessionNumber = nextSessionNumber;
      state.selectedLessonId = lesson?.id || 'new';
      state.editorTab = 'lessons';
      const selectedActivity = selectedProgram ? getCurriculumSessionActivity(selectedProgram, nextSessionNumber) : null;
      state.workspaceSection = QUIZ_UI_ENABLED && isCurriculumQuizActivity(selectedActivity?.activityType)
        ? 'quiz'
        : 'editor';
    }

    function replaceProgram(nextProgram) {
      if (!nextProgram) {
        return;
      }

      state.programs = state.programs.map((program) => (program.id === nextProgram.id ? nextProgram : program));
    }

    async function refreshProgram(programId) {
      const freshProgram = await getCurriculumProgram(programId);

      if (freshProgram) {
        replaceProgram(freshProgram);
      }
    }

    function ensureDraftForClass(classItem) {
      if (!classItem || state.programs.length === 0) {
        return null;
      }

      if (!state.draftsByClassCode[classItem.classCode]) {
        state.draftsByClassCode[classItem.classCode] = getInitialDraft(classItem, state.programs);
      }

      return state.draftsByClassCode[classItem.classCode];
    }

    function syncSelectedClass() {
      const classes = getOperationalClasses(state.classes);

      if (classes.length === 0) {
        state.selectedClassCode = '';
        return;
      }

      if (!classes.some((item) => item.classCode === state.selectedClassCode)) {
        state.selectedClassCode = classes[0].classCode;
      }

      const selectedClass = classes.find((item) => item.classCode === state.selectedClassCode) || null;
      const draft = ensureDraftForClass(selectedClass);

      if (!state.selectedProgramId && draft?.programId) {
        state.selectedProgramId = draft.programId;
      }

      if (!state.didInitializeActivitySession && draft?.currentSession) {
        state.didInitializeActivitySession = true;
        state.selectedActivitySessionNumber = Number(draft.currentSession || 1);
      }
    }

    function syncSelectedProgram() {
      if (state.programs.length === 0) {
        state.selectedProgramId = '';
        return;
      }

      const selectedClass = getSelectedClass();
      const selectedDraft = ensureDraftForClass(selectedClass);
      const fallbackProgramId = selectedDraft?.programId || state.programs[0]?.id || '';

      if (!state.programs.some((item) => item.id === state.selectedProgramId)) {
        state.selectedProgramId = fallbackProgramId;
      }

      const selectedProgram = getSelectedProgram();
      const activeLessons = getActiveCurriculumLessons(selectedProgram);
      const activeChecklist = getActiveCurriculumChecklist(selectedProgram);
      const sessionLimit = Math.max(
        1,
        Number(selectedProgram?.totalSessionCount || selectedProgram?.knowledgePhaseEndSession || 1),
      );

      state.selectedActivitySessionNumber = Math.min(
        sessionLimit,
        Math.max(1, Number(state.selectedActivitySessionNumber || 1)),
      );

      const lessonForSelectedSession = findLessonBySession(selectedProgram, state.selectedActivitySessionNumber);
      state.selectedLessonId = lessonForSelectedSession?.id || 'new';

      if (selectedProgram?.finalMode === 'exam') {
        if (
          state.selectedChecklistId !== 'new' &&
          !activeChecklist.some((item) => item.id === state.selectedChecklistId)
        ) {
          state.selectedChecklistId = activeChecklist[0]?.id || 'new';
        }
      } else {
        state.selectedChecklistId = '';
      }
    }

    function getCurrentPreviewContext() {
      const selectedClass = getSelectedClass();
      const assignment = selectedClass ? ensureDraftForClass(selectedClass) : null;
      const previewProgram =
        state.programs.find((program) => program.id === (assignment?.programId || '')) || null;
      const preview = buildPreviewView(selectedClass, assignment, previewProgram);

      return {
        selectedClass,
        assignment,
        previewProgram,
        preview,
      };
    }

    function syncPreviewState() {
      const { preview } = getCurrentPreviewContext();

      state.previewTab = normalizePreviewTab(state.previewTab);

      if (!preview?.visibleLessons?.length) {
        state.previewLessonId = '';
        return;
      }

      state.previewLessonId = getDefaultPreviewLessonId(preview, state.previewLessonId);
    }

    let quizManagementCleanup = null;
    let quizManagementMountToken = 0;

    function cleanupQuizManagement() {
      quizManagementMountToken += 1;
      quizManagementCleanup?.();
      quizManagementCleanup = null;
    }

    function mountEmbeddedQuizManagement() {
      cleanupQuizManagement();

      const selectedProgram = getSelectedProgram();
      const selectedActivity = selectedProgram
        ? getCurriculumSessionActivity(selectedProgram, state.selectedActivitySessionNumber)
        : null;
      const shouldMountQuiz =
        QUIZ_UI_ENABLED
        && selectedProgram
        && (
          state.workspaceSection === 'quiz'
          || (state.workspaceSection === 'editor' && isCurriculumQuizActivity(selectedActivity?.activityType))
        );

      if (!shouldMountQuiz || !document.getElementById('quiz-editor-slot')) {
        return;
      }

      const mountToken = quizManagementMountToken;
      const defaultActiveTab = state.workspaceSection === 'quiz' ? 'operations' : 'editor';

      void mountQuizManagement({
        embedded: true,
        defaultActiveTab,
        forceDefaultTab: true,
        lockedProgramId: selectedProgram.id,
        lockedSessionNumber: state.selectedActivitySessionNumber,
        lockedClassCode: state.selectedClassCode,
        hideTabs: true,
        showBothPanels: false,
      }).then((cleanup) => {
        if (mountToken !== quizManagementMountToken) {
          cleanup?.();
          return;
        }

        quizManagementCleanup = cleanup;
      });
    }

    function renderView() {
      if (!QUIZ_UI_ENABLED && state.workspaceSection === 'quiz') {
        state.workspaceSection = 'editor';
      }

      syncSelectedClass();
      syncSelectedProgram();
      syncPreviewState();
      root.innerHTML = renderCompactCurriculumPageV3(state);
      mountEmbeddedQuizManagement();
    }

    function updateDraftForSelectedClass(patch) {
      const selectedClass = getSelectedClass();

      if (!selectedClass) {
        return;
      }

      const current = ensureDraftForClass(selectedClass);
      const programId = patch.programId || current.programId;
      const program = state.programs.find((item) => item.id === programId) || null;

      state.draftsByClassCode[selectedClass.classCode] = {
        ...current,
        ...patch,
        programId,
        currentSession: clampCurriculumSession(program, patch.currentSession ?? current.currentSession),
        exerciseVisibleSessions: normalizeCurriculumExerciseVisibleSessions(
          patch.exerciseVisibleSessions ?? current.exerciseVisibleSessions,
          program,
        ),
        curriculumPhase:
          patch.curriculumPhase === 'final'
            ? 'final'
            : patch.curriculumPhase === 'learning'
              ? 'learning'
              : current.curriculumPhase,
      };
    }

    let draggingLessonImageId = '';

    root.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');

      if (!button) {
        return;
      }

      const selectedProgram = getSelectedProgram();

      if (button.dataset.action === 'switch-workspace') {
        const allowedWorkspaces = QUIZ_UI_ENABLED ? ['assignment', 'editor', 'quiz'] : ['assignment', 'editor'];
        state.workspaceSection = allowedWorkspaces.includes(button.dataset.workspace)
          ? button.dataset.workspace
          : 'assignment';
        renderView();
        return;
      }

      if (button.dataset.action === 'select-curriculum-session') {
        selectCurriculumSession(button.dataset.sessionNumber || 1);
        renderView();
        return;
      }

      if (button.dataset.action === 'select-assignment-class') {
        state.selectedClassCode = button.dataset.classCode || '';
        state.didInitializeActivitySession = false;
        const selectedClass = getSelectedClass();
        const draft = ensureDraftForClass(selectedClass);

        if (draft?.programId) {
          state.selectedProgramId = draft.programId;
          state.selectedActivitySessionNumber = Number(draft.currentSession || 1);
        }

        renderView();
        return;
      }

      if (button.dataset.action === 'select-library-lesson') {
        state.previewLessonId = button.dataset.lessonId || '';
        renderView();
        return;
      }

      if (button.dataset.action === 'select-library-tab') {
        state.previewTab = normalizePreviewTab(button.dataset.tab);
        renderView();
        return;
      }

      if (button.dataset.action === 'switch-lesson-markdown-tab') {
        const form = button.closest('form');
        const activeTab = normalizeLessonMarkdownTab(button.dataset.markdownTab);

        form?.querySelectorAll('[data-action="switch-lesson-markdown-tab"]').forEach((tabButton) => {
          tabButton.classList.toggle(
            'student-library-tab--active',
            normalizeLessonMarkdownTab(tabButton.dataset.markdownTab) === activeTab,
          );
        });

        form?.querySelectorAll('[data-markdown-pane]').forEach((pane) => {
          pane.classList.toggle(
            'd-none',
            normalizeLessonMarkdownTab(pane.dataset.markdownPane) !== activeTab,
          );
        });

        return;
      }

      if (button.dataset.action === 'go-to-library-neighbor') {
        state.previewLessonId = button.dataset.lessonId || '';
        renderView();
        return;
      }

      if (button.dataset.action === 'select-library-image') {
        const lessonId = button.dataset.lessonId || '';
        const imageId = button.dataset.imageId || '';

        if (!lessonId || !imageId) {
          return;
        }

        state.previewImageSelections = {
          ...state.previewImageSelections,
          [lessonId]: imageId,
        };
        renderView();
        return;
      }

      if (button.dataset.action === 'pick-markdown-file') {
        const form = button.closest('form');
        const markdownTab = normalizeLessonMarkdownTab(button.dataset.markdownTab);
        const fileInput = form?.querySelector(`input[name="${markdownTab}MarkdownFile"]`);
        fileInput?.click();
        return;
      }

      if (button.dataset.action === 'pick-banner-image') {
        const form = button.closest('form');
        const fileInput = form?.querySelector('input[name="bannerImageFile"]');

        if (!isCloudinaryConfigured()) {
          showToast({
            title: 'Cloudinary chưa sẵn sàng',
            message: 'Hãy cấu hình VITE_CLOUDINARY_CLOUD_NAME và VITE_CLOUDINARY_UPLOAD_PRESET trước khi tải banner.',
            variant: 'warning',
          });
          return;
        }

        fileInput?.click();
        return;
      }

      if (button.dataset.action === 'remove-banner-image') {
        const form = button.closest('form');
        setLessonBannerFormStateV3(form, null);
        showToast({
          title: 'Đã xóa banner',
          message: 'Banner sẽ được gỡ khỏi buổi học sau khi bạn bấm lưu.',
          variant: 'success',
        });
        return;
      }

      if (button.dataset.action === 'pick-lesson-image') {
        const form = button.closest('form');
        const fileInput = form?.querySelector('input[name="coverImageFile"]');

        if (!isCloudinaryConfigured()) {
          showToast({
            title: 'Cloudinary chưa sẵn sàng',
            message: 'Hãy cấu hình VITE_CLOUDINARY_CLOUD_NAME và VITE_CLOUDINARY_UPLOAD_PRESET trước khi tải ảnh minh họa.',
            variant: 'warning',
          });
          return;
        }

        fileInput?.click();
        return;
      }

      if (button.dataset.action === 'remove-lesson-image') {
        const form = button.closest('form');
        const imageId = button.dataset.imageId || '';
        const nextImages = imageId
          ? getLessonImagesFromFormV3(form).filter((item) => item.id !== imageId)
          : [];
        setLessonImagesFormStateV3(form, nextImages);
        showToast({
          title: 'Đã xóa ảnh minh họa',
          message: 'Ảnh minh họa sẽ được gỡ khỏi buổi học sau khi bạn bấm lưu.',
          variant: 'success',
        });
        return;
      }
      if (button.dataset.action === 'add-review-link-row') {
        const form = button.closest('form');
        const list = form?.querySelector('#curriculum-review-links-list');

        if (!list) {
          return;
        }

        const emptyState = list.querySelector('.curriculum-link-editor__empty');

        if (emptyState) {
          list.innerHTML = '';
        }

        list.insertAdjacentHTML('beforeend', createReviewLinkRowV3());
        refreshReviewLinkControlsV3(list);
        return;
      }

      if (button.dataset.action === 'remove-review-link') {
        const row = button.closest('.curriculum-link-row');
        const list = row?.parentElement;
        row?.remove();

        if (list && !list.querySelector('.curriculum-link-row')) {
          list.innerHTML = `
            <div class="curriculum-link-editor__empty">
              Chưa có tài liệu đính kèm cho bài học này.
            </div>
          `;
        }

        refreshReviewLinkControlsV3(list);
        return;
      }

      if (button.dataset.action === 'move-review-link') {
        const row = button.closest('.curriculum-link-row');
        const direction = button.dataset.direction;

        if (!row) {
          return;
        }

        const sibling = direction === 'up' ? row.previousElementSibling : row.nextElementSibling;

        if (!sibling || !sibling.classList.contains('curriculum-link-row')) {
          return;
        }

        if (direction === 'up') {
          row.parentElement.insertBefore(row, sibling);
        } else {
          row.parentElement.insertBefore(sibling, row);
        }

        refreshReviewLinkControlsV3(row.parentElement);
        return;
      }

      if (button.dataset.action === 'select-program') {
        state.selectedProgramId = button.dataset.programId || '';
        state.workspaceSection = 'editor';
        state.editorTab = 'lessons';
        renderView();
        return;
      }

      if (button.dataset.action === 'switch-editor-tab') {
        state.workspaceSection = 'editor';
        state.editorTab = button.dataset.tab || 'lessons';
        renderView();
        return;
      }

      if (button.dataset.action === 'select-lesson') {
        state.selectedLessonId = button.dataset.lessonId || 'new';
        const selectedLesson = getActiveCurriculumLessons(selectedProgram).find(
          (lesson) => lesson.id === state.selectedLessonId,
        ) || null;

        if (selectedLesson) {
          state.selectedActivitySessionNumber = Number(selectedLesson.sessionNumber || state.selectedActivitySessionNumber || 1);
        }

        renderView();
        return;
      }

      if (button.dataset.action === 'create-lesson') {
        state.selectedLessonId = 'new';
        renderView();
        return;
      }

      if (button.dataset.action === 'add-program-session' && selectedProgram) {
        const currentSessionCount = getLessonSessionLimit(selectedProgram);
        const nextSessionNumber = currentSessionCount + 1;

        state.busyKey = 'add-program-session';
        renderView();

        try {
          await setCurriculumProgramSessionCount(selectedProgram.id, nextSessionNumber);
          await refreshProgram(selectedProgram.id);
          state.editorTab = 'lessons';
          selectCurriculumSession(nextSessionNumber);
          showToast({
            title: 'Đã thêm buổi mới',
            message: `Chương trình ${selectedProgram.name} đã có thêm buổi ${nextSessionNumber}. Bạn có thể bắt đầu soạn ngay.`,
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể thêm buổi',
            message: mapFirebaseError(error, 'Không thể thêm buổi mới cho chương trình này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (button.dataset.action === 'select-exam-item') {
        state.selectedChecklistId = button.dataset.checklistId || 'new';
        renderView();
        return;
      }

      if (button.dataset.action === 'create-exam-item') {
        state.selectedChecklistId = 'new';
        renderView();
        return;
      }

      if (button.dataset.action === 'save-assignment') {
        const selectedClass = getSelectedClass();
        const assignment = selectedClass ? ensureDraftForClass(selectedClass) : null;

        if (!selectedClass || !assignment?.programId) {
          showToast({
            title: 'Chưa thể lưu',
            message: 'Hãy chọn lớp và chương trình trước khi lưu.',
            variant: 'warning',
          });
          return;
        }

        state.busyKey = 'save-assignment';
        renderView();

        try {
          await saveClassCurriculumAssignment(selectedClass.classCode, {
            curriculumProgramId: assignment.programId,
            curriculumCurrentSession: assignment.currentSession,
            curriculumPhase: assignment.curriculumPhase,
            curriculumExerciseVisibleSessions: assignment.exerciseVisibleSessions || [],
          });

          const latestView = await getClassCurriculumView(selectedClass.classCode, { publicAccess: false });
          state.draftsByClassCode[selectedClass.classCode] = latestView.assignment;

          showToast({
            title: 'Đã lưu học liệu',
            message: `Lớp ${selectedClass.classCode} đã được cập nhật chương trình, buổi hiện tại và pha lớp học.`,
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể lưu',
            message: mapFirebaseError(error, 'Không thể lưu cấu hình học liệu cho lớp này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (button.dataset.action === 'archive-lesson' && selectedProgram) {
        const lessonId = button.dataset.lessonId || state.selectedLessonId;

        if (!lessonId) {
          return;
        }

        const confirmed = await confirmDialog({
          title: 'Lưu kho buổi học?',
          message: 'Học sinh sẽ không còn nhìn thấy buổi học này, nhưng bạn có thể khôi phục lại trong Kho lưu trữ.',
          confirmText: 'Lưu kho',
          variant: 'warning',
        });

        if (!confirmed) {
          return;
        }

        state.busyKey = 'archive-lesson';
        renderView();

        try {
          await setCurriculumLessonArchived(selectedProgram.id, lessonId, true);
          await refreshProgram(selectedProgram.id);
          state.selectedLessonId = getActiveCurriculumLessons(getSelectedProgram())[0]?.id || 'new';
          state.editorTab = 'archived';
          showToast({
            title: 'Đã lưu kho buổi học',
            message: 'Buổi học đã được chuyển vào kho lưu và sẽ không còn hiện với học sinh.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể lưu kho',
            message: mapFirebaseError(error, 'Không thể lưu kho buổi học này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (button.dataset.action === 'archive-empty-session' && selectedProgram) {
        const sessionNumber = Number(button.dataset.sessionNumber || state.selectedActivitySessionNumber || 0);
        const sessionLimit = Math.max(
          1,
          Number(selectedProgram.totalSessionCount || selectedProgram.knowledgePhaseEndSession || 1),
        );
        const isTrailingEmptySession = sessionLimit > 1 && sessionNumber >= sessionLimit;

        if (!sessionNumber) {
          return;
        }

        const confirmed = await confirmDialog({
          title: isTrailingEmptySession ? 'Xóa buổi trống?' : 'Lưu kho buổi trống?',
          message: isTrailingEmptySession
            ? `Buổi ${sessionNumber} chưa có nội dung. Hệ thống sẽ thu gọn chương trình và bỏ buổi này khỏi danh sách.`
            : `Buổi ${sessionNumber} chưa có nội dung. Hệ thống sẽ đưa buổi này vào Kho lưu trữ để bạn có thể xóa vĩnh viễn nếu không cần nữa.`,
          confirmText: isTrailingEmptySession ? 'Xóa buổi' : 'Lưu kho',
          variant: 'warning',
        });

        if (!confirmed) {
          return;
        }

        state.busyKey = 'archive-empty-session';
        renderView();

        try {
          await archiveEmptyCurriculumSession(selectedProgram.id, sessionNumber);
          await refreshProgram(selectedProgram.id);
          state.editorTab = isTrailingEmptySession ? 'lessons' : 'archived';
          showToast({
            title: isTrailingEmptySession ? 'Đã xóa buổi trống' : 'Đã lưu kho buổi trống',
            message: isTrailingEmptySession
              ? `Buổi ${sessionNumber} đã được bỏ khỏi danh sách buổi học.`
              : `Buổi ${sessionNumber} đã được đưa vào Kho lưu trữ.`,
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: isTrailingEmptySession ? 'Không thể xóa' : 'Không thể lưu kho',
            message: mapFirebaseError(
              error,
              isTrailingEmptySession ? 'Không thể xóa buổi trống này.' : 'Không thể lưu kho buổi trống này.',
            ),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (button.dataset.action === 'restore-lesson' && selectedProgram) {
        const lessonId = button.dataset.lessonId;
        state.busyKey = `restore-lesson:${lessonId}`;
        renderView();

        try {
          await setCurriculumLessonArchived(selectedProgram.id, lessonId, false);
          await refreshProgram(selectedProgram.id);
          const restoredLesson = getActiveCurriculumLessons(getSelectedProgram()).find((lesson) => lesson.id === lessonId) || null;
          state.selectedLessonId = lessonId;
          state.selectedActivitySessionNumber = Number(restoredLesson?.sessionNumber || state.selectedActivitySessionNumber || 1);
          state.editorTab = 'lessons';
          showToast({
            title: 'Đã khôi phục buổi học',
            message: restoredLesson
              ? `Buổi học đã quay trở lại danh sách đang dùng ở buổi ${restoredLesson.sessionNumber}.`
              : 'Buổi học đã quay trở lại danh sách đang dùng.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể khôi phục',
            message: mapFirebaseError(error, 'Không thể khôi phục buổi học này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (button.dataset.action === 'delete-archived-lesson' && selectedProgram) {
        const lessonId = button.dataset.lessonId || '';

        if (!lessonId) {
          return;
        }

        const confirmed = await confirmDialog({
          title: 'Xóa vĩnh viễn bài học?',
          message: 'Bài học sẽ bị xóa khỏi Kho lưu trữ và không thể khôi phục lại.',
          confirmText: 'Xóa vĩnh viễn',
          variant: 'danger',
        });

        if (!confirmed) {
          return;
        }

        state.busyKey = `delete-lesson:${lessonId}`;
        renderView();

        try {
          await deleteArchivedCurriculumLesson(selectedProgram.id, lessonId);
          await refreshProgram(selectedProgram.id);
          showToast({
            title: 'Đã xóa vĩnh viễn',
            message: 'Bài học đã được xóa khỏi kho lưu trữ.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể xóa',
            message: mapFirebaseError(error, 'Không thể xóa vĩnh viễn bài học này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (button.dataset.action === 'archive-exam-item' && selectedProgram) {
        const checklistId = button.dataset.checklistId || state.selectedChecklistId;

        if (!checklistId) {
          return;
        }

        const confirmed = await confirmDialog({
          title: 'Lưu kho mục cuối khóa?',
          message: 'Học sinh sẽ không còn nhìn thấy mục này, nhưng bạn vẫn có thể khôi phục lại sau.',
          confirmText: 'Lưu kho',
          variant: 'warning',
        });

        if (!confirmed) {
          return;
        }

        state.busyKey = 'archive-exam-item';
        renderView();

        try {
          await setCurriculumExamChecklistItemArchived(selectedProgram.id, checklistId, true);
          await refreshProgram(selectedProgram.id);
          state.selectedChecklistId = getActiveCurriculumChecklist(getSelectedProgram())[0]?.id || 'new';
          showToast({
            title: 'Đã lưu kho mục cuối khóa',
            message: 'Mục ôn tập cuối khóa đã được chuyển vào kho lưu.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể lưu kho',
            message: mapFirebaseError(error, 'Không thể lưu kho mục cuối khóa này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (button.dataset.action === 'restore-exam-item' && selectedProgram) {
        const checklistId = button.dataset.checklistId;
        state.busyKey = `restore-exam-item:${checklistId}`;
        renderView();

        try {
          await setCurriculumExamChecklistItemArchived(selectedProgram.id, checklistId, false);
          await refreshProgram(selectedProgram.id);
          state.selectedChecklistId = checklistId;
          state.editorTab = 'final';
          showToast({
            title: 'Đã khôi phục mục cuối khóa',
            message: 'Mục cuối khóa đã quay lại phần đang dùng.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể khôi phục',
            message: mapFirebaseError(error, 'Không thể khôi phục mục cuối khóa này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }
      }
    });

    root.addEventListener('dragstart', (event) => {
      const imageItem = event.target.closest('.curriculum-image-manager__item');

      if (!imageItem) {
        return;
      }

      draggingLessonImageId = imageItem.dataset.imageId || '';

      if (event.dataTransfer && draggingLessonImageId) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', draggingLessonImageId);
      }
    });

    root.addEventListener('dragover', (event) => {
      const imageItem = event.target.closest('.curriculum-image-manager__item');

      if (!imageItem || !draggingLessonImageId) {
        return;
      }

      event.preventDefault();

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
    });

    root.addEventListener('drop', (event) => {
      const imageItem = event.target.closest('.curriculum-image-manager__item');

      if (!imageItem || !draggingLessonImageId) {
        return;
      }

      event.preventDefault();

      const form = imageItem.closest('form');
      const targetImageId = imageItem.dataset.imageId || '';

      if (!form || !targetImageId || targetImageId === draggingLessonImageId) {
        draggingLessonImageId = '';
        return;
      }

      const currentImages = getLessonImagesFromFormV3(form);
      const nextImages = reorderItemsById(currentImages, draggingLessonImageId, targetImageId);
      setLessonImagesFormStateV3(form, nextImages);
      draggingLessonImageId = '';
    });

    root.addEventListener('dragend', () => {
      draggingLessonImageId = '';
    });

    root.addEventListener('submit', async (event) => {
      const form = event.target;
      const selectedProgram = getSelectedProgram();

      if (form.id === 'curriculum-session-activity-form' && selectedProgram) {
        event.preventDefault();

        const formData = new FormData(form);
        const sessionNumber = Number(formData.get('activitySessionNumber'));
        const activityType = String(formData.get('activityType') || '').trim();

        state.busyKey = 'save-session-activity';
        renderView();

        try {
          await saveCurriculumSessionActivity(selectedProgram.id, {
            sessionNumber,
            activityType,
          });
          await refreshProgram(selectedProgram.id);
          state.selectedActivitySessionNumber = sessionNumber;
          showToast({
            title: 'Đã lưu loại buổi',
            message: `Buổi ${sessionNumber} đã được cập nhật thành ${getCurriculumActivityTypeLabel(activityType)}.`,
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể lưu loại buổi',
            message: mapFirebaseError(error, 'Không thể lưu loại buổi cho chương trình này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (form.id === 'curriculum-lesson-form' && selectedProgram) {
        event.preventDefault();

        const formData = new FormData(form);
        const lessonId = String(formData.get('lessonId') || '').trim() || createCurriculumItemId(`${selectedProgram.id}-lesson`);

        state.busyKey = 'save-lesson';
        renderView();

        try {
          const images = getLessonImagesFromFormV3(form);
          const lectureMarkdown = String(formData.get('lectureMarkdown') || '').trim();
          const exerciseMarkdown = String(formData.get('exerciseMarkdown') || '').trim();
          await saveCurriculumLesson(selectedProgram.id, {
            id: lessonId,
            sessionNumber: Number(formData.get('sessionNumber')),
            title: formData.get('title'),
            contentMarkdown: lectureMarkdown,
            lectureMarkdown,
            exerciseMarkdown,
            reviewLinks: getReviewLinksFromFormV3(form),
            teacherNote: formData.get('teacherNote'),
            bannerImage: getLessonBannerFromFormV3(form),
            images,
            coverImage: images[0] || null,
          });
          await refreshProgram(selectedProgram.id);
          state.selectedLessonId = lessonId;

          showToast({
            title: 'Đã lưu buổi học',
            message: 'Nội dung buổi học đã được cập nhật cho toàn bộ các lớp đang dùng chương trình này.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể lưu buổi học',
            message: mapFirebaseError(error, 'Không thể lưu buổi học này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (form.id === 'curriculum-project-stages-form' && selectedProgram) {
        event.preventDefault();

        const formData = new FormData(form);
        const stages = (selectedProgram.finalChecklist || []).map((item) => ({
          stageKey: item.stageKey,
          description: formData.get(`description:${item.stageKey}`),
          studentGuide: formData.get(`studentGuide:${item.stageKey}`),
          exampleOutput: formData.get(`exampleOutput:${item.stageKey}`),
        }));

        state.busyKey = 'save-project-stages';
        renderView();

        try {
          await saveCurriculumProjectStages(selectedProgram.id, stages);
          await refreshProgram(selectedProgram.id);
          showToast({
            title: 'Đã lưu quy trình cuối khóa',
            message: 'Hướng dẫn 7 giai đoạn sản phẩm đã được cập nhật.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể lưu quy trình',
            message: mapFirebaseError(error, 'Không thể lưu quy trình cuối khóa này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }

        return;
      }

      if (form.id === 'curriculum-exam-checklist-form' && selectedProgram) {
        event.preventDefault();

        const formData = new FormData(form);
        const checklistId =
          String(formData.get('checklistId') || '').trim() || createCurriculumItemId(`${selectedProgram.id}-exam`);

        state.busyKey = 'save-exam-item';
        renderView();

        try {
          await saveCurriculumExamChecklistItem(selectedProgram.id, {
            id: checklistId,
            order: Number(formData.get('order')),
            title: formData.get('title'),
            description: formData.get('description'),
          });
          await refreshProgram(selectedProgram.id);
          state.selectedChecklistId = checklistId;

          showToast({
            title: 'Đã lưu mục cuối khóa',
            message: 'Checklist cuối khóa đã được cập nhật.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể lưu mục cuối khóa',
            message: mapFirebaseError(error, 'Không thể lưu mục cuối khóa này.'),
            variant: 'danger',
          });
        } finally {
          state.busyKey = '';
          renderView();
        }
      }
    });

    root.addEventListener('change', async (event) => {
      const target = event.target;

      if (target.dataset.role === 'lesson-image-alt') {
        syncLessonImageAltFormStateV3(target);
        return;
      }

      if (target.name === 'activitySessionNumber') {
        state.selectedActivitySessionNumber = Number(target.value || 1);
        renderView();
        return;
      }

      if (target.dataset.role === 'banner-image-alt') {
        syncBannerImageAltFormStateV3(target);
        return;
      }

      if (['lectureMarkdown', 'exerciseMarkdown', 'title'].includes(target.name)) {
        const form = target.closest('form');
        syncLessonMarkdownPreviewV3(form, target.name === 'title' ? '' : target.name.replace('Markdown', ''));
        return;
      }

      if (['lectureMarkdownFile', 'exerciseMarkdownFile'].includes(target.name)) {
        const form = target.closest('form');
        const file = target.files?.[0] || null;
        const markdownTab = normalizeLessonMarkdownTab(target.name.replace('MarkdownFile', ''));
        const markdownInput = form?.querySelector(`textarea[name="${markdownTab}Markdown"]`);

        if (!file || !form || !markdownInput) {
          return;
        }

        try {
          markdownInput.value = await file.text();
          syncLessonMarkdownPreviewV3(form, markdownTab);
          showToast({
            title: 'Đã nạp file markdown',
            message: 'Nội dung markdown đã được đưa vào editor. Hãy kiểm tra lại rồi bấm lưu.',
            variant: 'success',
          });
        } catch {
          showToast({
            title: 'Không thể đọc file',
            message: 'File markdown này không thể đọc được ở trình duyệt hiện tại.',
            variant: 'danger',
          });
        } finally {
          target.value = '';
        }

        return;
      }

      if (target.name === 'bannerImageFile') {
        const form = target.closest('form');
        const file = target.files?.[0] || null;
        const uploadButton = form?.querySelector('[data-action="pick-banner-image"]');

        if (!file || !form) {
          return;
        }

        if (!isCloudinaryConfigured()) {
          showToast({
            title: 'Cloudinary chưa sẵn sàng',
            message: 'Hãy cấu hình Cloudinary trước khi tải banner cho bài học.',
            variant: 'warning',
          });
          target.value = '';
          return;
        }

        if (uploadButton) {
          uploadButton.setAttribute('disabled', 'disabled');
          uploadButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang tải...';
        }

        try {
          const image = await uploadCurriculumLessonImage(file);
          setLessonBannerFormStateV3(form, {
            ...image,
            id: image.id || createCurriculumItemId('lesson-banner'),
          });
          showToast({
            title: 'Đã tải banner',
            message: 'Banner đã sẵn sàng. Hãy bấm lưu buổi học để cập nhật vào chương trình.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể tải banner',
            message: mapFirebaseError(error, 'Không thể tải banner bài học lên Cloudinary.'),
            variant: 'danger',
          });
        } finally {
          target.value = '';

          if (uploadButton) {
            uploadButton.removeAttribute('disabled');
            uploadButton.innerHTML = '<i class="bi bi-card-image me-2"></i>Tải banner';
          }
        }

        return;
      }

      if (target.name === 'coverImageFile') {
        const form = target.closest('form');
        const files = Array.from(target.files || []);
        const uploadButton = form?.querySelector('[data-action="pick-lesson-image"]');

        if (files.length === 0 || !form) {
          return;
        }

        if (!isCloudinaryConfigured()) {
          showToast({
            title: 'Cloudinary chưa sẵn sàng',
            message: 'Hãy cấu hình Cloudinary trước khi tải ảnh minh họa cho bài học.',
            variant: 'warning',
          });
          target.value = '';
          return;
        }

        if (uploadButton) {
          uploadButton.setAttribute('disabled', 'disabled');
          uploadButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang tải ảnh...';
        }

        try {
          const currentImages = getLessonImagesFromFormV3(form);
          const uploadedImages = [];

          for (const file of files) {
            const image = await uploadCurriculumLessonImage(file);
            uploadedImages.push({
              ...image,
              id: image.id || createCurriculumItemId('lesson-image'),
            });
          }

          setLessonImagesFormStateV3(form, [...currentImages, ...uploadedImages]);
          showToast({
            title: 'Đã tải ảnh minh họa',
            message: 'Ảnh đã sẵn sàng. Hãy bấm lưu buổi học để cập nhật vào chương trình.',
            variant: 'success',
          });
        } catch (error) {
          showToast({
            title: 'Không thể tải ảnh',
            message: mapFirebaseError(error, 'Không thể tải ảnh minh họa lên Cloudinary.'),
            variant: 'danger',
          });
        } finally {
          target.value = '';

          if (uploadButton) {
            uploadButton.removeAttribute('disabled');
            uploadButton.innerHTML = '<i class="bi bi-images me-2"></i>Tải ảnh lên';
          }
        }

        return;
      }
      if (target.name === 'previewClassCode') {
        state.selectedClassCode = target.value;
        state.didInitializeActivitySession = false;
        const selectedClass = getSelectedClass();
        const draft = ensureDraftForClass(selectedClass);

        if (draft?.programId) {
          state.selectedProgramId = draft.programId;
          state.selectedActivitySessionNumber = Number(draft.currentSession || 1);
        }

        renderView();
        return;
      }

      if (target.name === 'editorProgramId') {
        state.selectedProgramId = target.value;
        selectCurriculumSession(1);
        renderView();
        return;
      }

      if (target.name === 'previewProgramId') {
        updateDraftForSelectedClass({ programId: target.value });
        state.selectedProgramId = target.value;
        selectCurriculumSession(1);
        renderView();
        return;
      }

      if (target.name === 'previewCurrentSession') {
        const nextSessionNumber = Number(target.value);
        updateDraftForSelectedClass({ currentSession: nextSessionNumber });
        selectCurriculumSession(nextSessionNumber);
        renderView();
        return;
      }

      if (target.name === 'previewExerciseVisible') {
        const selectedClass = getSelectedClass();
        const assignment = selectedClass ? ensureDraftForClass(selectedClass) : null;
        const program = state.programs.find((item) => item.id === assignment?.programId) || null;
        const sessionNumber = Number(target.dataset.sessionNumber || assignment?.currentSession || 1);

        updateDraftForSelectedClass({
          exerciseVisibleSessions: setCurriculumExerciseVisibleForSession(
            assignment,
            sessionNumber,
            target.checked,
            program,
          ),
        });
        state.previewTab = target.checked ? LESSON_MARKDOWN_TAB_EXERCISE : LESSON_MARKDOWN_TAB_LECTURE;
        renderView();
        return;
      }

      if (target.name === 'previewPhase') {
        updateDraftForSelectedClass({
          curriculumPhase: target.value === 'final' ? 'final' : 'learning',
        });
        renderView();
      }
    });

    const unsubscribers = [
      subscribeClasses(
        (items) => {
          state.classes = items;
          state.isLoadingClasses = false;
          state.error = '';
          renderView();
        },
        (error) => {
          state.isLoadingClasses = false;
          state.error = mapFirebaseError(error, 'Không tải được danh sách lớp cho trang học liệu.');
          renderView();
        },
      ),
      subscribeCurriculumPrograms(
        (items) => {
          state.programs = items;
          state.isLoadingPrograms = false;
          state.error = '';
          renderView();
        },
        (error) => {
          state.isLoadingPrograms = false;
          state.error = mapFirebaseError(error, 'Không tải được danh sách chương trình học.');
          renderView();
        },
      ),
    ];

    renderView();

    return () => {
      cleanupQuizManagement();
      unsubscribers.forEach((unsubscribe) => unsubscribe?.());
    };
  },
};
