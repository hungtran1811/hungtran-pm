import { getProjectStageChecklist } from '../demo/project-stage-guide.js';
import {
  QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS,
  QUIZ_MODE_OFFICIAL,
} from './quiz.js';

export const CURRICULUM_ACTIVITY_TYPE_LESSON = 'lesson';
export const CURRICULUM_ACTIVITY_TYPE_OFFICIAL_QUIZ = QUIZ_MODE_OFFICIAL;
export const CURRICULUM_ACTIVITY_TYPES = [
  CURRICULUM_ACTIVITY_TYPE_LESSON,
  CURRICULUM_ACTIVITY_TYPE_OFFICIAL_QUIZ,
];

export const CURRICULUM_ACTIVITY_TYPE_LABELS = {
  [CURRICULUM_ACTIVITY_TYPE_LESSON]: 'Học kiến thức',
  [CURRICULUM_ACTIVITY_TYPE_OFFICIAL_QUIZ]: 'Kiểm tra',
};

function coerceText(value) {
  return String(value ?? '').trim();
}

function coerceArray(values) {
  return Array.isArray(values) ? values : [];
}

function coerceBoolean(value) {
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }

  return Boolean(value);
}

export function getDefaultCurriculumActivityType(sessionNumber = 0) {
  return QUIZ_DEFAULT_OFFICIAL_SESSION_NUMBERS.includes(Number(sessionNumber || 0))
    ? CURRICULUM_ACTIVITY_TYPE_OFFICIAL_QUIZ
    : CURRICULUM_ACTIVITY_TYPE_LESSON;
}

export function normalizeCurriculumActivityType(value = '', sessionNumber = 0) {
  const normalizedValue = coerceText(value).toLowerCase();

  if (
    normalizedValue === CURRICULUM_ACTIVITY_TYPE_OFFICIAL_QUIZ
    || normalizedValue === 'official'
    || normalizedValue === 'quiz'
    || normalizedValue === 'test'
    || normalizedValue === 'practice'
    || normalizedValue === 'game'
    || normalizedValue === 'quiz_game'
    || normalizedValue === 'game_quiz'
  ) {
    return CURRICULUM_ACTIVITY_TYPE_OFFICIAL_QUIZ;
  }

  if (normalizedValue === CURRICULUM_ACTIVITY_TYPE_LESSON || normalizedValue === 'knowledge') {
    return CURRICULUM_ACTIVITY_TYPE_LESSON;
  }

  return getDefaultCurriculumActivityType(sessionNumber);
}

export function getCurriculumActivityTypeLabel(activityType = CURRICULUM_ACTIVITY_TYPE_LESSON) {
  return CURRICULUM_ACTIVITY_TYPE_LABELS[normalizeCurriculumActivityType(activityType)]
    || CURRICULUM_ACTIVITY_TYPE_LABELS[CURRICULUM_ACTIVITY_TYPE_LESSON];
}

export function isCurriculumQuizActivity(activityType = '') {
  const normalizedType = normalizeCurriculumActivityType(activityType);
  return normalizedType === CURRICULUM_ACTIVITY_TYPE_OFFICIAL_QUIZ;
}

function isLikelyUrl(value) {
  const rawValue = coerceText(value);
  return /^https?:\/\//i.test(rawValue) || /^www\./i.test(rawValue);
}

function normalizeLegacyCoverImage(input = null) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const secureUrl = coerceText(input.secureUrl);

  if (!secureUrl) {
    return null;
  }

  return {
    id: coerceText(input.id) || createCurriculumItemId('lesson-image'),
    secureUrl,
    publicId: coerceText(input.publicId),
    width: Math.max(0, Number(input.width || 0)),
    height: Math.max(0, Number(input.height || 0)),
    alt: coerceText(input.alt),
    order: Math.max(1, Number(input.order || 1)),
  };
}

function normalizeLessonImageRecord(input = {}, fallbackId = 'lesson-image', order = 1) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const secureUrl = coerceText(input.secureUrl);

  if (!secureUrl) {
    return null;
  }

  return {
    id: coerceText(input.id) || createCurriculumItemId(fallbackId),
    secureUrl,
    publicId: coerceText(input.publicId),
    width: Math.max(0, Number(input.width || 0)),
    height: Math.max(0, Number(input.height || 0)),
    alt: coerceText(input.alt),
    order: Math.max(1, Number(input.order || order || 1)),
  };
}

function normalizeLessonImages(images = [], coverImage = null) {
  const normalizedImages = coerceArray(images)
    .map((item, index) => normalizeLessonImageRecord(item, 'lesson-image', index + 1))
    .filter(Boolean);

  if (normalizedImages.length > 0) {
    return normalizedImages
      .sort((left, right) => {
        if (left.order !== right.order) {
          return left.order - right.order;
        }

        return left.id.localeCompare(right.id, 'vi');
      })
      .map((item, index) => ({
        ...item,
        order: index + 1,
      }));
  }

  const legacyCoverImage = normalizeLegacyCoverImage(coverImage);

  if (!legacyCoverImage) {
    return [];
  }

  return [{ ...legacyCoverImage, order: 1 }];
}

function normalizeLessonBannerImage(input = null) {
  return normalizeLessonImageRecord(input, 'lesson-banner', 1);
}

function normalizeReviewLinkRecord(input = {}, fallbackId = 'review-link', order = 1) {
  if (typeof input === 'string') {
    const rawValue = coerceText(input);

    if (!rawValue) {
      return null;
    }

    return {
      id: createCurriculumItemId(fallbackId),
      label: rawValue,
      url: rawValue,
      order,
    };
  }

  if (!input || typeof input !== 'object') {
    return null;
  }

  const label = coerceText(input.label);
  const url = coerceText(input.url);

  if (!label && !url) {
    return null;
  }

  return {
    id: coerceText(input.id) || createCurriculumItemId(fallbackId),
    label: label || url,
    url: url || label,
    order: Math.max(1, Number(input.order || order || 1)),
  };
}

function normalizeReviewLinks(reviewLinks = []) {
  return coerceArray(reviewLinks)
    .map((item, index) => normalizeReviewLinkRecord(item, 'review-link', index + 1))
    .filter(Boolean)
    .sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }

      return left.label.localeCompare(right.label, 'vi');
    })
    .map((item, index) => ({
      ...item,
      order: index + 1,
    }));
}

export function normalizeSessionActivityRecord(input = {}, fallbackSessionNumber = 1) {
  const sessionNumber = Math.max(1, Number(input.sessionNumber || fallbackSessionNumber || 1));

  return {
    sessionNumber,
    activityType: normalizeCurriculumActivityType(input.activityType, sessionNumber),
  };
}

export function normalizeSessionActivities(records = [], totalSessionCount = 1) {
  const limit = Math.max(1, Number(totalSessionCount || 1));
  const activitiesBySession = new Map();

  coerceArray(records).forEach((item, index) => {
    const activity = normalizeSessionActivityRecord(item, index + 1);

    if (activity.sessionNumber >= 1 && activity.sessionNumber <= limit) {
      activitiesBySession.set(activity.sessionNumber, activity);
    }
  });

  return Array.from({ length: limit }, (_, index) => {
    const sessionNumber = index + 1;
    return (
      activitiesBySession.get(sessionNumber) || {
        sessionNumber,
        activityType: getDefaultCurriculumActivityType(sessionNumber),
      }
    );
  });
}

export function createCurriculumItemId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function sortCurriculumLessons(lessons = []) {
  return [...lessons].sort((left, right) => {
    if (left.sessionNumber !== right.sessionNumber) {
      return left.sessionNumber - right.sessionNumber;
    }

    return left.title.localeCompare(right.title, 'vi');
  });
}

export function sortCurriculumChecklist(items = []) {
  return [...items].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.title.localeCompare(right.title, 'vi');
  });
}

export function clampKnowledgeSession(program, sessionNumber) {
  const maxSession = Math.max(
    1,
    Number(program?.totalSessionCount || program?.knowledgePhaseEndSession || 1),
  );
  const numericSession = Number(sessionNumber || 1);
  return Math.min(maxSession, Math.max(1, Number.isFinite(numericSession) ? numericSession : 1));
}

export function normalizeLessonRecord(input = {}, fallbackId = 'lesson') {
  const images = normalizeLessonImages(input.images, input.coverImage);
  const bannerImage = normalizeLessonBannerImage(input.bannerImage);
  const legacyMarkdown = coerceText(input.contentMarkdown);
  const lectureMarkdown = coerceText(input.lectureMarkdown) || legacyMarkdown;
  const exerciseMarkdown = coerceText(input.exerciseMarkdown);

  return {
    id: coerceText(input.id) || createCurriculumItemId(fallbackId),
    sessionNumber: Math.max(1, Number(input.sessionNumber || 1)),
    title: coerceText(input.title),
    contentMarkdown: lectureMarkdown,
    lectureMarkdown,
    exerciseMarkdown,
    exerciseVisible: coerceBoolean(input.exerciseVisible) && Boolean(exerciseMarkdown),
    summary: coerceText(input.summary),
    keyPoints: coerceArray(input.keyPoints)
      .map(coerceText)
      .filter(Boolean),
    practiceTask: coerceText(input.practiceTask),
    selfStudyPrompt: coerceText(input.selfStudyPrompt),
    reviewLinks: normalizeReviewLinks(input.reviewLinks),
    teacherNote: coerceText(input.teacherNote),
    bannerImage,
    images,
    coverImage: images[0] || null,
    archived: Boolean(input.archived),
  };
}

export function normalizeExamChecklistItemRecord(input = {}, fallbackId = 'checklist') {
  return {
    id: coerceText(input.id) || createCurriculumItemId(fallbackId),
    order: Math.max(1, Number(input.order || 1)),
    title: coerceText(input.title),
    description: coerceText(input.description),
    archived: Boolean(input.archived),
  };
}

export function normalizeProjectChecklistRecords(programId, records = []) {
  const defaults = getProjectStageChecklist(programId);
  const recordsByKey = new Map();

  coerceArray(records).forEach((record, index) => {
    const fallback = defaults[index];
    const candidateKey = coerceText(record?.stageKey || fallback?.stageKey);

    if (candidateKey) {
      recordsByKey.set(candidateKey, record);
    }
  });

  return defaults.map((item) => {
    const existing = recordsByKey.get(item.stageKey) || {};

    return {
      id: item.id,
      stageKey: item.stageKey,
      order: item.order,
      title: item.title,
      description: coerceText(existing.description) || item.description,
      studentGuide: coerceText(existing.studentGuide) || item.studentGuide,
      exampleOutput: coerceText(existing.exampleOutput) || item.exampleOutput,
    };
  });
}

export function getActiveCurriculumLessons(program) {
  return sortCurriculumLessons((program?.lessons || []).filter((lesson) => !lesson.archived));
}

export function getCurriculumSessionActivities(program) {
  const totalSessionCount = Math.max(
    1,
    Number(program?.totalSessionCount || program?.knowledgePhaseEndSession || 1),
  );

  return normalizeSessionActivities(program?.sessionActivities || [], totalSessionCount);
}

export function getCurriculumSessionActivity(program, sessionNumber = 1) {
  const normalizedSessionNumber = Math.max(1, Number(sessionNumber || 1));
  return (
    getCurriculumSessionActivities(program).find((item) => item.sessionNumber === normalizedSessionNumber) || {
      sessionNumber: normalizedSessionNumber,
      activityType: getDefaultCurriculumActivityType(normalizedSessionNumber),
    }
  );
}

export function getArchivedCurriculumLessons(program) {
  return sortCurriculumLessons((program?.lessons || []).filter((lesson) => lesson.archived));
}

export function getActiveCurriculumChecklist(program) {
  if (!program) {
    return [];
  }

  if (program.finalMode === 'project') {
    return sortCurriculumChecklist(program.finalChecklist || []);
  }

  return sortCurriculumChecklist((program.finalChecklist || []).filter((item) => !item.archived));
}

export function getArchivedCurriculumChecklist(program) {
  if (!program || program.finalMode === 'project') {
    return [];
  }

  return sortCurriculumChecklist((program.finalChecklist || []).filter((item) => item.archived));
}

export function isCurriculumReviewLinkValid(link) {
  return isLikelyUrl(link?.url);
}
