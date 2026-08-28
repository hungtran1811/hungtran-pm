import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/firebase.js', () => ({ db: { __db: true } }));

vi.mock('firebase/firestore', () => ({
  collection: (...parts) => ({ path: parts.slice(1).join('/') }),
  deleteField: () => ({ __op: 'deleteField' }),
  doc: (...parts) => ({ path: parts.slice(1).join('/') }),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: () => ({ __op: 'serverTimestamp' }),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(),
}));

import {
  LESSON_DOCUMENT_MAX_BYTES,
  isSlimLesson,
  lessonDocumentSizeBytes,
  serializeLesson,
} from './curriculum.service.js';

const baseLesson = {
  id: 'lesson-1',
  sessionNumber: 1,
  title: 'HTML lesson',
  exerciseVisible: true,
  archived: false,
  bannerImage: null,
  coverImage: null,
  images: [],
};

describe('lesson content serialization', () => {
  it('writes sanitized HTML and preserves legacy Markdown for rollback', () => {
    const stored = serializeLesson({
      ...baseLesson,
      contentFormat: 'html',
      content: '<h2>Hello</h2><script>alert(1)</script>',
      exercise: '<p>Practice</p>',
      _raw: {
        lectureMarkdown: '# Legacy',
        contentMarkdown: '# Legacy',
        exerciseMarkdown: 'Legacy exercise',
        unknownField: 'keep-me',
      },
    });

    expect(stored).toMatchObject({
      contentFormat: 'html',
      presentationPreset: 'legacy-document',
      lectureHtml: '<h2>Hello</h2><script>alert(1)</script>',
      exerciseHtml: '<p>Practice</p>',
      lectureMarkdown: '# Legacy',
      exerciseMarkdown: 'Legacy exercise',
      unknownField: 'keep-me',
    });
  });

  it('preserves the oldest content/exercise Markdown aliases during HTML conversion', () => {
    const stored = serializeLesson({
      ...baseLesson,
      contentFormat: 'html',
      content: '<h2>HTML mới</h2>',
      exercise: '<p>Bài tập mới</p>',
      _raw: {
        content: '# Markdown legacy',
        exercise: 'Bài tập legacy',
      },
    });

    expect(stored).toMatchObject({
      contentFormat: 'html',
      lectureHtml: '<h2>HTML mới</h2>',
      exerciseHtml: '<p>Bài tập mới</p>',
      content: '# Markdown legacy',
      exercise: 'Bài tập legacy',
    });
  });

  it('writes Markdown while retaining HTML as rollback data', () => {
    const stored = serializeLesson({
      ...baseLesson,
      contentFormat: 'markdown',
      content: '# Lesson',
      exercise: '**Practice**',
      _raw: {
        lectureHtml: '<h1>Old HTML</h1>',
        exerciseHtml: '<p>Old exercise</p>',
      },
    });

    expect(stored).toMatchObject({
      contentFormat: 'markdown',
      presentationPreset: 'legacy-document',
      lectureMarkdown: '# Lesson',
      contentMarkdown: '# Lesson',
      exerciseMarkdown: '**Practice**',
      lectureHtml: '<h1>Old HTML</h1>',
      exerciseHtml: '<p>Old exercise</p>',
    });
  });

  it('preserves whitespace HTML while its retained Markdown is the active fallback', () => {
    const stored = serializeLesson({
      ...baseLesson,
      contentFormat: 'html',
      contentRenderFormat: 'markdown',
      exerciseRenderFormat: 'markdown',
      content: '# Nội dung dự phòng',
      exercise: 'Bài tập dự phòng',
      _raw: {
        contentFormat: 'html',
        lectureHtml: '\n  \n',
        exerciseHtml: '',
        lectureMarkdown: '# Nội dung dự phòng',
        exerciseMarkdown: 'Bài tập dự phòng',
      },
    });

    expect(stored.lectureHtml).toBe('\n  \n');
    expect(stored.exerciseHtml).toBe('');
    expect(stored.lectureMarkdown).toBe('# Nội dung dự phòng');
  });

  it('does not reinterpret a missing HTML part fallback as HTML during save-all', () => {
    const stored = serializeLesson({
      ...baseLesson,
      contentFormat: 'html',
      contentRenderFormat: 'html',
      exerciseRenderFormat: 'markdown',
      content: '<h2>Bài giảng HTML</h2>',
      exercise: 'Bài tập Markdown dự phòng',
      _raw: {
        contentFormat: 'html',
        lectureHtml: '<h2>Bài giảng HTML</h2>',
        exerciseMarkdown: 'Bài tập Markdown dự phòng',
      },
    });

    expect(stored.lectureHtml).toBe('<h2>Bài giảng HTML</h2>');
    expect(stored.exerciseHtml).toBe('');
    expect(stored.exerciseMarkdown).toBe('Bài tập Markdown dự phòng');
  });

  it('rejects non-empty HTML input that becomes blank after sanitization', () => {
    expect(() =>
      serializeLesson({
        ...baseLesson,
        contentFormat: 'html',
        content: '<script>document.body.textContent = "Generated"</script>',
        exercise: '',
        _raw: {},
      }),
    ).toThrow(/không có nội dung HTML tĩnh/);
  });

  it('rejects a serialized lesson above the 750 KiB safety limit', () => {
    expect(() =>
      serializeLesson({
        ...baseLesson,
        contentFormat: 'html',
        content: `<p>${'x'.repeat(LESSON_DOCUMENT_MAX_BYTES)}</p>`,
        exercise: '',
        _raw: {},
      }),
    ).toThrow(/750 KiB/);
  });

  it('measures UTF-8 bytes rather than JavaScript character count', () => {
    expect(lessonDocumentSizeBytes('ă')).toBeGreaterThan('ă'.length);
  });
});

describe('lesson presentation preset serialization', () => {
  it('preserves imported HTML unchanged and maps hungtran-v1 to the authored renderer', () => {
    const source = `<!doctype html><html><head><style>.custom{color:red}</style></head>
      <body><main class="custom"><h1>Lesson</h1></main></body></html>`;
    const stored = serializeLesson({
      ...baseLesson,
      contentFormat: 'html',
      presentationPreset: 'hungtran-v1',
      contentRenderFormat: 'html',
      exerciseRenderFormat: 'html',
      content: source,
      exercise: '',
      _raw: {
        contentFormat: 'html',
        presentationPreset: 'legacy-document',
        lectureHtml: source,
        exerciseHtml: '',
        lectureMarkdown: '# Rollback',
        customMetadata: 'keep-me',
      },
    });

    expect(stored.presentationPreset).toBe('legacy-document');
    expect(stored.lectureHtml).toBe(source);
    expect(stored.lectureMarkdown).toBe('# Rollback');
    expect(stored.customMetadata).toBe('keep-me');
  });

  it('stores imported HTML as authored, including custom classes and CSS', () => {
    const source =
      '<!doctype html><html><head><style>.x{color:red}</style></head><body><h1 class="lesson-hero x" style="color:red" onclick="bad()">Lesson</h1><script>bad()</script></body></html>';
    const stored = serializeLesson({
      ...baseLesson,
      contentFormat: 'html',
      presentationPreset: 'hungtran-v1',
      content: source,
      exercise: '',
      _raw: {},
    });

    expect(stored.presentationPreset).toBe('legacy-document');
    expect(stored.lectureHtml).toBe(source);
  });

  it('marks index rows as slim so saving the list cannot overwrite HTML', () => {
    expect(isSlimLesson({ _slim: true, id: 'lesson-1', title: 'Buổi 1' })).toBe(true);
    expect(isSlimLesson({ id: 'lesson-1', content: '<h1>Hi</h1>' })).toBe(false);
  });
});
