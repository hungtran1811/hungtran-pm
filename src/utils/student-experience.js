import { QUIZ_STUDENT_ENABLED } from '../config/features.js';
import {
  buildCurriculumVisibleLessons,
  getActiveCurriculumLessons,
  getCurriculumActivityTypeLabel,
  getCurriculumSessionActivity,
  isCurriculumQuizActivity,
} from './curriculum-program.js';
import { hasLessonExerciseContent } from './lesson-markdown.js';

function toSessionNumber(value, fallback = 1) {
  const numericValue = Number(value || fallback || 1);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.floor(numericValue) : fallback;
}

function isClassStudentAccessible(classInfo = null) {
  return Boolean(classInfo && classInfo.status === 'active' && !classInfo.hidden);
}

function getCurrentSessionActivity(preview = {}) {
  const sessionNumber = toSessionNumber(preview?.assignment?.currentSession, 1);
  return getCurriculumSessionActivity(preview?.program, sessionNumber);
}

export function buildProgramStudentExperienceContext(program, sessionNumber = 1) {
  const currentSession = toSessionNumber(sessionNumber, 1);
  const assignment = {
    programId: program?.id || '',
    currentSession,
    curriculumPhase: 'learning',
    exerciseVisibleSessions: [],
  };
  const lessons = getActiveCurriculumLessons(program).map((lesson) => ({
    ...lesson,
    exerciseVisible: hasLessonExerciseContent(lesson),
  }));
  const preview = {
    classInfo: {
      classCode: '',
      className: '',
      status: 'preview',
      hidden: false,
    },
    assignment,
    program: program
      ? {
          ...program,
          lessons,
        }
      : null,
    lessons,
    visibleLessons: buildCurriculumVisibleLessons(program, lessons, assignment),
    checklistItems: [],
  };

  return {
    preview,
    capabilities: buildStudentExperienceCapabilities(preview, {
      mode: 'content_preview',
    }),
  };
}

export function buildStudentExperienceCapabilities(preview = {}, { mode = 'class_review' } = {}) {
  const classInfo = preview?.classInfo || null;
  const assignment = preview?.assignment || null;
  const program = preview?.program || null;
  const currentSession = toSessionNumber(assignment?.currentSession, 1);
  const currentActivity = getCurrentSessionActivity(preview);
  const isContentPreview = mode === 'content_preview';
  const hasClass = Boolean(classInfo?.classCode);
  const hasProgram = Boolean(program);
  const classAccessible = isContentPreview || isClassStudentAccessible(classInfo);
  const canViewLibrary = Boolean(hasProgram && classAccessible);
  const isQuizSession = isCurriculumQuizActivity(currentActivity?.activityType);
  const isFinalProjectReport =
    Boolean(canViewLibrary && assignment?.curriculumPhase === 'final' && program?.finalMode === 'project');
  const badges = [];

  if (isContentPreview) {
    badges.push({
      label: 'Bản xem nội dung',
      detail: 'Không kiểm tra submit hoặc quyền học sinh thật.',
      variant: 'info',
    });
  } else if (!hasClass) {
    badges.push({
      label: 'Thiếu dữ liệu lớp',
      detail: 'Chọn một lớp active để đối chiếu đúng góc nhìn học sinh.',
      variant: 'warning',
    });
  } else if (!classAccessible) {
    badges.push({
      label: 'Chưa mở cho học sinh',
      detail: classInfo?.hidden
        ? 'Lớp đang ẩn khỏi luồng học sinh.'
        : 'Lớp không còn ở trạng thái đang hoạt động.',
      variant: 'danger',
    });
  } else {
    badges.push({
      label: 'Học sinh xem được',
      detail: 'Lớp active và không bị ẩn.',
      variant: 'success',
    });
  }

  if (!hasProgram) {
    badges.push({
      label: 'Thiếu chương trình',
      detail: 'Lớp chưa được gán chương trình học.',
      variant: 'danger',
    });
  }

  if (isQuizSession) {
    badges.push({
      label: QUIZ_STUDENT_ENABLED ? 'Quiz student bật' : 'Quiz student đang tắt',
      detail: QUIZ_STUDENT_ENABLED
        ? 'Học sinh có thể thấy luồng quiz nếu các điều kiện khác hợp lệ.'
        : 'Góc nhìn học sinh chỉ hiển thị trạng thái chưa mở quiz.',
      variant: QUIZ_STUDENT_ENABLED ? 'success' : 'warning',
    });
  }

  if (isFinalProjectReport) {
    badges.push({
      label: 'Form báo cáo khả dụng',
      detail: 'Lớp đang ở giai đoạn sản phẩm cuối khóa.',
      variant: 'success',
    });
  }

  return {
    mode,
    hasClass,
    hasProgram,
    classAccessible,
    canViewLibrary,
    currentSession,
    currentActivityType: currentActivity?.activityType || 'lesson',
    currentActivityLabel: getCurriculumActivityTypeLabel(currentActivity?.activityType),
    isQuizSession,
    quizStudentEnabled: QUIZ_STUDENT_ENABLED,
    quizVisibleToStudent: Boolean(canViewLibrary && isQuizSession && QUIZ_STUDENT_ENABLED),
    reportAvailable: isFinalProjectReport,
    badges,
  };
}
