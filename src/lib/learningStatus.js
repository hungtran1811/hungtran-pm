import {
  isProjectNameAwaitingReview,
  needsProjectNameSetup,
  projectNameDisplay,
  resolveFinalMode,
} from './classFinalMode.js';
import { unlockedLessonSessionCap } from './sessionScope.js';
import { daysSince, STALE_REPORT_DAYS } from './submissionTracking.js';
import { FEATURE_KNOWLEDGE_FEEDBACK_ENABLED } from '../config/features.js';

function normalizeSet(value) {
  if (!value) return new Set();
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set(value.filter(Boolean));
  if (value instanceof Map) return new Set([...value.values()].flat().filter(Boolean));
  if (typeof value === 'object') return new Set(Object.values(value).flat().filter(Boolean));
  return new Set();
}

function firstOpenLesson(lessons, predicate) {
  return lessons.find(predicate) || null;
}

export function getOpenLessonsForClass(classDoc, program) {
  if (!program?.lessons?.length) return [];
  const sessionCap = unlockedLessonSessionCap(classDoc);
  return program.lessons
    .filter((lesson) => !lesson.archived && Number(lesson.sessionNumber) <= sessionCap)
    .sort((a, b) => Number(a.sessionNumber) - Number(b.sessionNumber));
}

export function buildStudentLearningStatus({
  classDoc,
  student,
  program,
  submittedLessonIds = [],
  lessonActivity = {},
  quizLessonIds = [],
  practiceLessonIds = [],
  now = Date.now(),
} = {}) {
  const isFinalPhase = classDoc?.curriculumPhase === 'final';
  const finalMode = resolveFinalMode(classDoc, program);
  const openLessons = getOpenLessonsForClass(classDoc, program);
  const openLessonIds = new Set(openLessons.map((lesson) => lesson.id));
  const submittedSet = normalizeSet(submittedLessonIds);
  const quizSet = normalizeSet(quizLessonIds);
  const practiceSet = normalizeSet(practiceLessonIds);

  const feedbackDone = !FEATURE_KNOWLEDGE_FEEDBACK_ENABLED || isFinalPhase
    ? null
    : openLessons.filter((lesson) => submittedSet.has(lesson.id)).length;
  const feedbackTotal = !FEATURE_KNOWLEDGE_FEEDBACK_ENABLED || isFinalPhase ? null : openLessons.length;
  const pendingFeedback = feedbackTotal === null ? null : Math.max(0, feedbackTotal - feedbackDone);

  const requiredPracticeLessons = openLessons.filter((lesson) => practiceSet.has(lesson.id));
  const requiredQuizLessons = openLessons.filter((lesson) => quizSet.has(lesson.id));
  const practiceDone = requiredPracticeLessons.filter(
    (lesson) => lessonActivity[lesson.id]?.practiceDone,
  ).length;
  const quizSubmitted = requiredQuizLessons.filter(
    (lesson) => lessonActivity[lesson.id]?.quizSubmitted,
  ).length;

  const staleDays = student?.lastReportedAt ? daysSince(student.lastReportedAt) : null;
  const needsReport =
    isFinalPhase
    && finalMode === 'project'
    && (!student?.lastReportedAt || (staleDays !== null && staleDays >= STALE_REPORT_DAYS));
  const pendingProjectNameReview = isProjectNameAwaitingReview(student);
  const missingProjectName = needsProjectNameSetup(student, classDoc, program);
  const needsSupport =
    student?.currentStatus === 'Cần hỗ trợ'
    || Boolean(String(student?.currentDifficulties || '').trim());

  const pendingPracticeLessons = requiredPracticeLessons.filter(
    (lesson) => !lessonActivity[lesson.id]?.practiceDone,
  );
  const pendingQuizLessons = requiredQuizLessons.filter(
    (lesson) => !lessonActivity[lesson.id]?.quizSubmitted,
  );

  let nextAction = null;
  if (needsSupport) {
    nextAction = {
      tone: 'red',
      title: 'Cần giáo viên hỗ trợ',
      description: student?.currentDifficulties || 'Học sinh đang ở trạng thái cần hỗ trợ.',
    };
  } else if (isFinalPhase && finalMode === 'project') {
    if (pendingProjectNameReview) {
      nextAction = {
        tone: 'amber',
        title: 'Tên dự án đang chờ duyệt',
        description: projectNameDisplay(student) || 'Giáo viên sẽ duyệt tên dự án.',
      };
    } else if (missingProjectName) {
      nextAction = {
        tone: 'amber',
        title: 'Đặt tên dự án',
        description: 'Hoàn tất tên dự án trước khi gửi tiến độ chi tiết.',
      };
    } else if (needsReport) {
      nextAction = {
        tone: 'amber',
        title: student?.lastReportedAt ? 'Cập nhật báo cáo tiến độ' : 'Gửi báo cáo đầu tiên',
        description: student?.lastReportedAt
          ? `${staleDays} ngày chưa có báo cáo mới.`
          : 'Chưa có báo cáo tiến độ nào.',
      };
    }
  } else if (FEATURE_KNOWLEDGE_FEEDBACK_ENABLED && pendingFeedback > 0) {
    const lesson = firstOpenLesson(openLessons, (item) => !submittedSet.has(item.id));
    nextAction = {
      tone: 'amber',
      title: 'Gửi phản hồi buổi học',
      description: lesson
        ? `Còn phản hồi buổi ${lesson.sessionNumber}: ${lesson.title || 'Bài học'}`
        : `Còn ${pendingFeedback} buổi chưa phản hồi.`,
    };
  } else if (pendingPracticeLessons.length > 0) {
    const lesson = pendingPracticeLessons[0];
    nextAction = {
      tone: 'blue',
      title: 'Làm bài ôn tập',
      description: `Buổi ${lesson.sessionNumber}: ${lesson.title || 'Bài học'}`,
    };
  } else if (pendingQuizLessons.length > 0) {
    const lesson = pendingQuizLessons[0];
    nextAction = {
      tone: 'blue',
      title: 'Hoàn thành quiz kiểm tra',
      description: `Buổi ${lesson.sessionNumber}: ${lesson.title || 'Bài học'}`,
    };
  } else {
    nextAction = {
      tone: 'green',
      title: 'Đang đúng tiến độ',
      description: isFinalPhase
        ? 'Tiếp tục cập nhật tiến độ đều đặn.'
        : 'Các việc đã mở hiện đã hoàn thành.',
    };
  }

  const lessonStatuses = openLessons.map((lesson) => ({
    lesson,
    feedbackDone: FEATURE_KNOWLEDGE_FEEDBACK_ENABLED ? submittedSet.has(lesson.id) : true,
    practiceRequired: practiceSet.has(lesson.id),
    practiceDone: Boolean(lessonActivity[lesson.id]?.practiceDone),
    practiceScore: lessonActivity[lesson.id]?.practiceScore ?? null,
    quizRequired: quizSet.has(lesson.id),
    quizSubmitted: Boolean(lessonActivity[lesson.id]?.quizSubmitted),
    opened: openLessonIds.has(lesson.id),
  }));

  const timestampNow = Number(now) || Date.now();

  return {
    isFinalPhase,
    finalMode,
    openLessons,
    feedbackDone,
    feedbackTotal,
    pendingFeedback,
    practiceDone,
    practiceTotal: requiredPracticeLessons.length,
    pendingPracticeLessons,
    quizSubmitted,
    quizTotal: requiredQuizLessons.length,
    pendingQuizLessons,
    staleDays,
    needsReport,
    pendingProjectNameReview,
    missingProjectName,
    needsSupport,
    nextAction,
    lessonStatuses,
    generatedAt: new Date(timestampNow),
  };
}
