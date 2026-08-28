import { JSDOM } from 'jsdom';
import { marked } from 'marked';
import {
  LESSON_HTML_CLASSES,
  LESSON_HTML_MAX_BYTES,
  sanitizeLessonHtml as sanitizeSharedLessonHtml,
} from '../src/lib/lessonHtml.js';

export const MAX_LESSON_BYTES = LESSON_HTML_MAX_BYTES;
export const ALLOWED_LESSON_CLASSES = LESSON_HTML_CLASSES;

// DOMPurify officially supports jsdom for server-side sanitization. JSDOM does
// not execute scripts or fetch subresources unless explicitly configured.
const migrationDom = new JSDOM('', { url: 'https://lesson.local/' });
const migrationWindow = migrationDom.window;

export function sanitizeLessonHtml(value) {
  const html = typeof value === 'string' ? value : '';
  return sanitizeSharedLessonHtml(html, migrationWindow);
}

export function markdownToSafeHtml(value) {
  const markdown = typeof value === 'string' ? value : '';
  const rendered = marked.parse(markdown, {
    async: false,
    breaks: true,
    gfm: true,
  });
  return sanitizeLessonHtml(rendered);
}

export function serializedByteSize(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function firstStringField(record, fieldNames) {
  for (const fieldName of fieldNames) {
    if (typeof record?.[fieldName] === 'string') {
      return { fieldName, value: record[fieldName] };
    }
  }
  return null;
}

export function readLessonMarkdown(lesson = {}) {
  return {
    lecture: firstStringField(lesson, ['lectureMarkdown', 'contentMarkdown', 'content']),
    exercise: firstStringField(lesson, ['exerciseMarkdown', 'exercise']),
  };
}

function errorResult(reason, metrics = {}) {
  return { status: 'error', reason, metrics };
}

function skipResult(reason, metrics = {}) {
  return { status: 'skip', reason, metrics };
}

export function planLessonMutation(
  lesson,
  { operation = 'convert', maxBytes = MAX_LESSON_BYTES } = {},
) {
  if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) {
    return errorResult('invalid-lesson');
  }

  if (operation === 'rollback') {
    if (lesson.contentFormat !== 'html') return skipResult('not-html');
    const rollbackSources = readLessonMarkdown(lesson);
    if (!rollbackSources.lecture && !rollbackSources.exercise) {
      return skipResult('no-markdown-rollback-source');
    }

    const patch = { contentFormat: 'markdown' };
    const nextLesson = { ...lesson, ...patch };
    const serializedBytes = serializedByteSize(nextLesson);
    if (serializedBytes > maxBytes) {
      return errorResult('lesson-too-large', { serializedBytes, maxBytes });
    }
    return {
      status: 'change',
      reason: 'rollback-to-markdown',
      patch,
      nextLesson,
      metrics: { serializedBytes },
    };
  }

  if (operation !== 'convert') return errorResult('unknown-operation');
  if (lesson.contentFormat === 'html') {
    const hasCompleteHtmlSource =
      typeof lesson.lectureHtml === 'string' && typeof lesson.exerciseHtml === 'string';
    return hasCompleteHtmlSource
      ? skipResult('already-html')
      : errorResult('html-format-without-complete-html-source');
  }
  if (
    lesson.contentFormat != null &&
    lesson.contentFormat !== '' &&
    lesson.contentFormat !== 'markdown'
  ) {
    return errorResult('unknown-content-format');
  }

  const sources = readLessonMarkdown(lesson);
  if (!sources.lecture && !sources.exercise) return skipResult('no-markdown-source');

  try {
    const lectureMarkdown = sources.lecture?.value ?? '';
    const exerciseMarkdown = sources.exercise?.value ?? '';
    const lectureHtml = markdownToSafeHtml(lectureMarkdown);
    const exerciseHtml = markdownToSafeHtml(exerciseMarkdown);
    const patch = {
      contentFormat: 'html',
      lectureHtml,
      exerciseHtml,
    };
    const nextLesson = { ...lesson, ...patch };
    const metrics = {
      markdownBytes: Buffer.byteLength(`${lectureMarkdown}${exerciseMarkdown}`, 'utf8'),
      htmlBytes: Buffer.byteLength(`${lectureHtml}${exerciseHtml}`, 'utf8'),
      serializedBytes: serializedByteSize(nextLesson),
      lectureSource: sources.lecture?.fieldName ?? null,
      exerciseSource: sources.exercise?.fieldName ?? null,
    };

    if (metrics.serializedBytes > maxBytes) {
      return errorResult('lesson-too-large', { ...metrics, maxBytes });
    }

    return {
      status: 'change',
      reason: 'converted-to-html',
      patch,
      nextLesson,
      metrics,
    };
  } catch (error) {
    return errorResult('conversion-failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function planEmbeddedLessons(
  lessons,
  { operation = 'convert', maxBytes = MAX_LESSON_BYTES } = {},
) {
  if (!Array.isArray(lessons)) {
    return { changed: false, nextLessons: lessons, results: [] };
  }

  let changed = false;
  const results = lessons.map((lesson, index) => {
    const result = planLessonMutation(lesson, { operation, maxBytes });
    if (result.status === 'change') changed = true;
    return { index, lessonId: lesson?.id ?? null, ...result };
  });
  const nextLessons = lessons.map((lesson, index) => results[index].nextLesson ?? lesson);

  return { changed, nextLessons, results };
}
