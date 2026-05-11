import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { escapeHtml } from './html.js';

marked.use({
  gfm: true,
  breaks: true,
});

export const LESSON_MARKDOWN_TAB_LECTURE = 'lecture';
export const LESSON_MARKDOWN_TAB_EXERCISE = 'exercise';

function toText(value) {
  return String(value ?? '').trim();
}

function toList(values) {
  return Array.isArray(values)
    ? values.map((item) => toText(item)).filter(Boolean)
    : [];
}

function escapeMarkdownText(value) {
  return toText(value).replaceAll('\\', '\\\\');
}

function appendSection(lines, heading, body) {
  const value = toText(body);

  if (!value) {
    return;
  }

  lines.push(`## ${heading}`);
  lines.push('');
  lines.push(value);
  lines.push('');
}

function appendListSection(lines, heading, values) {
  const items = toList(values);

  if (items.length === 0) {
    return;
  }

  lines.push(`## ${heading}`);
  lines.push('');
  items.forEach((item) => {
    lines.push(`- ${escapeMarkdownText(item)}`);
  });
  lines.push('');
}

export function buildLegacyLessonMarkdown(lesson = {}) {
  const lines = [];
  const title = toText(lesson.title);

  if (title) {
    lines.push(`# ${title}`);
    lines.push('');
  }

  appendSection(lines, 'Tóm tắt', lesson.summary);
  appendListSection(lines, 'Ý chính cần nhớ', lesson.keyPoints);
  appendSection(lines, 'Bài toán gợi ý', lesson.practiceTask);
  appendSection(lines, 'Tự tìm hiểu thêm', lesson.selfStudyPrompt);

  return lines.join('\n').trim();
}

export function normalizeLessonMarkdownTab(value = '') {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (['exercise', 'exercises', 'practice', 'bai-tap', 'bài tập'].includes(normalized)) {
    return LESSON_MARKDOWN_TAB_EXERCISE;
  }

  return LESSON_MARKDOWN_TAB_LECTURE;
}

export function hasLessonExerciseContent(lesson = {}) {
  return Boolean(toText(lesson.exerciseMarkdown));
}

export function hasVisibleLessonExercises(lesson = {}) {
  return Boolean(lesson.exerciseVisible && hasLessonExerciseContent(lesson));
}

export function getLessonMarkdownSource(lesson = {}, tab = LESSON_MARKDOWN_TAB_LECTURE) {
  const normalizedTab = normalizeLessonMarkdownTab(tab);

  if (normalizedTab === LESSON_MARKDOWN_TAB_EXERCISE) {
    return toText(lesson.exerciseMarkdown);
  }

  const source = toText(lesson.lectureMarkdown) || toText(lesson.contentMarkdown);

  if (source) {
    return source;
  }

  return buildLegacyLessonMarkdown(lesson);
}

export function renderLessonMarkdownHtml(lesson = {}, tab = LESSON_MARKDOWN_TAB_LECTURE) {
  const source = getLessonMarkdownSource(lesson, tab);

  if (!source) {
    return '';
  }

  const unsafeHtml = marked.parse(source);
  return DOMPurify.sanitize(unsafeHtml, {
    USE_PROFILES: { html: true },
  });
}

export function renderLessonMarkdownEmptyState(message) {
  return `
    <div class="student-library-markdown-empty">
      ${escapeHtml(message)}
    </div>
  `;
}
