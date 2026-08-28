import { JSDOM } from 'jsdom';
import {
  LESSON_HTML_MAX_BYTES,
  LESSON_PRESENTATION_PRESET_LEGACY,
  LESSON_PRESENTATION_PRESET_MANAGED,
  hasRenderableManagedLessonHtml,
  sanitizeManagedLessonHtml,
} from '../src/lib/lessonHtml.js';

export const MAX_LESSON_BYTES = LESSON_HTML_MAX_BYTES;

const migrationDom = new JSDOM('', { url: 'https://lesson.local/' });
const migrationWindow = migrationDom.window;

export function serializedLessonByteSize(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function result(status, reason, extra = {}) {
  return { status, reason, ...extra };
}

function htmlParts(lesson) {
  return [
    ['lectureHtml', lesson?.lectureHtml],
    ['exerciseHtml', lesson?.exerciseHtml],
  ].filter(([, value]) => typeof value === 'string');
}

/**
 * Plans a preset-only lesson mutation. Source HTML is inspected through the
 * managed sanitizer but is never rewritten by this migration.
 */
export function planLessonPresentationMutation(
  lesson,
  { operation = 'managed', maxBytes = MAX_LESSON_BYTES } = {},
) {
  if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) {
    return result('error', 'invalid-lesson');
  }
  if (!['managed', 'rollback'].includes(operation)) {
    return result('error', 'unknown-operation');
  }
  if (lesson.contentFormat !== 'html') return result('skip', 'not-html');

  if (operation === 'rollback') {
    if (lesson.presentationPreset !== LESSON_PRESENTATION_PRESET_MANAGED) {
      return result('skip', 'not-managed');
    }
    const patch = { presentationPreset: LESSON_PRESENTATION_PRESET_LEGACY };
    const nextLesson = { ...lesson, ...patch };
    const serializedBytes = serializedLessonByteSize(nextLesson);
    if (serializedBytes > maxBytes) {
      return result('error', 'lesson-too-large', {
        metrics: { serializedBytes, maxBytes },
      });
    }
    return result('change', 'rollback-to-legacy', {
      patch,
      nextLesson,
      metrics: { serializedBytes },
    });
  }

  if (lesson.presentationPreset === LESSON_PRESENTATION_PRESET_MANAGED) {
    return result('skip', 'already-managed');
  }
  if (
    lesson.presentationPreset != null &&
    lesson.presentationPreset !== '' &&
    lesson.presentationPreset !== LESSON_PRESENTATION_PRESET_LEGACY
  ) {
    return result('error', 'unknown-presentation-preset');
  }

  const parts = htmlParts(lesson);
  if (!parts.length) return result('skip', 'no-html-source');

  let sourceBytes = 0;
  let managedBytes = 0;
  let renderableParts = 0;
  const unrenderableFields = [];
  for (const [field, source] of parts) {
    sourceBytes += Buffer.byteLength(source, 'utf8');
    if (!source.trim()) continue;
    const managed = sanitizeManagedLessonHtml(source, migrationWindow);
    managedBytes += Buffer.byteLength(managed, 'utf8');
    if (hasRenderableManagedLessonHtml(managed, migrationWindow)) renderableParts += 1;
    else unrenderableFields.push(field);
  }

  if (!renderableParts || unrenderableFields.length) {
    return result('skip', 'unrenderable-managed-html', {
      metrics: { sourceBytes, managedBytes, unrenderableFields },
    });
  }

  const patch = { presentationPreset: LESSON_PRESENTATION_PRESET_MANAGED };
  const nextLesson = { ...lesson, ...patch };
  const serializedBytes = serializedLessonByteSize(nextLesson);
  const metrics = { sourceBytes, managedBytes, serializedBytes, renderableParts };
  if (serializedBytes > maxBytes) {
    return result('error', 'lesson-too-large', {
      metrics: { ...metrics, maxBytes },
    });
  }

  return result('change', 'use-managed-presentation', {
    patch,
    nextLesson,
    metrics,
  });
}

export function planEmbeddedLessonPresentations(
  lessons,
  { operation = 'managed', maxBytes = MAX_LESSON_BYTES } = {},
) {
  if (!Array.isArray(lessons)) {
    return { changed: false, nextLessons: lessons, results: [] };
  }

  let changed = false;
  const results = lessons.map((lesson, index) => {
    const planned = planLessonPresentationMutation(lesson, { operation, maxBytes });
    if (planned.status === 'change') changed = true;
    return { index, lessonId: lesson?.id ?? null, ...planned };
  });
  const nextLessons = lessons.map((lesson, index) => results[index].nextLesson ?? lesson);
  return { changed, nextLessons, results };
}
