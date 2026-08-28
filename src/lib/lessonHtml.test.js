// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  LESSON_HTML_CLASSES,
  LESSON_HTML_MAX_BYTES,
  LESSON_PRESENTATION_PRESET_LEGACY,
  extractHtmlBody,
  getLessonHtmlByteSize,
  hasRenderableManagedLessonHtml,
  htmlLooksRenderable,
  hasRenderableLessonHtml,
  isFullHtmlDocument,
  isLessonHtmlWithinLimit,
  normalizeLessonHtml,
  resolveLessonPresentationPreset,
  sanitizeManagedLessonHtml,
  sanitizeLessonDocument,
  sanitizeLessonHtml,
} from './lessonHtml.js';

function fragment(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

describe('sanitizeLessonHtml', () => {
  it('keeps supported semantic lesson markup and safe attributes', () => {
    const html = sanitizeLessonHtml(`
      <article lang="vi">
        <h2>Mục tiêu</h2>
        <details open><summary>Xem thêm</summary><p><strong>Nội dung</strong></p></details>
        <figure><img src="/images/demo.jpg" alt="Minh họa" width="640" loading="lazy"><figcaption>Ảnh mẫu</figcaption></figure>
        <table><caption>Kết quả</caption><thead><tr><th scope="col">Tên</th></tr></thead><tbody><tr><td colspan="2">An</td></tr></tbody></table>
      </article>
    `);
    const root = fragment(html);

    expect(root.querySelector('article')?.getAttribute('lang')).toBe('vi');
    expect(root.querySelector('details')?.hasAttribute('open')).toBe(true);
    expect(root.querySelector('strong')?.textContent).toBe('Nội dung');
    expect(root.querySelector('img')?.getAttribute('loading')).toBe('lazy');
    expect(root.querySelector('img')?.getAttribute('width')).toBe('640');
    expect(root.querySelector('th')?.getAttribute('scope')).toBe('col');
    expect(root.querySelector('td')?.getAttribute('colspan')).toBe('2');
  });

  it('keeps every curated class and removes all non-curated class tokens', () => {
    const classes = LESSON_HTML_CLASSES.join(' ');
    const html = sanitizeLessonHtml(`<div class="unknown ${classes} tailwind:bg-red-500"></div>`);
    const classList = [...fragment(html).querySelector('div').classList];

    expect(classList).toEqual(LESSON_HTML_CLASSES);
    expect(html).not.toContain('unknown');
    expect(html).not.toContain('tailwind');
  });

  it('removes active and embedded content, event handlers, inline styles, and unknown attributes', () => {
    const html = sanitizeLessonHtml(`
      <script>alert(1)</script>
      <style>body { display: none }</style>
      <iframe></iframe>
      <form action="/steal"><input name="secret"><p>Form text</p></form>
      <object data="x"></object><embed src="x">
      <svg><foreignObject><p>SVG text</p></foreignObject></svg>
      <p id="clobber" style="color:red" onclick="alert(2)" data-x="1">Safe</p>
    `);
    const root = fragment(html);

    expect(root.querySelector('script, style, iframe, form, input, object, embed, svg')).toBeNull();
    expect(root.querySelector('p')?.outerHTML).toBe('<p>Safe</p>');
    expect(html).not.toContain('display: none');
    expect(html).not.toContain('onclick');
  });

  it('rejects unsafe and obfuscated URLs while retaining supported URL forms', () => {
    const html = sanitizeLessonHtml(`
      <a href="javascript:alert(1)">one</a>
      <a href="java&#x09;script&#58;alert(2)">two</a>
      <a href="vbscript:msgbox(1)">three</a>
      <img src="data:image/svg+xml,x">
      <img src="blob:https://example.com/id">
      <a href="mailto:hello@example.com">mail</a>
      <a href="#part">anchor</a>
      <img src="data:image/png;base64,iVBORw0KGgo=" alt="embedded raster">
      <img src="data:image/png;base64,PHN2Zz48L3N2Zz4=" alt="mislabeled svg">
      <img src="data:image/png;base64,iVBORw0KGgo" alt="invalid base64">
      <img src="/images/example.png" alt="safe">
    `);
    const root = fragment(html);
    const anchors = [...root.querySelectorAll('a')];
    const images = [...root.querySelectorAll('img')];

    expect(anchors.slice(0, 3).every((anchor) => !anchor.hasAttribute('href'))).toBe(true);
    expect(anchors[3].getAttribute('href')).toBe('mailto:hello@example.com');
    expect(anchors[4].hasAttribute('href')).toBe(false);
    expect(images[0].hasAttribute('src')).toBe(false);
    expect(images[1].hasAttribute('src')).toBe(false);
    expect(images[2].getAttribute('src')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(images[3].hasAttribute('src')).toBe(false);
    expect(images[4].hasAttribute('src')).toBe(false);
    expect(images[5].getAttribute('src')).toBe('/images/example.png');
  });

  it('accepts canonical base64 only when bytes match an allowed raster signature', () => {
    const dataUrl = (subtype, bytes) =>
      `data:image/${subtype};base64,${Buffer.from(bytes).toString('base64')}`;
    const sources = [
      dataUrl('png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      dataUrl('jpeg', [0xff, 0xd8, 0xff]),
      dataUrl('gif', Buffer.from('GIF89a')),
      dataUrl('webp', Buffer.from('RIFF\0\0\0\0WEBP')),
      dataUrl('avif', Buffer.from('\0\0\0\u0018ftypavif\0\0\0\0avif')),
    ];
    const html = sanitizeLessonHtml(sources.map((src) => `<img src="${src}">`).join(''));

    expect(
      [...fragment(html).querySelectorAll('img')].map((image) => image.getAttribute('src')),
    ).toEqual(sources);
  });

  it('adds noopener and noreferrer to external HTTP links only', () => {
    const origin = window.location.origin;
    const html = sanitizeLessonHtml(`
      <a href="https://outside.example/path" target="_blank">outside</a>
      <a href="${origin}/lesson" rel="opener">same origin</a>
      <a href="/lesson">relative</a>
    `);
    const anchors = [...fragment(html).querySelectorAll('a')];

    expect(anchors[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(anchors[0].getAttribute('target')).toBe('_blank');
    expect(anchors[1].hasAttribute('rel')).toBe(false);
    expect(anchors[2].hasAttribute('rel')).toBe(false);
  });

  it('normalizes constrained attribute values', () => {
    const html = sanitizeLessonHtml(`
      <img src="/ok.png" width="100000" height="200" loading="fast" decoding="async">
      <a href="/ok" target="popup">link</a>
      <ol type="Z" start="2"><li value="3">Item</li></ol>
      <p dir="SIDEWAYS" lang="vi-VN">Text</p>
    `);
    const root = fragment(html);

    expect(root.querySelector('img')?.hasAttribute('width')).toBe(false);
    expect(root.querySelector('img')?.getAttribute('height')).toBe('200');
    expect(root.querySelector('img')?.hasAttribute('loading')).toBe(false);
    expect(root.querySelector('img')?.getAttribute('decoding')).toBe('async');
    expect(root.querySelector('a')?.hasAttribute('target')).toBe(false);
    expect(root.querySelector('ol')?.hasAttribute('type')).toBe(false);
    expect(root.querySelector('ol')?.getAttribute('start')).toBe('2');
    expect(root.querySelector('li')?.getAttribute('value')).toBe('3');
    expect(root.querySelector('p')?.hasAttribute('dir')).toBe(false);
    expect(root.querySelector('p')?.getAttribute('lang')).toBe('vi-VN');
  });

  it('is idempotent', () => {
    const once = sanitizeLessonHtml(
      '<div class="lesson-card unknown"><a href="https://outside.example">Open</a></div>',
    );

    expect(sanitizeLessonHtml(once)).toBe(once);
  });

  it('has a safe synchronous Node fallback when no DOM window is supplied', () => {
    const html = sanitizeLessonHtml(
      '<div class="lesson-card bad" style="x"><script>bad()</script><a href="https://example.com" onclick="bad()">Safe</a></div>',
      null,
    );

    expect(html).toBe(
      '<div class="lesson-card"><a href="https://example.com" rel="noopener noreferrer">Safe</a></div>',
    );
  });
});

describe('lesson HTML normalization helpers', () => {
  it('always uses the authored-document renderer', () => {
    expect(resolveLessonPresentationPreset('<p>Fragment</p>')).toBe(
      LESSON_PRESENTATION_PRESET_LEGACY,
    );
    expect(resolveLessonPresentationPreset('<!doctype html><body>Document</body>')).toBe(
      LESSON_PRESENTATION_PRESET_LEGACY,
    );
    expect(
      resolveLessonPresentationPreset('<!doctype html><body>Document</body>', 'hungtran-v1'),
    ).toBe(LESSON_PRESENTATION_PRESET_LEGACY);
    expect(resolveLessonPresentationPreset('<p>Fragment</p>', 'future-preset')).toBe(
      LESSON_PRESENTATION_PRESET_LEGACY,
    );
  });

  it('turns a full file into a managed body fragment without source CSS or custom classes', () => {
    const source = `<!doctype html><html><head><style>.custom { color: red }</style></head>
      <body class="page" style="margin:0"><main class="custom">
        <section class="lesson-section custom"><h1 class="lesson-hero custom">Visible</h1>
        <a href="#part">Jump</a><p id="part" style="color:red">Text</p></section>
      </main></body></html>`;
    const html = sanitizeManagedLessonHtml(source);
    const root = fragment(html);

    expect(root.textContent).toContain('Visible');
    expect(root.querySelector('style, main')).toBeNull();
    expect(root.querySelector('.lesson-section')).not.toBeNull();
    expect(root.querySelector('.custom, [style], [id]')).toBeNull();
    expect(root.querySelector('a')?.hasAttribute('href')).toBe(false);
    expect(hasRenderableManagedLessonHtml(source)).toBe(true);
    expect(
      hasRenderableManagedLessonHtml(
        '<!doctype html><body><div id="root"></div><script>root.textContent="x"</script></body>',
      ),
    ).toBe(false);
  });

  it('extracts only body content from a complete HTML document', () => {
    const source = `<!doctype html><html><head><title>Hidden</title><style>.x{}</style></head>
      <body class="ignored"><h1>Visible</h1><p>Lesson</p></body></html>`;
    const body = extractHtmlBody(source);

    expect(body).toContain('<h1>Visible</h1>');
    expect(body).toContain('<p>Lesson</p>');
    expect(body).not.toContain('Hidden');
    expect(body).not.toContain('<body');
  });

  it('keeps lesson content from a complete HTML file that uses common page containers', () => {
    const source = `<!doctype html>
      <html lang="vi">
        <head>
          <meta charset="utf-8">
          <title>Web Basic - Buổi 1</title>
          <style>.container { display: grid }</style>
        </head>
        <body>
          <header><h1>Web Basic</h1></header>
          <nav><a href="#lesson">Vào bài học</a></nav>
          <main class="container">
            <section id="lesson">
              <h2>HTML là gì?</h2>
              <p>Nội dung bài học phải được giữ lại.</p>
            </section>
          </main>
          <footer><p>Kết thúc buổi học</p></footer>
          <script>alert('blocked')</script>
        </body>
      </html>`;
    const html = normalizeLessonHtml(source);
    const parsed = new DOMParser().parseFromString(html, 'text/html');

    expect(isFullHtmlDocument(html)).toBe(true);
    expect(parsed.title).toBe('Web Basic - Buổi 1');
    expect(parsed.body.textContent).toContain('Web Basic');
    expect(parsed.body.textContent).toContain('Vào bài học');
    expect(parsed.body.textContent).toContain('Nội dung bài học phải được giữ lại.');
    expect(parsed.body.textContent).toContain('Kết thúc buổi học');
    expect(parsed.querySelector('header h1')?.textContent).toBe('Web Basic');
    expect(parsed.querySelector('main.container section#lesson h2')?.textContent).toBe(
      'HTML là gì?',
    );
    expect(parsed.querySelector('footer')).not.toBeNull();
    expect(parsed.head.querySelector('style')?.textContent).toContain('.container');
    expect(parsed.querySelector('script')).toBeNull();
  });

  it('sanitizes active document features while retaining isolated CSS and layout attributes', () => {
    const source = `<!doctype html><html lang="vi"><head>
      <title>Safe lesson</title>
      <link rel="stylesheet" href="javascript:alert(1)">
      <link rel="prefetch" href="https://evil.example/x.js">
      <meta http-equiv="refresh" content="0;url=https://evil.example/">
      <style>@import "https://evil.example/x.css"; .hero { color: red; } .bad { background: url(javascript:alert(1)); }</style>
      <script>document.body.textContent = 'owned'</script>
    </head><body id="lesson-page" class="custom-theme" style="margin: 0" onload="owned()">
      <main class="layout custom-grid" id="main" style="display:grid" onclick="owned()">
        <h1>Static lesson</h1>
        <a id="unsafe" href="javascript:alert(1)" target="_top">Unsafe</a>
        <a id="external" href="https://example.com/lesson" target="_top">External</a>
        <img id="svg-data" src="data:image/svg+xml,&lt;svg onload=alert(1)&gt;">
        <iframe srcdoc="<script>owned()</script>"></iframe>
        <form><p>private form</p></form><template><p>template</p></template>
        <object></object><embed><svg><text>svg</text></svg><math><mi>x</mi></math>
      </main>
    </body></html>`;
    const html = sanitizeLessonDocument(source);
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const csp = parsed.head.querySelector('meta[http-equiv="Content-Security-Policy"]');

    expect(csp?.getAttribute('content')).toContain("script-src 'none'");
    expect(csp?.getAttribute('content')).toContain("frame-src 'none'");
    expect(parsed.documentElement.getAttribute('lang')).toBe('vi');
    expect(parsed.body.id).toBe('lesson-page');
    expect(parsed.body.className).toBe('custom-theme');
    expect(parsed.body.getAttribute('style')).toBe('margin: 0');
    expect(parsed.body.hasAttribute('onload')).toBe(false);
    expect(parsed.querySelector('main.layout.custom-grid#main')?.getAttribute('style')).toBe(
      'display:grid',
    );
    expect(parsed.querySelector('main')?.hasAttribute('onclick')).toBe(false);
    expect(parsed.querySelector('#unsafe')?.hasAttribute('href')).toBe(false);
    expect(parsed.querySelector('#external')?.getAttribute('target')).toBe('_blank');
    expect(parsed.querySelector('#external')?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(parsed.querySelector('#svg-data')?.hasAttribute('src')).toBe(false);
    expect(
      parsed.querySelector(
        'script, template, form, iframe, object, embed, math, base, meta[http-equiv="refresh"]',
      ),
    ).toBeNull();
    expect(parsed.head.querySelector('link[href^="javascript"]')).toBeNull();
    expect(parsed.head.querySelector('link[rel="prefetch"]')).toBeNull();
    expect(parsed.head.querySelector('style')?.textContent).toContain('.hero { color: red; }');
    expect(parsed.head.querySelector('style')?.textContent).toContain(
      '@import url("https://evil.example/x.css")',
    );
    expect(parsed.head.querySelector('style')?.textContent).not.toMatch(/javascript:/i);
    expect(
      [...parsed.head.querySelectorAll('style')].some((style) =>
        style.textContent.includes('overflow:hidden'),
      ),
    ).toBe(true);
  });

  it('keeps HTTPS stylesheets from a complete HTML document', () => {
    const html = sanitizeLessonDocument(`<!doctype html><html><head>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
      <link rel="stylesheet" href="javascript:alert(1)">
      <link rel="prefetch" href="https://evil.example/x.js">
    </head><body><p>Lesson</p></body></html>`);

    expect(html).toContain(
      'href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"',
    );
    expect(html).not.toContain('javascript:alert(1)');
    expect(html).not.toContain('rel="prefetch"');
  });

  it('keeps safe SVG data URLs for icons and still blocks executable payloads', () => {
    const safeSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle fill='%23f59e0b' cx='4' cy='4' r='4'/%3E%3C/svg%3E";
    const html = sanitizeLessonDocument(`<!doctype html><html><head><style>
      .icon { background: url("${safeSvg}") }
      .escaped-svg { background: url(d\\61 ta:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9eC8+) }
      .mislabeled { background: url(data:image/png;base64,PHN2Zz4=) }
      .html { background: url(data:text/html;base64,PHNjcmlwdD4=) }
      .safe { background: url(data:image/png;base64,iVBORw0KGgo=) }
    </style></head><body>
      <img id="svg-icon" src="${safeSvg}" alt="icon">
      <img id="svg-xss" src="data:image/svg+xml,&lt;svg onload=alert(1)&gt;">
      <p>Lesson</p>
    </body></html>`);
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const css = parsed.querySelector('style')?.textContent;

    expect(css).toContain('data:image/svg+xml');
    expect(css).not.toMatch(/data\s*:\s*text\/html/i);
    expect(css).not.toContain('PHN2Zz4=');
    expect(css).toContain('data:image/png;base64,iVBORw0KGgo=');
    expect(parsed.querySelector('#svg-icon')?.getAttribute('src')).toContain('data:image/svg+xml');
    expect(parsed.querySelector('#svg-xss')?.hasAttribute('src')).toBe(false);
  });

  it('keeps static inline SVG icons and drops executable SVG features', () => {
    const html = sanitizeLessonDocument(`<!doctype html><html><body>
      <svg id="logo" viewBox="0 0 24 24" width="24" height="24" aria-label="Logo">
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#2563eb"></stop>
          </linearGradient>
        </defs>
        <path fill="url(#g1)" d="M2 12 L12 2 L22 12 Z"></path>
        <use href="#g1"></use>
        <foreignObject width="100" height="100"><iframe src="https://evil.example"></iframe></foreignObject>
        <script>owned()</script>
      </svg>
      <svg onload="owned()"><text>ok</text></svg>
      <svg><use href="https://evil.example/icon.svg#x"></use></svg>
    </body></html>`);
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const logo = parsed.querySelector('#logo');

    expect(logo).not.toBeNull();
    expect(logo?.getAttribute('viewBox') || logo?.getAttribute('viewbox')).toBe('0 0 24 24');
    expect(logo?.querySelector('path')?.getAttribute('d')).toContain('M2 12');
    expect(logo?.querySelector('path')?.getAttribute('fill')).toBe('url(#g1)');
    expect(parsed.querySelector('foreignObject, script, iframe')).toBeNull();
    expect(parsed.querySelector('svg[onload]')).toBeNull();
    expect(parsed.querySelector('use[href="https://evil.example/icon.svg#x"]')).toBeNull();
    expect(
      hasRenderableLessonHtml(
        '<!doctype html><body><svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"></circle></svg></body>',
      ),
    ).toBe(true);
  });

  it('keeps CSS variables and modern paints on inline SVG icons', () => {
    const html = sanitizeLessonDocument(`<!doctype html><html><body>
      <svg viewBox="0 0 24 24" style="--icon:#2563eb">
        <path fill="var(--icon, #f59e0b)" stroke="oklch(0.7 0.15 40)" d="M2 12 L12 2 Z"></path>
      </svg>
    </body></html>`);
    const path = new DOMParser().parseFromString(html, 'text/html').querySelector('path');

    expect(path?.getAttribute('fill')).toBe('var(--icon, #f59e0b)');
    expect(path?.getAttribute('stroke')).toBe('oklch(0.7 0.15 40)');
  });

  it('rewrites answer-toggle JavaScript into static reveal attributes', () => {
    const html = sanitizeLessonDocument(`<!doctype html><html><body>
      <button type="button" onclick="document.getElementById('ans').style.display='block'">Xem đáp án</button>
      <div id="ans" hidden>42</div>
      <button type="button" data-bs-toggle="collapse" data-bs-target="#hint">Gợi ý</button>
      <p id="hint" hidden>Hint</p>
    </body></html>`);
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const [answerButton, hintButton] = parsed.querySelectorAll('button');

    expect(html).not.toContain('onclick');
    expect(answerButton?.getAttribute('data-lesson-reveal')).toBe('ans');
    expect(parsed.querySelector('#ans')?.hasAttribute('hidden')).toBe(true);
    expect(hintButton?.getAttribute('data-lesson-reveal')).toBe('hint');
    expect(parsed.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('keeps checkbox-based answer toggles for CSS-only spoilers', () => {
    const html = sanitizeLessonDocument(`<!doctype html><html><body>
      <label>
        <input type="checkbox"> Xem đáp án
      </label>
      <div class="answer">42</div>
    </body></html>`);
    const parsed = new DOMParser().parseFromString(html, 'text/html');

    expect(parsed.querySelector('input')?.getAttribute('type')).toBe('checkbox');
    expect(parsed.querySelector('.answer')?.textContent).toBe('42');
  });

  it('detects JavaScript-only documents as blank after sanitization', () => {
    const jsOnly = `<!doctype html><html><head><style>#root { min-height: 20rem }</style></head>
      <body><div id="root"></div><script>document.querySelector('#root').textContent = 'Generated'</script></body></html>`;

    expect(isFullHtmlDocument(jsOnly)).toBe(true);
    expect(hasRenderableLessonHtml(jsOnly)).toBe(false);
    expect(
      hasRenderableLessonHtml('<!doctype html><body><main><h1>Nội dung tĩnh</h1></main></body>'),
    ).toBe(true);
    expect(hasRenderableLessonHtml('<p class="custom-hero" style="color:red">Hi</p>')).toBe(true);
    expect(
      hasRenderableLessonHtml('<div class="hero" style="min-height:3rem;background:red"></div>'),
    ).toBe(true);
    expect(hasRenderableLessonHtml('  \n  ')).toBe(false);
    expect(htmlLooksRenderable(jsOnly)).toBe(false);
    expect(htmlLooksRenderable('<!doctype html><body><main><h1>Nội dung tĩnh</h1></main></body>')).toBe(
      true,
    );
    expect(htmlLooksRenderable('<div class="hero" style="min-height:3rem;background:red"></div>')).toBe(
      true,
    );
  });

  it('normalizes a full document idempotently', () => {
    const source = `<!doctype html><html lang="vi"><head><title>Lesson</title>
      <style>.page { color: navy }</style></head>
      <body class="page"><main><h1>Nội dung</h1></main></body></html>`;
    const once = normalizeLessonHtml(source);

    expect(normalizeLessonHtml(once)).toBe(once);
  });

  it('unwraps unsupported layout containers without deleting their safe descendants', () => {
    const html = sanitizeLessonHtml(`
      <main>
        <header><h2>Tiêu đề</h2></header>
        <nav><a href="#content">Mục lục</a></nav>
        <section><p id="content">Nội dung an toàn</p></section>
      </main>
    `);
    const root = fragment(html);

    expect(root.querySelector('main, header, nav')).toBeNull();
    expect(root.querySelector('h2')?.textContent).toBe('Tiêu đề');
    expect(root.querySelector('a')?.textContent).toBe('Mục lục');
    expect(root.querySelector('section p')?.textContent).toBe('Nội dung an toàn');
  });

  it('leaves an HTML fragment intact during extraction and sanitizes via normalizeLessonHtml', () => {
    const fragmentSource = '<div class="lesson-card bad"><p onclick="x()">Nội dung</p></div>';

    expect(extractHtmlBody(fragmentSource)).toBe(fragmentSource);
    expect(normalizeLessonHtml(fragmentSource)).toBe(
      '<div class="lesson-card"><p>Nội dung</p></div>',
    );
  });

  it('measures the serialized UTF-8 size against the 750 KiB limit', () => {
    expect(getLessonHtmlByteSize('Tiếng Việt')).toBe(new TextEncoder().encode('Tiếng Việt').length);
    expect(isLessonHtmlWithinLimit('a'.repeat(LESSON_HTML_MAX_BYTES))).toBe(true);
    expect(isLessonHtmlWithinLimit('a'.repeat(LESSON_HTML_MAX_BYTES + 1))).toBe(false);
  });
});
