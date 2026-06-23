import { toDate } from '../lib/firestore.js';
import { DEFAULT_STAGE, DEFAULT_STATUS } from '../constants/index.js';

export function toClassModel(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    classCode: data.classCode ?? snapshot.id,
    className: data.className ?? '',
    status: data.status ?? 'active',
    hidden: Boolean(data.hidden ?? false),
    startDate: data.startDate ?? '',
    endDate: data.endDate ?? '',
    curriculumProgramId: data.curriculumProgramId ?? '',
    curriculumPhase: data.curriculumPhase ?? 'learning',
    curriculumCurrentSession: Number(data.curriculumCurrentSession ?? 0),
    curriculumExerciseVisibleSessions: Array.isArray(data.curriculumExerciseVisibleSessions)
      ? data.curriculumExerciseVisibleSessions.map((n) => Number(n))
      : [],
    finalMode: data.finalMode === 'exam' ? 'exam' : 'project',
    studentCount: Number(data.studentCount ?? 0),
    activeShowdownSessionId: data.activeShowdownSessionId ?? null,
    activeSpySessionId: data.activeSpySessionId ?? null,
    completedAt: toDate(data.completedAt),
    codeSubmissionsPurgedAt: toDate(data.codeSubmissionsPurgedAt),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toStudentModel(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    fullName: data.fullName ?? '',
    fullNameKey: data.fullNameKey ?? '',
    classId: data.classId ?? data.classCode ?? '',
    classCode: data.classCode ?? data.classId ?? '',
    active: Boolean(data.active ?? true),
    projectName: data.projectName ?? '',
    projectNameSubmission: data.projectNameSubmission ?? '',
    projectNameStatus: data.projectNameStatus ?? '',
    projectNameReviewNote: data.projectNameReviewNote ?? '',
    projectNameSubmittedAt: toDate(data.projectNameSubmittedAt),
    projectGithubUrl: data.projectGithubUrl ?? '',
    projectCanvaUrl: data.projectCanvaUrl ?? '',
    currentStatus: data.currentStatus ?? DEFAULT_STATUS,
    currentStage: data.currentStage ?? DEFAULT_STAGE,
    currentProgressPercent: Number(data.currentProgressPercent ?? 0),
    currentDifficulties: data.currentDifficulties ?? '',
    latestReportId: data.latestReportId ?? '',
    lastReportedAt: toDate(data.lastReportedAt),
    progressStalledCount: Number(data.progressStalledCount ?? 0),
    lastOpenedLessonId: data.lastOpenedLessonId ?? '',
    lastOpenedSessionNumber: Number(data.lastOpenedSessionNumber ?? 0),
    lastOpenedAt: toDate(data.lastOpenedAt),
    openedLessonIds: Array.isArray(data.openedLessonIds) ? data.openedLessonIds : [],
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toReportModel(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    classId: data.classId ?? '',
    classCode: data.classCode ?? '',
    studentId: data.studentId ?? '',
    studentName: data.studentName ?? '',
    projectName: data.projectName ?? '',
    progressPercent: Number(data.progressPercent ?? 0),
    stage: data.stage ?? DEFAULT_STAGE,
    status: data.status ?? DEFAULT_STATUS,
    doneToday: data.doneToday ?? '',
    nextGoal: data.nextGoal ?? '',
    difficulties: data.difficulties ?? '',
    projectGithubUrl: data.projectGithubUrl ?? '',
    projectCanvaUrl: data.projectCanvaUrl ?? '',
    submittedAt: toDate(data.submittedAt),
    submittedDateKey: data.submittedDateKey ?? '',
    source: data.source ?? 'student-form',
    createdAt: toDate(data.createdAt),
  };
}

export function toCodeSubmissionModel(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    classCode: data.classCode ?? '',
    studentId: data.studentId ?? '',
    studentName: data.studentName ?? '',
    sessionNumber: Number(data.sessionNumber ?? 0),
    files: Array.isArray(data.files)
      ? data.files.map((f) => ({
          id: f.id ?? '',
          name: f.name ?? '',
          contentType: f.contentType ?? '',
          sizeBytes: Number(f.sizeBytes ?? 0),
          uploadedAt: f.uploadedAt ?? '',
        }))
      : [],
    updatedAt: toDate(data.updatedAt),
  };
}

export function toFeedbackSummaryModel(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    feedbackId: data.feedbackId ?? snapshot.id,
    classCode: data.classCode ?? '',
    studentId: data.studentId ?? '',
    lessonId: data.lessonId ?? '',
    sessionNumber: Number(data.sessionNumber ?? 0),
    understoodTopics: data.understoodTopics ?? '',
    unclearTopics: data.unclearTopics ?? '',
    understandingLevel: Number(data.understandingLevel ?? 3),
    supportRequest: data.supportRequest ?? '',
    submittedAt: toDate(data.submittedAt),
  };
}

export function toQuizAttemptModel(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    attemptId: data.attemptId ?? snapshot.id,
    classCode: data.classCode ?? '',
    studentId: data.studentId ?? '',
    studentName: data.studentName ?? '',
    programId: data.programId ?? '',
    lessonId: data.lessonId ?? '',
    curriculumProgramId: data.curriculumProgramId ?? '',
    sessionNumber: Number(data.sessionNumber ?? 0),
    answers: data.answers && typeof data.answers === 'object' ? data.answers : {},
    submittedAt: toDate(data.submittedAt),
    createdAt: toDate(data.createdAt),
  };
}

export function toPracticeQuizSubmissionModel(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    submissionId: data.submissionId ?? snapshot.id,
    classCode: data.classCode ?? '',
    studentId: data.studentId ?? '',
    studentName: data.studentName ?? '',
    programId: data.programId ?? '',
    lessonId: data.lessonId ?? '',
    curriculumProgramId: data.curriculumProgramId ?? '',
    sessionNumber: Number(data.sessionNumber ?? 0),
    quizTitle: data.quizTitle ?? '',
    lessonTitle: data.lessonTitle ?? '',
    attemptCount: Number(data.attemptCount ?? 1),
    responses: Array.isArray(data.responses) ? data.responses : [],
    mcqCorrect: Number(data.mcqCorrect ?? 0),
    mcqTotal: Number(data.mcqTotal ?? 0),
    mcqPercent: Number(data.mcqPercent ?? 0),
    gradingStatus: data.gradingStatus ?? 'complete',
    source: data.source ?? 'practice-quiz-v1',
    submittedAt: toDate(data.submittedAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toStudentQuizSubmissionModel(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    classCode: data.classCode ?? '',
    studentId: data.studentId ?? '',
    studentName: data.studentName ?? '',
    programId: data.programId ?? '',
    lessonId: data.lessonId ?? '',
    curriculumProgramId: data.curriculumProgramId ?? '',
    sessionNumber: Number(data.sessionNumber ?? 0),
    quizTitle: data.quizTitle ?? '',
    lessonTitle: data.lessonTitle ?? '',
    attemptNumber: Number(data.attemptNumber ?? 1),
    maxAttempts: Number(data.maxAttempts ?? 0),
    timeLimitMinutes: Number(data.timeLimitMinutes ?? 0),
    startedAtMs: data.startedAtMs ?? null,
    durationSeconds: Number(data.durationSeconds ?? 0),
    responses: Array.isArray(data.responses) ? data.responses : [],
    mcqCorrect: Number(data.mcqCorrect ?? 0),
    mcqTotal: Number(data.mcqTotal ?? 0),
    mcqPercent: Number(data.mcqPercent ?? 0),
    codeCorrect: Number(data.codeCorrect ?? 0),
    codeGraded: Number(data.codeGraded ?? 0),
    gradedCorrect: Number(data.gradedCorrect ?? 0),
    gradedTotal: Number(data.gradedTotal ?? 0),
    gradedPercent: Number(data.gradedPercent ?? 0),
    unansweredCount: Number(data.unansweredCount ?? 0),
    gradingStatus: data.gradingStatus ?? 'complete',
    timedOut: Boolean(data.timedOut ?? false),
    submitReason: data.submitReason ?? 'manual',
    submittedAt: toDate(data.submittedAt),
    createdAt: toDate(data.createdAt),
  };
}

export function toKnowledgeReportModel(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    feedbackId: data.feedbackId ?? snapshot.id,
    classCode: data.classCode ?? '',
    studentId: data.studentId ?? '',
    studentName: data.studentName ?? '',
    curriculumProgramId: data.curriculumProgramId ?? '',
    sessionNumber: Number(data.sessionNumber ?? 0),
    lessonId: data.lessonId ?? '',
    understoodTopics: data.understoodTopics ?? '',
    unclearTopics: data.unclearTopics ?? '',
    understandingLevel: Number(data.understandingLevel ?? 0),
    supportRequest: data.supportRequest ?? '',
    submittedAt: toDate(data.submittedAt),
    createdAt: toDate(data.createdAt),
  };
}

function normalizeImageRecord(input) {
  if (!input || typeof input !== 'object') return null;
  const secureUrl = input.secureUrl ?? input.url ?? '';
  if (!secureUrl) return null;
  return {
    id: input.id ?? '',
    secureUrl,
    publicId: input.publicId ?? '',
    width: Number(input.width ?? 0),
    height: Number(input.height ?? 0),
    alt: input.alt ?? '',
    order: Number(input.order ?? 1),
  };
}

// The stored lesson schema uses lectureMarkdown/exerciseMarkdown and image
// objects (bannerImage/images/coverImage). We map them to display-friendly
// fields and keep `_raw` so saving back never drops unknown fields.
export function normalizeLesson(lesson = {}, index = 0) {
  const bannerImage = normalizeImageRecord(lesson.bannerImage);
  const images = Array.isArray(lesson.images)
    ? lesson.images.map(normalizeImageRecord).filter(Boolean)
    : [];
  const coverImage = images[0] || normalizeImageRecord(lesson.coverImage);

  return {
    id: lesson.id ?? `lesson-${index + 1}`,
    sessionNumber: Number(lesson.sessionNumber ?? index + 1),
    title: lesson.title ?? '',
    content: lesson.lectureMarkdown ?? lesson.contentMarkdown ?? lesson.content ?? '',
    exercise: lesson.exerciseMarkdown ?? lesson.exercise ?? '',
    exerciseVisible: Boolean(lesson.exerciseVisible ?? false),
    summary: lesson.summary ?? '',
    teacherNote: lesson.teacherNote ?? '',
    archived: Boolean(lesson.archived ?? false),
    bannerImage,
    coverImage,
    images,
    bannerImageUrl: bannerImage?.secureUrl ?? null,
    coverImageUrl: coverImage?.secureUrl ?? null,
    _raw: lesson,
  };
}

export function toCurriculumProgramModel(snapshot, lessonsOverride = null) {
  const data = snapshot.data() || {};
  const totalSessionCount = Number(data.totalSessionCount ?? data.knowledgePhaseEndSession ?? 14);
  const lessons =
    lessonsOverride !== null
      ? lessonsOverride
      : Array.isArray(data.lessons)
        ? data.lessons.map((lesson, index) => normalizeLesson(lesson, index)).sort(
            (a, b) => a.sessionNumber - b.sessionNumber,
          )
        : [];

  return {
    id: snapshot.id,
    name: data.name ?? '',
    subject: data.subject ?? '',
    level: data.level ?? '',
    knowledgePhaseEndSession: Number(data.knowledgePhaseEndSession ?? 1),
    totalSessionCount,
    finalMode: data.finalMode === 'exam' ? 'exam' : 'project',
    description: data.description ?? '',
    active: Boolean(data.active ?? true),
    lessonsStorage: data.lessonsStorage ?? 'embedded',
    lessons,
  };
}
