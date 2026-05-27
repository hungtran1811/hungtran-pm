import { getClassesOnce } from '../../services/classes.service.js';
import {
  getCurriculumProgram,
  listCurriculumPrograms,
} from '../../services/curriculum.service.js';
import {
  ADMIN_QUIZ_PREVIEW_STUDENT_NAME,
  recordAdminQuizPreviewSubmission,
} from '../../services/quiz-admin-preview.service.js';
import {
  listQuizConfigs,
} from '../../services/quizzes.service.js';
import {
  getCurriculumActivityTypeLabel,
  getCurriculumSessionActivities,
  getCurriculumSessionActivity,
} from '../../utils/curriculum-program.js';
import { escapeHtml } from '../../utils/html.js';
import {
  buildStudentQuizVariant,
  formatQuizReadinessRequirement,
  getQuizReadiness,
  isFillBlankQuestion,
  isQuizQuestionAnswered,
  QUIZ_QUESTION_LIMIT,
  validateQuizAnswerMap,
} from '../../utils/quiz.js';
import {
  buildAdminQuizPreviewPath,
  getHashRouteState,
} from '../../utils/route.js';
import { renderAlert } from '../components/Alert.js';
import { renderBrandLogo } from '../components/BrandLogo.js';
import { renderEmptyState } from '../components/EmptyState.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderQuizForm } from '../components/QuizForm.js';
import { renderToastStack, showToast } from '../components/ToastStack.js';

const ADMIN_PREVIEW_CLASS_CODE = 'ADMIN-PREVIEW';

function resolveSessionNumber(program, requestedSessionNumber) {
  const sessions = getCurriculumSessionActivities(program);
  const requested = Number(requestedSessionNumber || 0);

  if (sessions.some((item) => item.sessionNumber === requested)) {
    return requested;
  }

  if ([5, 9].includes(requested)) {
    return requested;
  }

  return sessions.find((item) => [5, 9].includes(item.sessionNumber))?.sessionNumber || 5;
}

function findQuizConfigForSession(configs = [], sessionNumber = 0) {
  return configs.find((config) => Number(config.sessionNumber || 0) === Number(sessionNumber || 0)) || null;
}

function getRequiredAnswerMessage(question) {
  return isFillBlankQuestion(question)
    ? 'Hãy nhập câu trả lời cho câu hỏi này.'
    : 'Hãy chọn một đáp án cho câu hỏi này.';
}

function normalizeAnswerErrors(quizVariant, errors = {}) {
  const normalizedErrors = {};

  Object.keys(errors).forEach((questionId) => {
    const question = (quizVariant?.questions || []).find((item) => item.id === questionId);
    normalizedErrors[questionId] = question
      ? getRequiredAnswerMessage(question)
      : 'Hãy trả lời câu hỏi này.';
  });

  return normalizedErrors;
}

function getPreviewClasses(classes = [], program = null) {
  const activeClasses = classes.filter((classItem) => classItem.status === 'active' && !classItem.hidden);
  const matchingClasses = program?.id
    ? activeClasses.filter((classItem) => classItem.curriculumProgramId === program.id)
    : activeClasses;

  return matchingClasses.length > 0 ? matchingClasses : activeClasses;
}

function getStudentsForClass(students = [], classCode = '') {
  const normalizedClassCode = String(classCode || '').trim().toUpperCase();

  return students.filter((student) =>
    student.active &&
    (
      String(student.classId || '').trim().toUpperCase() === normalizedClassCode ||
      String(student.classCode || '').trim().toUpperCase() === normalizedClassCode
    ),
  );
}

function getSelectedClass(state) {
  return getPreviewClasses(state.classes, state.program)
    .find((classItem) => classItem.classCode === state.selectedClassCode) || null;
}

function getSelectedStudent(state) {
  return state.selectedClassCode
    ? {
        id: 'admin-preview-student',
        fullName: ADMIN_QUIZ_PREVIEW_STUDENT_NAME,
      }
    : null;
}

function buildScoreCenterPath(classCode = '', sessionNumber = 0) {
  const params = new URLSearchParams();

  params.set('workspace', 'quiz');
  params.set('session', String(Number(sessionNumber || 0) || 5));

  if (classCode) {
    params.set('classCode', String(classCode || '').trim().toUpperCase());
  }

  return `#/admin/curriculum?${params.toString()}`;
}

function renderQuizPreviewControls({ program, sessionNumber, classCode = '' }) {
  const selectedActivity = program ? getCurriculumSessionActivity(program, sessionNumber) : null;
  const activityLabel = selectedActivity
    ? getCurriculumActivityTypeLabel(selectedActivity.activityType)
    : 'Kiểm tra';

  return `
    <div class="admin-student-preview-bar admin-student-preview-bar--compact">
      <a class="admin-student-preview-back" href="#/admin/curriculum" aria-label="Quay lại Bài giảng">
        <i class="bi bi-arrow-left"></i>
        <span>Bài giảng</span>
      </a>
      ${
        program
          ? `
            <div class="admin-student-preview-field admin-student-preview-field--readonly admin-student-preview-field--wide">
              <label class="form-label">Chương trình</label>
              <div class="admin-student-preview-readonly">${escapeHtml(program.name || 'Chưa chọn chương trình')}</div>
            </div>
          `
          : ''
      }
      <div class="admin-student-preview-field admin-student-preview-field--readonly">
        <label class="form-label">Buổi</label>
        <div class="admin-student-preview-readonly">Buổi ${Number(sessionNumber || 0) || '?'} · ${escapeHtml(activityLabel)}</div>
      </div>
      ${
        classCode
          ? `
            <div class="admin-student-preview-field admin-student-preview-field--readonly">
              <label class="form-label">Lớp ghi điểm</label>
              <div class="admin-student-preview-readonly">${escapeHtml(classCode)}</div>
            </div>
          `
          : ''
      }
    </div>
  `;
}

function renderProgramShortcutList(programs = []) {
  if (!programs.length) {
    return renderEmptyState({
      icon: 'diagram-3',
      title: 'Chưa có chương trình học',
      description: 'Hãy tạo hoặc seed chương trình học trước khi test đề.',
    });
  }

  return `
    <div class="student-library-card card border-0 shadow-sm">
      <div class="card-body">
        <div class="student-library-title-label">Test quiz admin</div>
        <h2 class="h5 mb-3">Chọn chương trình và buổi để làm thử</h2>
        <div class="admin-student-preview-program-grid">
          ${programs
            .flatMap((program) =>
              [5, 9].map((sessionNumber) => `
                <a class="admin-student-preview-program" href="${escapeHtml(buildAdminQuizPreviewPath(program.id, sessionNumber))}">
                  <span>${escapeHtml(program.subject || 'Chương trình')} · Buổi ${sessionNumber}</span>
                  <strong>${escapeHtml(program.name)}</strong>
                  <small>Chọn lớp/học sinh ở bước tiếp theo để gửi điểm về trung tâm</small>
                </a>
              `),
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function renderScoreTargetPanel(state, { disabled = false } = {}) {
  const classes = getPreviewClasses(state.classes, state.program);
  const students = state.selectedClassCode
    ? [{ id: state.selectedStudentId || 'admin-preview-student', fullName: ADMIN_QUIZ_PREVIEW_STUDENT_NAME }]
    : [];
  const selectedClass = getSelectedClass(state);
  const selectedStudent = getSelectedStudent(state);
  const scoreCenterPath = state.selectedClassCode
    ? buildScoreCenterPath(state.selectedClassCode, state.sessionNumber)
    : '#/admin/curriculum?workspace=quiz';
  const disabledAttr = disabled || state.isSubmitting ? 'disabled' : '';

  return `
    <section class="admin-quiz-score-target">
      <div>
        <div class="student-library-title-label">Gửi kết quả test admin</div>
        <h2 class="h6 mb-1">Chọn lớp để ghi nhận lượt test mẫu</h2>
        <p class="text-secondary mb-0">Bài test admin luôn được lưu dưới tên ${escapeHtml(ADMIN_QUIZ_PREVIEW_STUDENT_NAME)}, không dùng học sinh thật.</p>
      </div>
      <div class="admin-quiz-score-target__controls">
        <label class="admin-quiz-score-target__field">
          <span>Lớp</span>
          <select id="admin-quiz-preview-class-select" class="form-select" ${disabledAttr}>
            ${
              classes.length
                ? classes.map((classItem) => `
                    <option value="${escapeHtml(classItem.classCode)}" ${classItem.classCode === state.selectedClassCode ? 'selected' : ''}>
                      ${escapeHtml(classItem.classCode)} - ${escapeHtml(classItem.className)}
                    </option>
                  `).join('')
                : '<option value="">Chưa có lớp đang hoạt động</option>'
            }
          </select>
        </label>
        <label class="admin-quiz-score-target__field">
          <span>Học sinh test</span>
          <div class="form-control bg-white">${escapeHtml(ADMIN_QUIZ_PREVIEW_STUDENT_NAME)}</div>
        </label>
        <a class="btn btn-outline-secondary admin-quiz-score-target__link" href="${escapeHtml(scoreCenterPath)}">
          <i class="bi bi-clipboard-data me-2"></i>Trung tâm điểm
        </a>
      </div>
      ${
        selectedClass && selectedStudent
          ? ''
          : renderAlert('Cần chọn lớp đang hoạt động để gửi kết quả test admin vào trung tâm điểm.', 'warning')
      }
    </section>
  `;

  return `
    <section class="admin-quiz-score-target">
      <div>
        <div class="student-library-title-label">Gửi kết quả về trung tâm điểm</div>
        <h2 class="h6 mb-1">Chọn lớp và học sinh để ghi nhận lượt nộp</h2>
        <p class="text-secondary mb-0">Học sinh không thấy điểm sau khi nộp. Admin xem điểm trong Bài giảng.</p>
      </div>
      <div class="admin-quiz-score-target__controls">
        <label class="admin-quiz-score-target__field">
          <span>Lớp</span>
          <select id="admin-quiz-preview-class-select" class="form-select" ${disabledAttr}>
            ${
              classes.length
                ? classes.map((classItem) => `
                    <option value="${escapeHtml(classItem.classCode)}" ${classItem.classCode === state.selectedClassCode ? 'selected' : ''}>
                      ${escapeHtml(classItem.classCode)} - ${escapeHtml(classItem.className)}
                    </option>
                  `).join('')
                : '<option value="">Chưa có lớp đang hoạt động</option>'
            }
          </select>
        </label>
        <label class="admin-quiz-score-target__field">
          <span>Học sinh</span>
          <select id="admin-quiz-preview-student-select" class="form-select" ${disabledAttr || !students.length ? 'disabled' : ''}>
            ${
              students.length
                ? students.map((student) => `
                    <option value="${escapeHtml(student.id)}" ${student.id === state.selectedStudentId ? 'selected' : ''}>
                      ${escapeHtml(student.fullName)}
                    </option>
                  `).join('')
                : '<option value="">Chưa có học sinh trong lớp này</option>'
            }
          </select>
        </label>
        <a class="btn btn-outline-secondary admin-quiz-score-target__link" href="${escapeHtml(scoreCenterPath)}">
          <i class="bi bi-clipboard-data me-2"></i>Trung tâm điểm
        </a>
      </div>
      ${
        selectedClass && selectedStudent
          ? ''
          : renderAlert('Cần có lớp đang hoạt động và học sinh trong lớp để gửi kết quả vào trung tâm điểm.', 'warning')
      }
    </section>
  `;
}

function renderQuizPreviewTabs(activeTab = 'take', hasSubmittedRecord = false) {
  const tabs = [
    { id: 'take', label: 'Làm bài thử', icon: 'play-circle' },
    { id: 'target', label: 'Ghi điểm', icon: 'person-check' },
  ];

  if (hasSubmittedRecord) {
    tabs.push({ id: 'receipt', label: 'Sau khi nộp', icon: 'check2-circle' });
  }

  return `
    <div class="admin-quiz-preview-tabs" role="tablist" aria-label="Khu test quiz admin">
      ${tabs
        .map((tab) => `
          <button
            type="button"
            class="admin-quiz-preview-tab ${tab.id === activeTab ? 'admin-quiz-preview-tab--active' : ''}"
            data-action="switch-admin-quiz-preview-tab"
            data-tab-id="${tab.id}"
          >
            <i class="bi bi-${tab.icon} me-2"></i>${tab.label}
          </button>
        `)
        .join('')}
    </div>
  `;
}

function renderScoreTargetSummary(state) {
  const selectedClass = getSelectedClass(state);
  const selectedStudent = getSelectedStudent(state);

  return `
    <section class="admin-quiz-score-summary">
      <div>
        <div class="student-library-title-label">Ghi điểm về trung tâm</div>
        <div class="admin-quiz-score-summary__title">
          ${
            selectedClass && selectedStudent
              ? `${escapeHtml(selectedStudent.fullName)} · ${escapeHtml(selectedClass.classCode)}`
              : 'Chưa chọn lớp/học sinh'
          }
        </div>
      </div>
      <button type="button" class="btn btn-outline-primary btn-sm" data-action="switch-admin-quiz-preview-tab" data-tab-id="target">
        <i class="bi bi-sliders me-1"></i>Chọn nơi ghi điểm
      </button>
    </section>
  `;
}

function renderStudentSubmittedPreview(state) {
  const quiz = state.quizVariant;
  const questionCount = Number(quiz?.questionCount || quiz?.questions?.length || 0);

  return `
    <section class="student-quiz-card student-quiz-submitted admin-quiz-student-submitted">
      ${renderAlert('Bạn đã nộp bài kiểm tra thành công.', 'success')}
      <div class="student-quiz-submitted__main">
        <span class="student-quiz-submitted__icon" aria-hidden="true">
          <i class="bi bi-check2-circle"></i>
        </span>
        <div>
          <div class="student-quiz-eyebrow">Kiểm tra buổi ${Number(quiz?.sessionNumber || 0) || '?'}</div>
          <h2 class="student-quiz-title">${escapeHtml(quiz?.title || 'Bài kiểm tra')}</h2>
          <p class="student-quiz-description mb-0">
            Hệ thống đã ghi nhận bài làm. Học sinh không thấy điểm, đáp án đúng hoặc thống kê sau khi nộp.
          </p>
        </div>
      </div>
      <div class="student-quiz-submitted__meta">
        <div class="quiz-status-meta">
          <div class="quiz-status-meta__label">Trạng thái</div>
          <div class="fw-semibold text-success">Đã nộp</div>
        </div>
        <div class="quiz-status-meta">
          <div class="quiz-status-meta__label">Số câu</div>
          <div class="fw-semibold">${questionCount} câu</div>
        </div>
        <div class="quiz-status-meta">
          <div class="quiz-status-meta__label">Kết quả</div>
          <div class="fw-semibold">Đã gửi cho admin</div>
        </div>
      </div>
    </section>
  `;
}

function renderScoreCenterReceipt(state) {
  const record = state.submittedRecord;
  const scoreCenterPath = buildScoreCenterPath(record?.classCode || state.selectedClassCode, state.sessionNumber);

  if (!record) {
    return '';
  }

  return `
    <section class="admin-quiz-score-receipt">
      <div class="admin-quiz-score-receipt__icon" aria-hidden="true">
        <i class="bi bi-database-check"></i>
      </div>
      <div>
        <div class="student-library-title-label">Trung tâm điểm đã nhận</div>
        <h3 class="h5 mb-2">Kết quả đã được gửi về Bài giảng</h3>
        <p class="text-secondary mb-3">
          Lượt nộp của <strong>${escapeHtml(record.studentName || 'học sinh')}</strong>
          trong lớp <strong>${escapeHtml(record.classCode || '')}</strong> đã được ghi vào danh sách bài nộp.
          Màn review không hiển thị điểm để giữ đúng trải nghiệm học sinh.
        </p>
        <div class="d-flex flex-wrap gap-2">
          <a class="btn btn-primary" href="${escapeHtml(scoreCenterPath)}">
            <i class="bi bi-clipboard-data me-2"></i>Mở trung tâm điểm
          </a>
          <button type="button" class="btn btn-outline-secondary" data-action="reset-admin-quiz-preview">
            Làm lại vai học sinh
          </button>
          <button type="button" class="btn btn-outline-secondary" data-action="refresh-admin-quiz-variant">
            <i class="bi bi-shuffle me-2"></i>Đề thử khác
          </button>
        </div>
      </div>
    </section>
  `;
}

function renderQuizPreviewContent(state) {
  if (state.isLoading) {
    return renderLoadingOverlay('Đang tải đề test...');
  }

  if (state.error) {
    return renderAlert(escapeHtml(state.error), 'danger');
  }

  if (!state.program) {
    return renderProgramShortcutList(state.programs);
  }

  if (!state.quizConfig) {
    return renderEmptyState({
      icon: 'patch-question',
      title: `Chưa có bộ đề buổi ${state.sessionNumber}`,
      description: 'Hãy quay lại Bài giảng, dùng bộ mẫu hoặc thêm câu hỏi rồi bấm lưu đề trước khi test.',
    });
  }

  const readiness = getQuizReadiness(state.quizConfig);
  const selectedClass = getSelectedClass(state);
  const selectedStudent = getSelectedStudent(state);
  const canSubmitToScoreCenter = Boolean(selectedClass && selectedStudent);

  if (state.submittedRecord) {
    return `
      ${renderScoreTargetPanel(state, { disabled: true })}
      <div class="admin-quiz-preview-intro mb-3">
        ${renderAlert(
          'Mô phỏng sau khi học sinh nộp bài: học sinh chỉ thấy trạng thái đã nộp, còn điểm được quản lý trong trung tâm điểm.',
          'info',
        )}
      </div>
      <div class="admin-quiz-review-grid">
        <div>
          <div class="admin-quiz-review-label">Màn học sinh sau khi nộp</div>
          ${renderStudentSubmittedPreview(state)}
        </div>
        <div>
          <div class="admin-quiz-review-label">Luồng admin nhận kết quả</div>
          ${renderScoreCenterReceipt(state)}
        </div>
      </div>
    `;
  }

  return `
    ${renderScoreTargetPanel(state)}
    <div class="admin-quiz-preview-intro mb-3">
      ${renderAlert(
        'Bạn đang nhập vai học sinh để kiểm tra luồng thật. Khi nộp, kết quả sẽ được ghi vào trung tâm điểm của lớp/học sinh đã chọn.',
        'info',
      )}
      ${
        state.submitError
          ? renderAlert(escapeHtml(state.submitError), 'danger')
          : ''
      }
      ${
        readiness.isReady
          ? ''
          : renderAlert(
              `Bộ đề chưa đủ tỉ lệ 4 dễ, 4 trung bình, 2 khó. ${formatQuizReadinessRequirement(readiness)} Bạn vẫn có thể làm thử các câu hiện có.`,
              'warning',
            )
      }
    </div>
    ${
      state.quizVariant
        ? `
          ${renderQuizForm(state.quizVariant, state.answers, state.answerErrors, {
            disabled: state.isSubmitting || !canSubmitToScoreCenter,
            helperText: canSubmitToScoreCenter
              ? 'Làm bài như học sinh thật. Sau khi nộp, học sinh chỉ thấy trạng thái đã nộp.'
              : 'Hãy chọn lớp để bật nút nộp bài test admin vào trung tâm điểm.',
            submitLabel: state.isSubmitting ? 'Đang gửi kết quả...' : 'Nộp bài kiểm tra',
            currentQuestionIndex: state.currentQuestionIndex,
          })}
          <div class="d-flex flex-wrap justify-content-end gap-2 mt-2">
            <button type="button" class="btn btn-outline-secondary" data-action="refresh-admin-quiz-variant" ${state.isSubmitting ? 'disabled' : ''}>
              <i class="bi bi-shuffle me-2"></i>Đề thử khác
            </button>
            <button type="button" class="btn btn-link text-secondary" data-action="reset-admin-quiz-preview" ${state.isSubmitting ? 'disabled' : ''}>
              Làm lại lượt test
            </button>
          </div>
        `
        : renderEmptyState({
            icon: 'patch-question',
            title: 'Bộ đề chưa có câu hỏi',
            description: 'Hãy thêm câu hỏi hoặc dùng bộ mẫu trong Bài giảng trước khi test.',
          })
    }
  `;
}

function renderQuizPreviewContentV2(state) {
  if (state.isLoading || state.error || !state.program || !state.quizConfig) {
    return renderQuizPreviewContent(state);
  }

  const readiness = getQuizReadiness(state.quizConfig);
  const selectedClass = getSelectedClass(state);
  const selectedStudent = getSelectedStudent(state);
  const canSubmitToScoreCenter = Boolean(selectedClass && selectedStudent);
  const activeTab = state.submittedRecord
    ? (state.activeTab || 'receipt')
    : state.activeTab === 'target'
      ? 'target'
      : 'take';

  if (state.submittedRecord) {
    const submittedTab = ['take', 'target', 'receipt'].includes(activeTab) ? activeTab : 'receipt';

    return `
      ${renderQuizPreviewTabs(submittedTab, true)}
      ${
        submittedTab === 'target'
          ? renderScoreTargetPanel(state, { disabled: true })
          : submittedTab === 'take'
            ? `
              ${renderScoreTargetSummary(state)}
              ${renderStudentSubmittedPreview(state)}
              <div class="d-flex flex-wrap justify-content-end gap-2 mt-3">
                <button type="button" class="btn btn-outline-secondary" data-action="reset-admin-quiz-preview">
                  Làm lại lượt test
                </button>
                <button type="button" class="btn btn-outline-secondary" data-action="refresh-admin-quiz-variant">
                  <i class="bi bi-shuffle me-2"></i>Đề thử khác
                </button>
              </div>
            `
            : `
              <div class="admin-quiz-preview-intro mb-3">
                ${renderAlert(
                  'Mô phỏng sau khi học sinh nộp bài: học sinh chỉ thấy trạng thái đã nộp, còn điểm được quản lý trong trung tâm điểm.',
                  'info',
                )}
              </div>
              <div class="admin-quiz-review-grid">
                <div>
                  <div class="admin-quiz-review-label">Màn học sinh sau khi nộp</div>
                  ${renderStudentSubmittedPreview(state)}
                </div>
                <div>
                  <div class="admin-quiz-review-label">Luồng admin nhận kết quả</div>
                  ${renderScoreCenterReceipt(state)}
                </div>
              </div>
            `
      }
    `;
  }

  return `
    ${renderQuizPreviewTabs(activeTab, false)}
    ${
      activeTab === 'target'
        ? renderScoreTargetPanel(state)
        : `
          ${renderScoreTargetSummary(state)}
          <div class="admin-quiz-preview-intro mb-3">
            ${renderAlert(
              'Bạn đang nhập vai học sinh để kiểm tra luồng thật. Khi nộp, kết quả sẽ được ghi vào trung tâm điểm của lớp/học sinh đã chọn.',
              'info',
            )}
            ${state.submitError ? renderAlert(escapeHtml(state.submitError), 'danger') : ''}
            ${
              readiness.isReady
                ? ''
                : renderAlert(
                    `Bộ đề chưa đủ tỉ lệ 4 dễ, 4 trung bình, 2 khó. ${formatQuizReadinessRequirement(readiness)} Bạn vẫn có thể làm thử các câu hiện có.`,
                    'warning',
                  )
            }
          </div>
          ${
            state.quizVariant
              ? `
                ${renderQuizForm(state.quizVariant, state.answers, state.answerErrors, {
                  disabled: state.isSubmitting || !canSubmitToScoreCenter,
                  helperText: canSubmitToScoreCenter
                    ? 'Làm bài như học sinh thật. Sau khi nộp, học sinh chỉ thấy trạng thái đã nộp.'
                    : 'Hãy chọn lớp trong tab Ghi điểm để bật nút nộp bài test admin vào trung tâm điểm.',
                  submitLabel: state.isSubmitting ? 'Đang gửi kết quả...' : 'Nộp bài kiểm tra',
                  currentQuestionIndex: state.currentQuestionIndex,
                })}
                <div class="d-flex flex-wrap justify-content-end gap-2 mt-2">
                  <button type="button" class="btn btn-outline-secondary" data-action="refresh-admin-quiz-variant" ${state.isSubmitting ? 'disabled' : ''}>
                    <i class="bi bi-shuffle me-2"></i>Đề thử khác
                  </button>
                  <button type="button" class="btn btn-link text-secondary" data-action="reset-admin-quiz-preview" ${state.isSubmitting ? 'disabled' : ''}>
                    Làm lại lượt test
                  </button>
                </div>
              `
              : renderEmptyState({
                  icon: 'patch-question',
                  title: 'Bộ đề chưa có câu hỏi',
                  description: 'Hãy thêm câu hỏi hoặc dùng bộ mẫu trong Bài giảng trước khi test.',
                })
          }
        `
    }
  `;
}

export const adminQuizPreviewPage = {
  async render() {
    return `
      <div class="student-layout admin-student-preview-layout">
        <section class="admin-student-preview-controls">
          <div class="container-fluid student-page-shell">
            <div id="admin-quiz-preview-controls">${renderLoadingOverlay('Đang tải điều khiển...')}</div>
          </div>
        </section>
        <section class="student-library-shell py-3 py-lg-4">
          <div class="container-fluid student-page-shell">
            <div class="student-library-page">
              <div class="student-library-page__brand">
                ${renderBrandLogo({
                  id: 'admin-quiz-preview-brand',
                  className: 'student-library-page__brand-lockup',
                  tone: 'dark',
                  compact: true,
                })}
              </div>
              <div id="admin-quiz-preview-root">${renderLoadingOverlay('Đang tải đề test...')}</div>
            </div>
          </div>
        </section>
        ${renderToastStack()}
      </div>
    `;
  },

  async mount() {
    const controls = document.getElementById('admin-quiz-preview-controls');
    const root = document.getElementById('admin-quiz-preview-root');

    if (!controls || !root) {
      return null;
    }

    const state = {
      programs: [],
      classes: [],
      students: [],
      program: null,
      sessionNumber: 5,
      routeClassCode: '',
      selectedClassCode: '',
      selectedStudentId: '',
      quizConfigs: [],
      quizConfig: null,
      quizVariant: null,
      answers: {},
      answerErrors: {},
      currentQuestionIndex: 0,
      submittedRecord: null,
      isSubmitting: false,
      submitError: '',
      activeTab: 'take',
      isLoading: true,
      error: '',
      previewSeed: Date.now(),
    };
    let disposed = false;

    function syncScoreTarget(preferredClassCode = '') {
      const classes = getPreviewClasses(state.classes, state.program);
      const preferred = String(preferredClassCode || '').trim().toUpperCase();
      const hasPreferredClass = preferred && classes.some((classItem) => classItem.classCode === preferred);
      const hasSelectedClass = classes.some((classItem) => classItem.classCode === state.selectedClassCode);

      if (hasPreferredClass) {
        state.selectedClassCode = preferred;
      } else if (!hasSelectedClass) {
        state.selectedClassCode = classes[0]?.classCode || '';
      }

      state.selectedStudentId = state.selectedClassCode ? 'admin-preview-student' : '';
    }

    function syncQuizVariant() {
      state.quizConfig = findQuizConfigForSession(state.quizConfigs, state.sessionNumber);

      if (!state.quizConfig || !(state.quizConfig.questions || []).length) {
        state.quizVariant = null;
        return;
      }

      state.quizVariant = buildStudentQuizVariant(state.quizConfig, {
        classCode: state.selectedClassCode || ADMIN_PREVIEW_CLASS_CODE,
        studentId: `admin-preview-student-${state.previewSeed}`,
        sessionNumber: state.sessionNumber,
        submissionNumber: 1,
        questionLimit: QUIZ_QUESTION_LIMIT,
      });
    }

    function resetQuizWork({ keepSubmittedRecord = false } = {}) {
      state.answers = {};
      state.answerErrors = {};
      state.currentQuestionIndex = 0;
      state.submitError = '';

      if (!keepSubmittedRecord) {
        state.submittedRecord = null;
      }
    }

    function renderView() {
      if (disposed) {
        return;
      }

      controls.innerHTML = renderQuizPreviewControls({
        program: state.program,
        sessionNumber: state.sessionNumber,
        classCode: state.selectedClassCode,
      });
      root.innerHTML = renderQuizPreviewContentV2(state);
    }

    async function load() {
      const routeState = getHashRouteState();
      state.isLoading = true;
      state.error = '';
      state.routeClassCode = routeState.classCode || '';
      renderView();

      try {
        const [programs, classes] = await Promise.all([
          listCurriculumPrograms(),
          getClassesOnce(),
        ]);

        state.programs = programs;
        state.classes = classes;
        state.students = [];

        if (!routeState.programId) {
          state.program = null;
          state.quizConfigs = [];
          state.quizConfig = null;
          state.quizVariant = null;
          state.isLoading = false;
          renderView();
          return;
        }

        state.program = await getCurriculumProgram(routeState.programId);

        if (!state.program) {
          throw new Error('Không tìm thấy chương trình học để test quiz.');
        }

        state.sessionNumber = resolveSessionNumber(state.program, routeState.sessionNumber);
        state.quizConfigs = await listQuizConfigs(state.program);
        syncScoreTarget(state.routeClassCode);
        resetQuizWork();
        syncQuizVariant();
      } catch (error) {
        state.error = error?.message || 'Không thể tải đề test quiz.';
      } finally {
        state.isLoading = false;
        renderView();
      }
    }

    root.addEventListener('change', (event) => {
      const classSelect = event.target.closest('#admin-quiz-preview-class-select');
      const studentSelect = event.target.closest('#admin-quiz-preview-student-select');
      const answerInput = event.target.closest('[data-answer-kind="choice"][data-question-id]');

      if (classSelect) {
        state.selectedClassCode = String(classSelect.value || '').trim().toUpperCase();
        state.selectedStudentId = '';
        syncScoreTarget(state.selectedClassCode);
        resetQuizWork();
        syncQuizVariant();
        renderView();
        return;
      }

      if (studentSelect) {
        state.selectedStudentId = studentSelect.value || '';
        resetQuizWork();
        syncQuizVariant();
        renderView();
        return;
      }

      if (!answerInput) {
        return;
      }

      state.answers = {
        ...state.answers,
        [answerInput.dataset.questionId]: answerInput.value || '',
      };

      if (state.answerErrors[answerInput.dataset.questionId]) {
        const nextErrors = { ...state.answerErrors };
        delete nextErrors[answerInput.dataset.questionId];
        state.answerErrors = nextErrors;
      }

      state.submittedRecord = null;
      state.submitError = '';
      renderView();
    });

    root.addEventListener('input', (event) => {
      const blankInput = event.target.closest('[data-answer-kind="blank"][data-question-id]');

      if (!blankInput) {
        return;
      }

      const questionId = blankInput.dataset.questionId || '';
      state.answers = {
        ...state.answers,
        [questionId]: blankInput.value || '',
      };

      if (state.answerErrors[questionId]) {
        const nextErrors = { ...state.answerErrors };
        delete nextErrors[questionId];
        state.answerErrors = nextErrors;
        renderView();
      }

      state.submittedRecord = null;
      state.submitError = '';
    });

    root.addEventListener('click', (event) => {
      const previousButton = event.target.closest('[data-action="previous-question"]');
      const nextButton = event.target.closest('[data-action="next-question"]');
      const refreshButton = event.target.closest('[data-action="refresh-admin-quiz-variant"]');
      const resetButton = event.target.closest('[data-action="reset-admin-quiz-preview"]');
      const tabButton = event.target.closest('[data-action="switch-admin-quiz-preview-tab"]');

      if (state.isSubmitting) {
        return;
      }

      if (tabButton) {
        state.activeTab = ['take', 'target', 'receipt'].includes(tabButton.dataset.tabId)
          ? tabButton.dataset.tabId
          : 'take';
        renderView();
        return;
      }

      if (previousButton) {
        state.currentQuestionIndex = Math.max(0, state.currentQuestionIndex - 1);
        renderView();
        return;
      }

      if (nextButton) {
        const currentQuestion = state.quizVariant?.questions?.[state.currentQuestionIndex] || null;

        if (currentQuestion && !isQuizQuestionAnswered(currentQuestion, state.answers[currentQuestion.id])) {
          state.answerErrors = {
            ...state.answerErrors,
            [currentQuestion.id]: getRequiredAnswerMessage(currentQuestion),
          };
          renderView();
          return;
        }

        state.currentQuestionIndex = Math.min(
          Math.max(0, Number(state.quizVariant?.questions?.length || 1) - 1),
          state.currentQuestionIndex + 1,
        );
        renderView();
        return;
      }

      if (refreshButton) {
        state.previewSeed = Date.now();
        resetQuizWork();
        state.activeTab = 'take';
        syncQuizVariant();
        renderView();
        showToast({
          title: 'Đã tạo đề thử mới',
          message: 'Hệ thống đã random lại câu hỏi/đáp án cho lượt test admin này.',
          variant: 'success',
        });
        return;
      }

      if (resetButton) {
        resetQuizWork();
        state.activeTab = 'take';
        renderView();
      }
    });

    root.addEventListener('submit', async (event) => {
      if (!event.target.closest('#student-quiz-form') || !state.quizVariant || !state.quizConfig) {
        return;
      }

      event.preventDefault();

      const selectedClass = getSelectedClass(state);
      const selectedStudent = getSelectedStudent(state);

      if (!selectedClass || !selectedStudent) {
        state.submitError = 'Hãy chọn lớp trước khi gửi kết quả test admin vào trung tâm điểm.';
        renderView();
        return;
      }

      const validation = validateQuizAnswerMap(state.quizVariant, state.answers);

      if (!validation.isValid) {
        const firstInvalidQuestionId = Object.keys(validation.errors)[0] || '';
        const firstInvalidIndex = (state.quizVariant.questions || []).findIndex(
          (question) => question.id === firstInvalidQuestionId,
        );

        state.answerErrors = normalizeAnswerErrors(state.quizVariant, validation.errors);
        state.currentQuestionIndex = firstInvalidIndex >= 0 ? firstInvalidIndex : state.currentQuestionIndex;
        state.submittedRecord = null;
        state.submitError = '';
        renderView();
        return;
      }

      state.answerErrors = {};
      state.isSubmitting = true;
      state.submitError = '';
      renderView();

      try {
        state.submittedRecord = await recordAdminQuizPreviewSubmission({
          classItem: selectedClass,
          program: state.program,
          quizConfig: state.quizConfig,
          quizVariant: state.quizVariant,
          answers: state.answers,
        });
        state.activeTab = 'receipt';
        showToast({
          title: 'Đã gửi vào trung tâm điểm',
          message: `Bài nộp của ${selectedStudent.fullName} đã xuất hiện trong khu quản lý điểm của lớp ${selectedClass.classCode}.`,
          variant: 'success',
        });
      } catch (error) {
        state.submittedRecord = null;
        state.submitError = error?.message || 'Không thể gửi kết quả vào trung tâm điểm.';
        showToast({
          title: 'Chưa gửi được kết quả',
          message: state.submitError,
          variant: 'danger',
        });
      } finally {
        state.isSubmitting = false;
        renderView();
      }
    });

    await load();

    return () => {
      disposed = true;
    };
  },
};
