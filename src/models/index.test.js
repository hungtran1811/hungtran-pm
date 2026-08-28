import { describe, expect, it } from 'vitest';
import { normalizeLesson } from './index.js';

describe('normalizeLesson content formats', () => {
  it('keeps legacy Markdown lessons readable', () => {
    const lesson = normalizeLesson({
      id: 'legacy',
      lectureMarkdown: '# Bài cũ',
      exerciseMarkdown: '**Bài tập**',
      customMetadata: 'preserved',
    });

    expect(lesson).toMatchObject({
      id: 'legacy',
      contentFormat: 'markdown',
      presentationPreset: 'legacy-document',
      contentRenderFormat: 'markdown',
      exerciseRenderFormat: 'markdown',
      content: '# Bài cũ',
      exercise: '**Bài tập**',
    });
    expect(lesson._raw.customMetadata).toBe('preserved');
  });

  it('prefers explicit HTML while retaining the raw Markdown rollback fields', () => {
    const lesson = normalizeLesson({
      id: 'html',
      contentFormat: 'html',
      lectureHtml: '<h2>Bài mới</h2>',
      exerciseHtml: '<p>Thực hành</p>',
      lectureMarkdown: '# Bản dự phòng',
      exerciseMarkdown: 'Bài dự phòng',
    });

    expect(lesson).toMatchObject({
      contentFormat: 'html',
      presentationPreset: 'legacy-document',
      contentRenderFormat: 'html',
      exerciseRenderFormat: 'html',
      content: '<h2>Bài mới</h2>',
      exercise: '<p>Thực hành</p>',
    });
    expect(lesson._raw.lectureMarkdown).toBe('# Bản dự phòng');
  });

  it('does not let unmarked HTML fields override legacy Markdown', () => {
    const lesson = normalizeLesson({
      lectureHtml: '<p>Bản chuyển đổi chưa kích hoạt</p>',
      exerciseHtml: '',
      lectureMarkdown: '# Bản đang dùng',
    });

    expect(lesson.contentFormat).toBe('markdown');
    expect(lesson.content).toBe('# Bản đang dùng');
  });

  it('falls back to Markdown if a malformed HTML marker has no HTML source', () => {
    const lesson = normalizeLesson({
      contentFormat: 'html',
      lectureMarkdown: '# Vẫn đọc được',
    });

    expect(lesson.contentFormat).toBe('markdown');
    expect(lesson.content).toBe('# Vẫn đọc được');
  });

  it('falls back per part when only one of the two HTML fields exists', () => {
    const lesson = normalizeLesson({
      contentFormat: 'html',
      lectureHtml: '<h2>Bản ghi dở</h2>',
      lectureMarkdown: '# Bài giảng dự phòng',
      exerciseMarkdown: 'Bài tập dự phòng',
    });

    expect(lesson).toMatchObject({
      contentFormat: 'html',
      contentRenderFormat: 'html',
      exerciseRenderFormat: 'markdown',
      content: '<h2>Bản ghi dở</h2>',
      exercise: 'Bài tập dự phòng',
    });
  });

  it('recovers each whitespace-only HTML part from its retained Markdown', () => {
    const lesson = normalizeLesson({
      contentFormat: 'html',
      lectureHtml: '\n  \n',
      exerciseHtml: '\n',
      lectureMarkdown: '# Nội dung vẫn còn',
      exerciseMarkdown: 'Bài tập vẫn còn',
    });

    expect(lesson).toMatchObject({
      contentFormat: 'html',
      contentRenderFormat: 'markdown',
      exerciseRenderFormat: 'markdown',
      content: '# Nội dung vẫn còn',
      exercise: 'Bài tập vẫn còn',
    });
  });

  it('keeps an intentionally empty HTML part when no Markdown fallback exists', () => {
    const lesson = normalizeLesson({
      contentFormat: 'html',
      lectureHtml: '',
      exerciseHtml: '<p>Thực hành</p>',
    });

    expect(lesson).toMatchObject({
      contentFormat: 'html',
      contentRenderFormat: 'html',
      exerciseRenderFormat: 'html',
      content: '',
      exercise: '<p>Thực hành</p>',
    });
  });

  it('falls back to rollback Markdown when an HTML part is empty', () => {
    const lesson = normalizeLesson({
      contentFormat: 'html',
      lectureHtml: '',
      exerciseHtml: '',
      lectureMarkdown: '# Nội dung cũ',
      exerciseMarkdown: 'Bài tập cũ',
    });

    expect(lesson).toMatchObject({
      contentFormat: 'html',
      contentRenderFormat: 'markdown',
      exerciseRenderFormat: 'markdown',
      content: '# Nội dung cũ',
      exercise: 'Bài tập cũ',
    });
  });

  it('falls back to Markdown when managed sanitization removes all active HTML', () => {
    const lesson = normalizeLesson({
      contentFormat: 'html',
      presentationPreset: 'legacy-document',
      lectureHtml: '<script>document.body.textContent = "generated"</script>',
      exerciseHtml: '<iframe src="https://example.com"></iframe>',
      lectureMarkdown: '# Nội dung an toàn',
      exerciseMarkdown: 'Bài tập an toàn',
    });

    expect(lesson).toMatchObject({
      contentRenderFormat: 'markdown',
      exerciseRenderFormat: 'markdown',
      content: '# Nội dung an toàn',
      exercise: 'Bài tập an toàn',
    });
  });

  it('falls back to Markdown when a legacy full document has no static content', () => {
    const lesson = normalizeLesson({
      contentFormat: 'html',
      presentationPreset: 'legacy-document',
      lectureHtml:
        '<!doctype html><body><div id="root"></div><script>root.textContent="generated"</script></body>',
      lectureMarkdown: '# Legacy fallback',
    });

    expect(lesson.contentRenderFormat).toBe('markdown');
    expect(lesson.content).toBe('# Legacy fallback');
  });

  it('uses the authored-document renderer for both full files and fragments', () => {
    const historicDocument = normalizeLesson({
      contentFormat: 'html',
      lectureHtml: '<!doctype html><html><body><h1>Historic</h1></body></html>',
      exerciseHtml: '',
    });
    const fragment = normalizeLesson({
      contentFormat: 'html',
      lectureHtml: '<h1>Managed</h1>',
      exerciseHtml: '',
    });

    expect(historicDocument.presentationPreset).toBe('legacy-document');
    expect(fragment.presentationPreset).toBe('legacy-document');
  });

  it('maps historic hungtran-v1 and unknown presets to the authored-document renderer', () => {
    const managedDocument = normalizeLesson({
      contentFormat: 'html',
      presentationPreset: 'hungtran-v1',
      lectureHtml: '<!doctype html><body><h1>Managed</h1></body>',
    });
    const unknown = normalizeLesson({
      contentFormat: 'html',
      presentationPreset: 'future-preset',
      lectureHtml: '<h1>Unknown</h1>',
    });

    expect(managedDocument.presentationPreset).toBe('legacy-document');
    expect(unknown.presentationPreset).toBe('legacy-document');
    expect(unknown._raw.presentationPreset).toBe('future-preset');
  });
});
