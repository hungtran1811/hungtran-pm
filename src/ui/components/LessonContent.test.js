// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LessonContent } from './LessonContent.jsx';

let container;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

describe('LessonContent HTML rendering', () => {
  it('renders a complete document in a scriptless sandbox with an injected CSP', async () => {
    const source = `<!doctype html><html><head><title>Lesson</title>
      <style>.page { color: rebeccapurple }</style></head>
      <body><main class="page"><h1>Full document</h1><script>owned()</script></main></body></html>`;

    await act(async () => {
      root.render(
        createElement(LessonContent, {
          className: 'preview-frame',
          content: source,
          format: 'html',
        }),
      );
    });

    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(container.querySelector('.lesson-content')).not.toBeNull();
    expect(iframe.getAttribute('sandbox')).toBe('allow-same-origin');
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-scripts');
    expect(iframe.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(iframe.classList).toContain('lesson-document-frame', 'preview-frame');
    expect(iframe.getAttribute('srcdoc')).toContain("script-src 'none'");
    expect(iframe.getAttribute('srcdoc')).toContain('.page { color: rebeccapurple }');
    expect(iframe.getAttribute('srcdoc')).toContain('overflow:hidden');
    expect(iframe.getAttribute('srcdoc')).toContain('<h1>Full document</h1>');
    expect(iframe.getAttribute('srcdoc')).not.toContain('<script>');
    expect(iframe.getAttribute('scrolling')).toBe('no');
  });

  it('keeps imported CSS, custom classes, and inline styles instead of a shared theme', async () => {
    const source = `<!doctype html><html><head><title>Keep CSS</title>
      <style>.owned { color: rebeccapurple }</style></head><body>
      <section class="lesson-hero owned" style="color:red">
        <h1>Imported document</h1>
      </section></body></html>`;

    await act(async () => {
      root.render(
        createElement(LessonContent, {
          content: source,
          format: 'html',
        }),
      );
    });

    const srcdoc = container.querySelector('iframe')?.getAttribute('srcdoc') || '';
    expect(container.querySelector('.lesson-theme-v1')).toBeNull();
    expect(srcdoc).toContain('.owned { color: rebeccapurple }');
    expect(srcdoc).toContain('class="lesson-hero owned"');
    expect(srcdoc).toContain('style="color:red"');
    expect(srcdoc).toContain('<h1>Imported document</h1>');
  });

  it('renders fragments in the same isolated iframe without rewriting classes', async () => {
    await act(async () => {
      root.render(
        createElement(LessonContent, {
          content:
            '<div class="custom-card" style="color:navy"><h2>Fragment</h2><img src="/demo.png" alt="Demo"></div>',
          format: 'html',
        }),
      );
    });

    const iframe = container.querySelector('iframe');
    const srcdoc = iframe?.getAttribute('srcdoc') || '';
    expect(iframe).not.toBeNull();
    expect(srcdoc).toContain('class="custom-card"');
    expect(srcdoc).toContain('style="color:navy"');
    expect(srcdoc).toContain('<h2>Fragment</h2>');
    expect(container.querySelector('.lesson-theme-v1')).toBeNull();
  });

  it('opens full-document images in the shared lightbox without enabling scripts', async () => {
    await act(async () => {
      root.render(
        createElement(LessonContent, {
          content: '<!doctype html><html><body><img src="/full.png" alt="Full"></body></html>',
          format: 'html',
        }),
      );
    });

    const iframe = container.querySelector('iframe');
    iframe.contentDocument.body.innerHTML = '<img src="/full.png" alt="Full">';
    await act(async () => iframe.dispatchEvent(new Event('load')));

    const image = iframe.contentDocument.querySelector('img');
    expect(image.getAttribute('role')).toBe('button');
    await act(async () => image.click());

    expect(container.querySelector('[role="dialog"] img')?.getAttribute('alt')).toBe('Full');
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-scripts');
  });

  it('grows the iframe to the authored document height instead of clipping it', async () => {
    await act(async () => {
      root.render(
        createElement(LessonContent, {
          content: '<!doctype html><html><body><h1>Tall lesson</h1></body></html>',
          format: 'html',
        }),
      );
    });

    const iframe = container.querySelector('iframe');
    Object.defineProperty(iframe.contentDocument.documentElement, 'scrollHeight', {
      configurable: true,
      value: 1800,
    });
    Object.defineProperty(iframe.contentDocument.body, 'scrollHeight', {
      configurable: true,
      value: 1800,
    });
    await act(async () => iframe.dispatchEvent(new Event('load')));

    expect(iframe.style.height).toBe('1808px');
    expect(iframe.classList.contains('lesson-document-frame')).toBe(true);
  });

  it('reveals an answer panel without enabling scripts', async () => {
    await act(async () => {
      root.render(
        createElement(LessonContent, {
          content:
            '<!doctype html><html><body><button type="button">Xem đáp án</button><div hidden>42</div></body></html>',
          format: 'html',
        }),
      );
    });

    const iframe = container.querySelector('iframe');
    iframe.contentDocument.body.innerHTML =
      '<button type="button" data-lesson-reveal="ans">Xem đáp án</button><div id="ans" hidden>42</div>';
    await act(async () => iframe.dispatchEvent(new Event('load')));

    const button = iframe.contentDocument.querySelector('button');
    const answer = iframe.contentDocument.querySelector('#ans');
    expect(answer.hasAttribute('hidden')).toBe(true);
    await act(async () => button.click());

    expect(answer.hasAttribute('hidden')).toBe(false);
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-scripts');
  });
});
