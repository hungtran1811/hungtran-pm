import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HOME_PURPOSE_EN,
  HOME_PURPOSE_VI,
  OAUTH_APP_NAME,
  PRIVACY_SECTIONS_EN,
  PRIVACY_SECTIONS_VI,
  PRIVACY_UPDATED_LABEL,
  SUPPORT_EMAIL,
} from '../src/data/publicLegal.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function sectionHtml(section) {
  const paragraphs = section.paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join('\n');
  return `<section>\n<h3>${escapeHtml(section.title)}</h3>\n${paragraphs}\n</section>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const aboutEn = HOME_PURPOSE_EN.map((text) => `<p>${escapeHtml(text)}</p>`).join('\n');
const aboutVi = HOME_PURPOSE_VI.map((text) => `<p>${escapeHtml(text)}</p>`).join('\n');
const en = PRIVACY_SECTIONS_EN.map(sectionHtml).join('\n');
const vi = PRIVACY_SECTIONS_VI.map(sectionHtml).join('\n');

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Privacy Policy — ${escapeHtml(OAUTH_APP_NAME)}</title>
    <meta
      name="description"
      content="Privacy Policy for ${escapeHtml(OAUTH_APP_NAME)}. How the classroom app uses the teacher's Google Drive and student class data."
    />
    <link rel="icon" type="image/svg+xml" href="/logo-icon.svg" />
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        font-family: "Exo 2", ui-sans-serif, system-ui, sans-serif;
        line-height: 1.6;
        background: #f8fafc;
        color: #1e293b;
      }
      main { max-width: 44rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
      a { color: #1b50f2; }
      h1 { font-size: 1.6rem; margin: 0 0 0.35rem; }
      h2 { font-size: 1.2rem; margin: 2rem 0 0.75rem; }
      h3 { font-size: 1.05rem; margin: 1.4rem 0 0.4rem; }
      p { margin: 0 0 0.75rem; }
      .meta { color: #64748b; font-size: 0.9rem; }
      img { height: 48px; width: auto; }
    </style>
  </head>
  <body>
    <main>
      <p><a href="/"><img src="/logo-wordmark.svg" alt="${escapeHtml(OAUTH_APP_NAME)}" /></a></p>
      <h1>Privacy Policy — ${escapeHtml(OAUTH_APP_NAME)}</h1>
      <p class="meta">Updated ${escapeHtml(PRIVACY_UPDATED_LABEL)}</p>
      <p>Contact: <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}">${escapeHtml(SUPPORT_EMAIL)}</a></p>
      <h2>About ${escapeHtml(OAUTH_APP_NAME)}</h2>
      ${aboutEn}
      ${aboutVi}
      <h2>English</h2>
      ${en}
      <h2>Tiếng Việt — Chính sách quyền riêng tư</h2>
      ${vi}
      <p><a href="/">Back to ${escapeHtml(OAUTH_APP_NAME)}</a></p>
    </main>
  </body>
</html>
`;

writeFileSync(join(root, 'public/privacy.html'), html);
console.log('Wrote public/privacy.html');
