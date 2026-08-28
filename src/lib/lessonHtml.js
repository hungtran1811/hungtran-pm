import createDOMPurify from 'dompurify';
import { rewriteLessonInteractiveMarkup } from './lessonDocumentInteract.js';

export const LESSON_HTML_MAX_BYTES = 750 * 1024;

export const LESSON_PRESENTATION_PRESET_MANAGED = 'hungtran-v1';
export const LESSON_PRESENTATION_PRESET_LEGACY = 'legacy-document';
export const LESSON_PRESENTATION_PRESETS = Object.freeze([
  LESSON_PRESENTATION_PRESET_MANAGED,
  LESSON_PRESENTATION_PRESET_LEGACY,
]);

export const LESSON_HTML_CLASSES = Object.freeze([
  'lesson-card',
  'lesson-callout',
  'lesson-callout-info',
  'lesson-callout-success',
  'lesson-callout-warning',
  'lesson-callout-danger',
  'lesson-grid',
  'lesson-grid-2',
  'lesson-grid-3',
  'lesson-steps',
  'lesson-step',
  'lesson-badge',
  'lesson-hero',
  'lesson-section',
  'lesson-lead',
]);

const ALLOWED_CLASS_SET = new Set(LESSON_HTML_CLASSES);

export const LESSON_HTML_ALLOWED_TAGS = Object.freeze([
  'a',
  'abbr',
  'article',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'dd',
  'del',
  'details',
  'dfn',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'ins',
  'kbd',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  'q',
  's',
  'samp',
  'section',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'time',
  'tr',
  'u',
  'ul',
  'var',
]);

const ALLOWED_TAG_SET = new Set(LESSON_HTML_ALLOWED_TAGS);
const BLOCKED_CONTENT_TAGS = new Set([
  'base',
  'embed',
  'form',
  'iframe',
  'math',
  'object',
  'script',
  'style',
  'svg',
  'template',
]);

const SVG_ALLOWED_TAGS = Object.freeze([
  'circle',
  'clippath',
  'defs',
  'desc',
  'ellipse',
  'g',
  'line',
  'lineargradient',
  'marker',
  'mask',
  'path',
  'pattern',
  'polygon',
  'polyline',
  'radialgradient',
  'rect',
  'stop',
  'svg',
  'symbol',
  'text',
  'title',
  'tspan',
  'use',
]);
const SVG_TAG_SET = new Set(SVG_ALLOWED_TAGS);
const SVG_ALLOWED_ATTRS = Object.freeze([
  'clip-path',
  'clip-rule',
  'color',
  'cx',
  'cy',
  'd',
  'display',
  'dominant-baseline',
  'dx',
  'dy',
  'fill',
  'fill-opacity',
  'fill-rule',
  'filter',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'fr',
  'fx',
  'fy',
  'gradienttransform',
  'gradientunits',
  'height',
  'href',
  'letter-spacing',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'offset',
  'opacity',
  'overflow',
  'paint-order',
  'points',
  'preserveaspectratio',
  'r',
  'rx',
  'ry',
  'spreadmethod',
  'stop-color',
  'stop-opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'text-anchor',
  'transform',
  'transform-origin',
  'vector-effect',
  'viewbox',
  'visibility',
  'width',
  'x',
  'x1',
  'x2',
  'xlink:href',
  'xmlns',
  'xmlns:xlink',
  'y',
  'y1',
  'y2',
]);
const SVG_ATTR_SET = new Set(SVG_ALLOWED_ATTRS);

const DOCUMENT_ALLOWED_TAGS = Object.freeze([
  ...new Set([
    ...LESSON_HTML_ALLOWED_TAGS,
    ...SVG_ALLOWED_TAGS,
    'address',
    'aside',
    'button',
    'col',
    'colgroup',
    'footer',
    'header',
    'input',
    'label',
    'main',
    'nav',
  ]),
]);
const DOCUMENT_ALLOWED_TAG_SET = new Set(DOCUMENT_ALLOWED_TAGS);
const DOCUMENT_BLOCKED_TAGS = new Set(
  [...BLOCKED_CONTENT_TAGS].filter((tag) => tag !== 'svg').concat([
    'animate',
    'animatemotion',
    'animatetransform',
    'foreignobject',
    'handler',
    'link',
    'meta',
    'noscript',
    'set',
  ]),
);
const DOCUMENT_CSP = [
  "default-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline' https:",
  'img-src https: http: data:',
  'font-src https: http: data:',
  'media-src https: http: data:',
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');
const DOCUMENT_VIEWPORT_CSS =
  'html,body{overflow:hidden;scrollbar-width:none}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none;width:0;height:0}';

function isDocumentViewportCss(value) {
  return asString(value).replace(/\s+/g, '') === DOCUMENT_VIEWPORT_CSS.replace(/\s+/g, '');
}

const GLOBAL_ATTRS = new Set(['aria-label', 'class', 'dir', 'lang', 'title']);
const TAG_ATTRS = Object.freeze({
  a: new Set(['href', 'target']),
  blockquote: new Set(['cite']),
  details: new Set(['open']),
  img: new Set(['alt', 'decoding', 'height', 'loading', 'src', 'width']),
  li: new Set(['value']),
  ol: new Set(['reversed', 'start', 'type']),
  q: new Set(['cite']),
  td: new Set(['colspan', 'headers', 'rowspan']),
  th: new Set(['abbr', 'colspan', 'headers', 'rowspan', 'scope']),
  time: new Set(['datetime']),
});

const DOCUMENT_GLOBAL_ATTRS = new Set([
  'aria-label',
  'class',
  'data-lesson-reveal',
  'data-lesson-reveal-next',
  'data-lesson-reveal-selector',
  'data-lesson-toggle-class',
  'dir',
  'hidden',
  'id',
  'lang',
  'role',
  'style',
  'title',
]);
const DOCUMENT_TAG_ATTRS = Object.freeze({
  ...TAG_ATTRS,
  button: new Set(['disabled', 'type']),
  col: new Set(['span']),
  colgroup: new Set(['span']),
  input: new Set(['checked', 'type']),
  label: new Set(['for']),
});
const DOCUMENT_ALLOWED_ATTRS = Object.freeze([
  ...new Set([
    ...DOCUMENT_GLOBAL_ATTRS,
    ...SVG_ALLOWED_ATTRS,
    ...Object.values(DOCUMENT_TAG_ATTRS).flatMap((attributes) => [...attributes]),
  ]),
]);

const ALL_ALLOWED_ATTRS = Object.freeze([
  ...new Set([
    ...GLOBAL_ATTRS,
    ...Object.values(TAG_ATTRS).flatMap((attributes) => [...attributes]),
  ]),
]);

const URL_ATTRS = new Set(['cite', 'href', 'src']);
const PURIFIER_CACHE = new WeakMap();

function asString(value) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function defaultWindow() {
  return typeof window !== 'undefined' && window?.document ? window : null;
}

function getPurifier(windowLike) {
  let purifier = PURIFIER_CACHE.get(windowLike);
  if (!purifier) {
    purifier =
      windowLike === defaultWindow() && typeof createDOMPurify.sanitize === 'function'
        ? createDOMPurify
        : createDOMPurify(windowLike);
    PURIFIER_CACHE.set(windowLike, purifier);
  }
  return purifier;
}

function decodeAttributeEntities(value) {
  return asString(value)
    .replace(/&#(\d+);?/gi, (_, code) => {
      const point = Number(code);
      return Number.isSafeInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : '';
    })
    .replace(/&#x([\da-f]+);?/gi, (_, code) => {
      const point = Number.parseInt(code, 16);
      return Number.isSafeInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : '';
    })
    .replace(/&(colon|tab|newline|amp|quot|apos|lt|gt);?/gi, (_, name) => {
      const entities = {
        amp: '&',
        apos: "'",
        colon: ':',
        gt: '>',
        lt: '<',
        newline: '\n',
        quot: '"',
        tab: '\t',
      };
      return entities[name.toLowerCase()] ?? '';
    });
}

function encodeAttribute(value) {
  return decodeAttributeEntities(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function normalizeClassName(value) {
  return [
    ...new Set(
      asString(value)
        .split(/\s+/)
        .filter((name) => ALLOWED_CLASS_SET.has(name)),
    ),
  ].join(' ');
}

function isAllowedAttribute(tagName, attributeName) {
  return GLOBAL_ATTRS.has(attributeName) || Boolean(TAG_ATTRS[tagName]?.has(attributeName));
}

function isSafeUrl(value, tagName, attributeName) {
  const decoded = decodeAttributeEntities(value).trim();
  if (!decoded) return false;

  const compact = decoded.replace(/[\u0000-\u0020\u007f-\u009f]+/g, '').toLowerCase();
  if (
    compact.startsWith('javascript:') ||
    compact.startsWith('vbscript:') ||
    compact.startsWith('file:') ||
    compact.startsWith('blob:')
  ) {
    return false;
  }

  if (compact.startsWith('data:')) {
    return tagName === 'img' && attributeName === 'src' && isSafeRasterDataUrl(decoded);
  }

  if (attributeName === 'src') {
    return (
      /^(https?:)?\/\//i.test(decoded) ||
      decoded.startsWith('/') ||
      decoded.startsWith('./') ||
      decoded.startsWith('../')
    );
  }

  if (attributeName === 'href' && tagName === 'a') {
    return (
      /^(https?:)?\/\//i.test(decoded) ||
      /^(mailto|tel):/i.test(decoded) ||
      decoded.startsWith('/') ||
      decoded.startsWith('./') ||
      decoded.startsWith('../') ||
      decoded.startsWith('?')
    );
  }

  return (
    /^(https?:)?\/\//i.test(decoded) ||
    decoded.startsWith('/') ||
    decoded.startsWith('./') ||
    decoded.startsWith('../')
  );
}

function normalizeAttributeValue(tagName, name, value) {
  const decoded = decodeAttributeEntities(value).trim();

  if (URL_ATTRS.has(name)) return isSafeUrl(decoded, tagName, name) ? decoded : null;
  if (name === 'class') return normalizeClassName(decoded) || null;
  if (name === 'target') return decoded === '_blank' || decoded === '_self' ? decoded : null;
  if (name === 'dir')
    return ['auto', 'ltr', 'rtl'].includes(decoded.toLowerCase()) ? decoded.toLowerCase() : null;
  if (name === 'lang') return /^[a-z]{1,8}(?:-[a-z0-9]{1,8})*$/i.test(decoded) ? decoded : null;
  if (name === 'loading')
    return ['eager', 'lazy'].includes(decoded.toLowerCase()) ? decoded.toLowerCase() : null;
  if (name === 'decoding') {
    return ['async', 'auto', 'sync'].includes(decoded.toLowerCase()) ? decoded.toLowerCase() : null;
  }
  if (name === 'scope') {
    return ['col', 'colgroup', 'row', 'rowgroup'].includes(decoded.toLowerCase())
      ? decoded.toLowerCase()
      : null;
  }
  if (name === 'type' && tagName === 'ol') return /^[1aAiI]$/.test(decoded) ? decoded : null;
  if (['colspan', 'height', 'rowspan', 'start', 'value', 'width'].includes(name)) {
    return /^-?\d{1,4}$/.test(decoded) ? decoded : null;
  }
  if (name === 'headers')
    return /^[a-z][-a-z0-9_:.]*(?:\s+[a-z][-a-z0-9_:.]*)*$/i.test(decoded) ? decoded : null;

  return decoded;
}

function isAllowedDocumentAttribute(tagName, attributeName) {
  return (
    DOCUMENT_GLOBAL_ATTRS.has(attributeName) ||
    /^aria-[a-z][a-z0-9-]*$/i.test(attributeName) ||
    Boolean(DOCUMENT_TAG_ATTRS[tagName]?.has(attributeName)) ||
    (SVG_TAG_SET.has(tagName) && SVG_ATTR_SET.has(attributeName))
  );
}

function isSafeSvgLength(value) {
  return /^-?\d+(?:\.\d+)?(?:px|em|rem|%|pt|pc|cm|mm|in|ex|ch|vw|vh)?$/i.test(asString(value).trim());
}

function isSafeSvgPaint(value, depth = 0) {
  const decoded = asString(value).trim();
  if (!decoded || decoded.length > 240 || depth > 3) return false;
  const compact = decoded.replace(/[\u0000-\u0020\u007f-\u009f]+/g, '').toLowerCase();
  if (
    compact.includes('javascript:') ||
    compact.includes('vbscript:') ||
    compact.includes('expression(')
  ) {
    return false;
  }
  if (/^url\(\s*(['"]?)#([a-z][\w:.-]*)\1\s*\)$/i.test(decoded)) return true;
  if (
    /^(none|currentcolor|transparent|inherit|initial|unset|context-fill|context-stroke)$/i.test(
      decoded,
    )
  ) {
    return true;
  }
  if (/^#[0-9a-f]{3,8}$/i.test(decoded)) return true;
  if (/^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(\s*[-+\d.%,/\s]+\)$/i.test(decoded)) {
    return true;
  }
  if (/^color-mix\(\s*in\s+[a-z]+\s*,[^)]+\)$/i.test(decoded) && !/url\(/i.test(decoded)) {
    return true;
  }
  const cssVar = decoded.match(/^var\(\s*(--[a-zA-Z][\w-]*)\s*(?:,\s*(.+))?\s*\)$/i);
  if (cssVar) return !cssVar[2] || isSafeSvgPaint(cssVar[2].trim(), depth + 1);
  return /^[a-z]{1,24}$/i.test(decoded);
}

function isSafeSvgTransform(value) {
  return /^(?:\s*(?:translate|scale|rotate|skewX|skewY|matrix)\s*\(\s*-?[\d.eE]+(?:\s*[, ]\s*-?[\d.eE]+)*\s*\)\s*)+$/.test(
    asString(value).trim(),
  );
}

function isSafeSvgLocalHref(value) {
  return /^#[a-z][\w:.-]*$/i.test(asString(value).trim());
}

function normalizeSvgAttributeValue(tagName, name, value) {
  const decoded = decodeAttributeEntities(value).trim();
  if (!decoded) return null;
  if (name === 'href' || name === 'xlink:href') {
    return tagName === 'use' && isSafeSvgLocalHref(decoded) ? decoded : null;
  }
  if (name === 'viewbox') {
    return /^-?\d+(?:\.\d+)?(?:\s+-?\d+(?:\.\d+)?){3}$/.test(decoded) ? decoded : null;
  }
  if (
    [
      'width',
      'height',
      'x',
      'y',
      'x1',
      'y1',
      'x2',
      'y2',
      'cx',
      'cy',
      'r',
      'rx',
      'ry',
      'dx',
      'dy',
      'fx',
      'fy',
      'fr',
      'offset',
      'stroke-width',
      'stroke-dashoffset',
      'stroke-miterlimit',
      'font-size',
      'letter-spacing',
    ].includes(name)
  ) {
    return isSafeSvgLength(decoded) ? decoded : null;
  }
  if (['fill', 'stroke', 'stop-color', 'clip-path', 'mask', 'color', 'filter'].includes(name)) {
    return isSafeSvgPaint(decoded) ? decoded : null;
  }
  if (name === 'transform') return isSafeSvgTransform(decoded) ? decoded : null;
  if (name === 'd') return decoded.length <= 20000 && !/[<>]|javascript:/i.test(decoded) ? decoded : null;
  if (name === 'points' || name === 'stroke-dasharray') {
    return /^[\d.,%\s-]+$/.test(decoded) ? decoded : null;
  }
  if (name === 'xmlns') return decoded === 'http://www.w3.org/2000/svg' ? decoded : null;
  if (name === 'xmlns:xlink') return decoded === 'http://www.w3.org/1999/xlink' ? decoded : null;
  if (name === 'opacity' || name === 'fill-opacity' || name === 'stroke-opacity' || name === 'stop-opacity') {
    return /^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(decoded) ? decoded : null;
  }
  return decoded.length <= 400 ? decoded : null;
}

function decodeCanonicalBase64(value) {
  const compact = asString(value).replace(/[\t\n\f\r ]+/g, '');
  if (!compact || compact.length % 4 !== 0 || !/^[a-z0-9+/]+={0,2}$/i.test(compact)) {
    return null;
  }

  try {
    let bytes;
    let canonical;
    if (typeof atob === 'function') {
      const binary = atob(compact);
      bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      canonical = btoa(binary);
    } else if (typeof Buffer !== 'undefined') {
      bytes = Uint8Array.from(Buffer.from(compact, 'base64'));
      canonical = Buffer.from(bytes).toString('base64');
    } else {
      return null;
    }

    return canonical === compact ? bytes : null;
  } catch {
    return null;
  }
}

function bytesStartWith(bytes, signature) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function asciiAt(bytes, start, length) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function hasRasterSignature(mimeSubtype, bytes) {
  if (mimeSubtype === 'png') {
    return bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (mimeSubtype === 'jpeg' || mimeSubtype === 'jpg') {
    return bytesStartWith(bytes, [0xff, 0xd8, 0xff]);
  }
  if (mimeSubtype === 'gif') {
    const header = asciiAt(bytes, 0, 6);
    return header === 'GIF87a' || header === 'GIF89a';
  }
  if (mimeSubtype === 'webp') {
    return asciiAt(bytes, 0, 4) === 'RIFF' && asciiAt(bytes, 8, 4) === 'WEBP';
  }
  if (mimeSubtype === 'avif') {
    if (asciiAt(bytes, 4, 4) !== 'ftyp') return false;
    for (let index = 8; index + 4 <= bytes.length; index += 4) {
      const brand = asciiAt(bytes, index, 4);
      if (brand === 'avif' || brand === 'avis') return true;
    }
  }
  return false;
}

export function isSafeRasterDataUrl(value) {
  const match = asString(value).match(
    /^data:image\/(avif|gif|jpeg|jpg|png|webp);base64,([a-z0-9+/=\s]+)$/i,
  );
  if (!match) return false;
  const bytes = decodeCanonicalBase64(match[2]);
  return Boolean(bytes && hasRasterSignature(match[1].toLowerCase(), bytes));
}

const SVG_DATA_URL_MAX = 150_000;

function decodeSvgDataPayload(params, payload) {
  const isBase64 = /(?:^|;)base64(?:;|$)/i.test(params);
  if (isBase64) {
    const compact = payload.replace(/[\t\n\f\r ]+/g, '');
    let bytes = decodeCanonicalBase64(compact);
    if (!bytes) {
      try {
        if (typeof atob !== 'function') return '';
        const binary = atob(compact);
        bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      } catch {
        return '';
      }
    }
    return new TextDecoder('utf-8').decode(bytes);
  }
  try {
    return payload.includes('%') ? decodeURIComponent(payload.replace(/\+/g, ' ')) : payload;
  } catch {
    return '';
  }
}

export function isSafeSvgDataUrl(value) {
  const raw = asString(value).trim();
  if (!raw || raw.length > SVG_DATA_URL_MAX) return false;
  const header = raw.match(/^data:image\/svg\+xml((?:;[\w.=-]+)*)\s*,([\s\S]*)$/i);
  if (!header) return false;
  const params = header[1] || '';
  if (/charset=/i.test(params) && !/charset=utf-8\b/i.test(params) && !/charset=utf8\b/i.test(params)) {
    return false;
  }
  const svg = decodeSvgDataPayload(params, header[2] || '');
  if (!svg || svg.length > SVG_DATA_URL_MAX) return false;
  const compact = svg.replace(/[\u0000-\u001f\u007f-\u009f]+/g, '').toLowerCase();
  if (
    compact.includes('<script') ||
    compact.includes('<foreignobject') ||
    compact.includes('javascript:') ||
    compact.includes('vbscript:') ||
    compact.includes('<iframe') ||
    compact.includes('<embed') ||
    compact.includes('<object') ||
    compact.includes('<handler') ||
    /\bon[a-z]+\s*=/.test(compact)
  ) {
    return false;
  }
  return /<svg[\s>/]/.test(compact);
}

function isSafeDocumentUrl(value, tagName, attributeName) {
  const decoded = decodeAttributeEntities(value).trim();
  if (!decoded) return false;

  const compact = decoded.replace(/[\u0000-\u0020\u007f-\u009f]+/g, '').toLowerCase();
  if (
    compact.startsWith('javascript:') ||
    compact.startsWith('vbscript:') ||
    compact.startsWith('file:') ||
    compact.startsWith('blob:')
  ) {
    return false;
  }
  if (compact.startsWith('data:')) {
    return (
      tagName === 'img' &&
      attributeName === 'src' &&
      (isSafeRasterDataUrl(decoded) || isSafeSvgDataUrl(decoded))
    );
  }

  if (attributeName === 'href' && tagName === 'a') {
    return (
      /^(https?:)?\/\//i.test(decoded) ||
      /^(mailto|tel):/i.test(decoded) ||
      decoded.startsWith('/') ||
      decoded.startsWith('./') ||
      decoded.startsWith('../') ||
      decoded.startsWith('#') ||
      decoded.startsWith('?')
    );
  }

  return (
    /^(https?:)?\/\//i.test(decoded) ||
    decoded.startsWith('/') ||
    decoded.startsWith('./') ||
    decoded.startsWith('../')
  );
}

function decodeCssEscapes(value) {
  return asString(value)
    .replace(/\\([\da-f]{1,6})[\t\n\f\r ]?/gi, (_, code) => {
      const point = Number.parseInt(code, 16);
      return Number.isSafeInteger(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : '';
    })
    .replace(/\\(?:\r\n|[\n\f\r])/g, '')
    .replace(/\\([\s\S])/g, '$1');
}

function isSafeHttpsResourceUrl(value) {
  const decoded = decodeAttributeEntities(value).trim();
  const compact = decoded.replace(/[\u0000-\u0020\u007f-\u009f]+/g, '').toLowerCase();
  if (
    compact.startsWith('javascript:') ||
    compact.startsWith('vbscript:') ||
    compact.startsWith('data:') ||
    compact.startsWith('file:') ||
    compact.startsWith('blob:')
  ) {
    return false;
  }
  try {
    return new URL(decoded).protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeDocumentCssUrl(match, _quote, rawUrl) {
  const decoded = decodeCssEscapes(rawUrl).trim();
  const compact = decoded.replace(/[\u0000-\u0020\u007f-\u009f]+/g, '').toLowerCase();
  if (
    compact.startsWith('javascript:') ||
    compact.startsWith('vbscript:') ||
    compact.startsWith('file:') ||
    compact.startsWith('blob:') ||
    compact.startsWith('data:text/html')
  ) {
    return 'url("")';
  }
  if (compact.startsWith('data:image/svg+xml')) {
    return isSafeSvgDataUrl(decoded) ? match : 'url("")';
  }
  if (compact.startsWith('data:image/')) {
    return isSafeRasterDataUrl(decoded) ? `url("${decoded}")` : 'url("")';
  }
  return match;
}

function sanitizeDocumentCss(value) {
  return asString(value)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(
      /@import\s+(?:url\(\s*(['"]?)([\s\S]*?)\1\s*\)|(['"])([\s\S]*?)\3)\s*;?/gi,
      (full, q1, url1, q2, url2) => {
        const imported = decodeCssEscapes(url1 || url2 || '').trim();
        return isSafeHttpsResourceUrl(imported) ? `@import url("${imported}");` : '';
      },
    )
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/(?:behavior|-moz-binding)\s*:[^;}]+;?/gi, '')
    .replace(/url\(\s*(['"]?)([\s\S]*?)\1\s*\)/gi, sanitizeDocumentCssUrl)
    .replace(/(?:javascript|vbscript)\s*:/gi, '');
}

function prepareDocumentSourceForParsing(source) {
  let html = rewriteLessonInteractiveMarkup(asString(source))
    .replace(/<(?:base|link|meta)\b[^>]*>/gi, '')
    .replace(/<style(\s[^>]*)?>([\s\S]*?)<\/style\s*>/gi, (_, attributes = '', css = '') => {
      return `<style${attributes}>${sanitizeDocumentCss(css)}</style>`;
    });

  for (const tagName of [
    'script',
    'noscript',
    'template',
    'form',
    'iframe',
    'object',
    'math',
    'foreignobject',
    'animate',
    'animatetransform',
    'animatemotion',
    'set',
    'handler',
  ]) {
    html = html.replace(new RegExp(`<${tagName}\\b[\\s\\S]*?<\\/${tagName}\\s*>`, 'gi'), '');
    html = html.replace(new RegExp(`<${tagName}\\b[^>]*/?>`, 'gi'), '');
  }
  return html.replace(/<embed\b[^>]*\/?\s*>/gi, '');
}

function normalizeDocumentAttributeValue(tagName, name, value) {
  const decoded = decodeAttributeEntities(value).trim();
  if (SVG_TAG_SET.has(tagName) && SVG_ATTR_SET.has(name)) {
    return normalizeSvgAttributeValue(tagName, name, value);
  }
  if (URL_ATTRS.has(name)) return isSafeDocumentUrl(decoded, tagName, name) ? decoded : null;
  if (name === 'style') return sanitizeDocumentCss(decoded).trim() || null;
  if (name === 'target') return decoded === '_blank' || decoded === '_self' ? decoded : null;
  if (name === 'dir')
    return ['auto', 'ltr', 'rtl'].includes(decoded.toLowerCase()) ? decoded.toLowerCase() : null;
  if (name === 'lang') return /^[a-z]{1,8}(?:-[a-z0-9]{1,8})*$/i.test(decoded) ? decoded : null;
  if (name === 'loading')
    return ['eager', 'lazy'].includes(decoded.toLowerCase()) ? decoded.toLowerCase() : null;
  if (name === 'decoding') {
    return ['async', 'auto', 'sync'].includes(decoded.toLowerCase()) ? decoded.toLowerCase() : null;
  }
  if (name === 'scope') {
    return ['col', 'colgroup', 'row', 'rowgroup'].includes(decoded.toLowerCase())
      ? decoded.toLowerCase()
      : null;
  }
  if (name === 'type' && tagName === 'ol') return /^[1aAiI]$/.test(decoded) ? decoded : null;
  if (name === 'type' && tagName === 'button') {
    return ['button', 'reset', 'submit'].includes(decoded.toLowerCase())
      ? decoded.toLowerCase()
      : null;
  }
  if (name === 'type' && tagName === 'input') {
    return ['checkbox', 'radio'].includes(decoded.toLowerCase()) ? decoded.toLowerCase() : null;
  }
  if (name === 'data-lesson-reveal') {
    const ids = decoded.split(/\s+/).filter(Boolean);
    return ids.length && ids.every((id) => /^[A-Za-z][\w:.-]*$/.test(id)) ? ids.join(' ') : null;
  }
  if (name === 'data-lesson-toggle-class') {
    return /^-?[_A-Za-z][\w-]*$/.test(decoded) ? decoded : null;
  }
  if (name === 'data-lesson-reveal-selector') {
    return /^[#.]?[A-Za-z][\w:-]*(?:\s*>\s*[#.]?[A-Za-z][\w:-]*){0,3}$/.test(decoded)
      ? decoded
      : null;
  }
  if (name === 'data-lesson-reveal-next') return '1';
  if (['colspan', 'height', 'rowspan', 'span', 'start', 'value', 'width'].includes(name)) {
    return /^-?\d{1,4}$/.test(decoded) ? decoded : null;
  }
  if (name === 'headers')
    return /^[a-z][-a-z0-9_:.]*(?:\s+[a-z][-a-z0-9_:.]*)*$/i.test(decoded) ? decoded : null;

  return decoded;
}

function isExternalLink(href, windowLike) {
  const value = asString(href).trim();
  if (!/^(https?:)?\/\//i.test(value)) return false;

  try {
    const baseHref = windowLike?.location?.href || 'https://lesson.local/';
    const target = new URL(value, baseHref);
    const base = new URL(baseHref);
    return target.origin !== base.origin;
  } catch {
    return true;
  }
}

function scrubDomHtml(html, windowLike) {
  const template = windowLike.document.createElement('template');
  template.innerHTML = html;

  for (const element of [...template.content.querySelectorAll('*')]) {
    const tagName = element.tagName.toLowerCase();
    if (!ALLOWED_TAG_SET.has(tagName)) {
      if (BLOCKED_CONTENT_TAGS.has(tagName)) element.remove();
      else element.replaceWith(...element.childNodes);
      continue;
    }

    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (!isAllowedAttribute(tagName, name)) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (name === 'open' || name === 'reversed') continue;
      const normalized = normalizeAttributeValue(tagName, name, attribute.value);
      if (normalized === null) element.removeAttribute(attribute.name);
      else element.setAttribute(name, normalized);
    }

    if (tagName === 'a') {
      const href = element.getAttribute('href');
      if (href && isExternalLink(href, windowLike))
        element.setAttribute('rel', 'noopener noreferrer');
      else {
        element.removeAttribute('rel');
        element.removeAttribute('target');
      }
    }
  }

  return template.innerHTML;
}

function scrubDocumentBodyHtml(html, windowLike) {
  const template = windowLike.document.createElement('template');
  template.innerHTML = html;

  for (const element of [...template.content.querySelectorAll('*')]) {
    const tagName = element.tagName.toLowerCase();
    if (!DOCUMENT_ALLOWED_TAG_SET.has(tagName)) {
      if (DOCUMENT_BLOCKED_TAGS.has(tagName)) element.remove();
      else element.replaceWith(...element.childNodes);
      continue;
    }

    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (
        name === 'srcdoc' ||
        name.startsWith('on') ||
        !isAllowedDocumentAttribute(tagName, name)
      ) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (['checked', 'disabled', 'hidden', 'open', 'reversed'].includes(name)) continue;
      const normalized = normalizeDocumentAttributeValue(tagName, name, attribute.value);
      if (normalized === null) element.removeAttribute(attribute.name);
      else element.setAttribute(name, normalized);
    }

    if (tagName === 'input') {
      const type = (element.getAttribute('type') || '').toLowerCase();
      if (type !== 'checkbox' && type !== 'radio') {
        element.remove();
        continue;
      }
    }

    if (tagName === 'a') {
      const href = element.getAttribute('href');
      if (href && isExternalLink(href, windowLike)) {
        element.setAttribute('target', '_blank');
        element.setAttribute('rel', 'noopener noreferrer');
      } else {
        element.removeAttribute('rel');
        if (element.getAttribute('target') === '_blank') element.removeAttribute('target');
      }
    }
  }

  return template.innerHTML;
}

function copyDocumentShellAttributes(source, target) {
  if (!source || !target) return;
  for (const name of ['class', 'id', 'title']) {
    const value = source.getAttribute(name)?.trim();
    if (value) target.setAttribute(name, value);
  }
  for (const name of ['dir', 'lang']) {
    const value = normalizeDocumentAttributeValue(
      target.tagName.toLowerCase(),
      name,
      source.getAttribute(name),
    );
    if (value) target.setAttribute(name, value);
  }
  const style = sanitizeDocumentCss(source.getAttribute('style') || '').trim();
  if (style) target.setAttribute('style', style);
}

function collectStylesheetHrefsFromSource(html) {
  const hrefs = [];
  for (const match of asString(html).matchAll(/<link\b[^>]*>/gi)) {
    const rel = match[0].match(/\brel\s*=\s*(["']?)([^"'\s>]+)\1/i)?.[2]?.toLowerCase() || '';
    if (!rel.split(/\s+/).includes('stylesheet')) continue;
    const href = decodeAttributeEntities(
      match[0].match(/\bhref\s*=\s*(["']?)([^"'\s>]+)\1/i)?.[2] || '',
    );
    if (isSafeHttpsResourceUrl(href) && !hrefs.includes(href)) hrefs.push(href);
  }
  return hrefs;
}

function createDocumentShell(
  windowLike,
  { bodyHtml = '', css = '', sourceDocument = null, stylesheets = [], title = '' },
) {
  const output = windowLike.document.implementation.createHTMLDocument('');
  output.head.replaceChildren();
  output.body.replaceChildren();

  const charset = output.createElement('meta');
  charset.setAttribute('charset', 'utf-8');
  output.head.append(charset);

  const csp = output.createElement('meta');
  csp.setAttribute('http-equiv', 'Content-Security-Policy');
  csp.setAttribute('content', DOCUMENT_CSP);
  output.head.append(csp);

  const viewport = output.createElement('meta');
  viewport.setAttribute('name', 'viewport');
  viewport.setAttribute('content', 'width=device-width, initial-scale=1');
  output.head.append(viewport);

  if (title.trim()) {
    const titleElement = output.createElement('title');
    titleElement.textContent = title.trim().slice(0, 300);
    output.head.append(titleElement);
  }

  for (const href of stylesheets) {
    const link = output.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', href);
    output.head.append(link);
  }

  if (css.trim()) {
    const style = output.createElement('style');
    style.textContent = css;
    output.head.append(style);
  }

  const viewportStyle = output.createElement('style');
  viewportStyle.textContent = DOCUMENT_VIEWPORT_CSS;
  output.head.append(viewportStyle);

  copyDocumentShellAttributes(sourceDocument?.documentElement, output.documentElement);
  copyDocumentShellAttributes(sourceDocument?.body, output.body);
  output.body.innerHTML = bodyHtml;

  return `<!doctype html>\n${output.documentElement.outerHTML}`;
}

function parseAttributes(source) {
  const attributes = [];
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(source))) {
    attributes.push({
      name: match[1].toLowerCase(),
      value: match[2] ?? match[3] ?? match[4] ?? '',
    });
  }
  return attributes;
}

function findTagEnd(source, start) {
  let quote = '';
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '>') return index;
  }
  return -1;
}

function sanitizeWithoutDom(source) {
  const html = asString(source);
  let output = '';
  let cursor = 0;
  const blockedStack = [];

  while (cursor < html.length) {
    const open = html.indexOf('<', cursor);
    if (open === -1) {
      if (!blockedStack.length) output += html.slice(cursor);
      break;
    }
    if (!blockedStack.length) output += html.slice(cursor, open);

    if (html.startsWith('<!--', open)) {
      const commentEnd = html.indexOf('-->', open + 4);
      cursor = commentEnd === -1 ? html.length : commentEnd + 3;
      continue;
    }

    const close = findTagEnd(html, open + 1);
    if (close === -1) {
      if (!blockedStack.length) output += '&lt;';
      cursor = open + 1;
      continue;
    }

    const rawTag = html.slice(open + 1, close);
    const tagMatch = rawTag.match(/^\s*(\/?)\s*([a-z][a-z0-9-]*)\b([\s\S]*?)\s*(\/?)\s*$/i);
    cursor = close + 1;
    if (!tagMatch) {
      if (!blockedStack.length) output += '&lt;' + html.slice(open + 1, close) + '&gt;';
      continue;
    }

    const [, closingMarker, rawName, rawAttributes, selfClosingMarker] = tagMatch;
    const tagName = rawName.toLowerCase();
    const isClosing = closingMarker === '/';
    const isSelfClosing = selfClosingMarker === '/';

    if (blockedStack.length) {
      if (!isClosing && BLOCKED_CONTENT_TAGS.has(tagName) && !isSelfClosing)
        blockedStack.push(tagName);
      else if (isClosing && tagName === blockedStack.at(-1)) blockedStack.pop();
      continue;
    }

    if (BLOCKED_CONTENT_TAGS.has(tagName)) {
      if (!isClosing && !isSelfClosing) blockedStack.push(tagName);
      continue;
    }
    if (!ALLOWED_TAG_SET.has(tagName)) continue;
    if (isClosing) {
      output += `</${tagName}>`;
      continue;
    }

    const normalizedAttributes = new Map();
    for (const { name, value } of parseAttributes(rawAttributes)) {
      if (!isAllowedAttribute(tagName, name) || normalizedAttributes.has(name)) continue;
      if (name === 'open' || name === 'reversed') {
        normalizedAttributes.set(name, '');
        continue;
      }
      const normalized = normalizeAttributeValue(tagName, name, value);
      if (normalized !== null) normalizedAttributes.set(name, normalized);
    }

    const href = normalizedAttributes.get('href');
    if (tagName === 'a' && href && isExternalLink(href, null)) {
      normalizedAttributes.set('rel', 'noopener noreferrer');
    } else if (tagName === 'a') {
      normalizedAttributes.delete('target');
    }

    const serializedAttributes = [...normalizedAttributes]
      .map(([name, value]) => (value === '' ? ` ${name}` : ` ${name}="${encodeAttribute(value)}"`))
      .join('');
    output += `<${tagName}${serializedAttributes}>`;
  }

  return output;
}

/** Distinguishes an imported HTML document from an editor-authored fragment. */
export function isFullHtmlDocument(source = '') {
  return /<(?:!doctype\s+html|html(?:\s|>)|head(?:\s|>)|body(?:\s|>))/i.test(asString(source));
}

/**
 * HTML lessons always use the isolated document renderer so imported files
 * keep their own CSS and classes. Historic `hungtran-v1` values are mapped
 * to the same path and are not rewritten in Firestore until the next save.
 */
export function resolveLessonPresentationPreset(_source = '', _preset) {
  return LESSON_PRESENTATION_PRESET_LEGACY;
}

function sanitizeDocumentWithoutDom(source) {
  const html = rewriteLessonInteractiveMarkup(asString(source).replace(/^\uFEFF/, ''));
  const body = sanitizeWithoutDom(extractHtmlBody(html, null));
  const rawTitle = html.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title\s*>/i)?.[1] || '';
  const title = rawTitle
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, 300);
  const css = [...html.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style\s*>/gi)]
    .map((match) => sanitizeDocumentCss(match[1]))
    .filter((value) => value.trim() && !isDocumentViewportCss(value))
    .join('\n');
  const titleMarkup = title
    ? `<title>${encodeAttribute(title).replaceAll('&quot;', '"')}</title>`
    : '';
  const linkMarkup = collectStylesheetHrefsFromSource(html)
    .map((href) => `<link rel="stylesheet" href="${encodeAttribute(href)}">`)
    .join('');
  const styleMarkup = css ? `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>` : '';

  return (
    '<!doctype html>\n<html><head><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${encodeAttribute(DOCUMENT_CSP)}">` +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `${titleMarkup}${linkMarkup}${styleMarkup}<style>${DOCUMENT_VIEWPORT_CSS}</style></head><body>${body}</body></html>`
  );
}

/**
 * Sanitizes a complete static HTML document for rendering inside a sandboxed
 * iframe. Document CSS is preserved because it cannot escape that boundary;
 * executable and embedding features are removed before the CSP is injected.
 */
export function sanitizeLessonDocument(source = '', windowLike = defaultWindow()) {
  const html = asString(source).replace(/^\uFEFF/, '');
  if (!html) return '';
  const stylesheets = collectStylesheetHrefsFromSource(html);
  if (!windowLike?.document?.createElement || !windowLike.DOMParser) {
    return sanitizeDocumentWithoutDom(html);
  }

  const sourceDocument = new windowLike.DOMParser().parseFromString(
    prepareDocumentSourceForParsing(html),
    'text/html',
  );
  const purifiedBody = getPurifier(windowLike).sanitize(
    `<lesson-document-root>${sourceDocument.body?.innerHTML || ''}</lesson-document-root>`,
    {
      ALLOW_ARIA_ATTR: true,
      ALLOW_DATA_ATTR: false,
      ALLOWED_ATTR: DOCUMENT_ALLOWED_ATTRS,
      ALLOWED_TAGS: DOCUMENT_ALLOWED_TAGS,
      FORBID_ATTR: ['srcdoc'],
      FORBID_TAGS: [...DOCUMENT_BLOCKED_TAGS],
    },
  );
  const bodyHtml = scrubDocumentBodyHtml(purifiedBody, windowLike);
  const css = [...(sourceDocument.head?.querySelectorAll('style') || [])]
    .map((style) => sanitizeDocumentCss(style.textContent || ''))
    .filter((value) => value.trim() && !isDocumentViewportCss(value))
    .join('\n');
  const title = sourceDocument.title || '';

  return createDocumentShell(windowLike, {
    bodyHtml,
    css,
    sourceDocument,
    stylesheets,
    title,
  });
}

function hasRenderableDomContent(root) {
  const text = (root?.textContent || '').replace(/\u00a0/g, ' ').trim();
  if (text) return true;
  if (root?.querySelector?.('img[src], hr, table, details, pre, code, svg')) return true;
  return [...(root?.querySelectorAll?.('[style]') || [])].some((element) =>
    Boolean(element.getAttribute('style')?.trim()),
  );
}

/**
 * Cheap load-time hint: does this HTML look like it has a static body?
 * Avoids DOMPurify/DOMParser on every lesson while listing a program.
 */
export function htmlLooksRenderable(source = '') {
  const html = asString(source);
  if (!html.trim()) return false;
  const withoutIgnored = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const text = withoutIgnored
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text) return true;
  if (/\sstyle\s*=/i.test(withoutIgnored)) return true;
  return /<(?:img|hr|table|details|pre|code|svg)\b/i.test(withoutIgnored);
}

/** Returns false for whitespace and documents whose body only depended on JavaScript. */
export function hasRenderableLessonHtml(source = '', windowLike = defaultWindow()) {
  const html = asString(source);
  if (!html.trim()) return false;

  if (!windowLike?.document?.createElement || !windowLike.DOMParser) {
    const normalized = sanitizeDocumentWithoutDom(html);
    const body = extractHtmlBody(normalized, null);
    return (
      body
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .trim().length > 0 || /<(?:img|hr|table|details|pre|code|svg)\b/i.test(body)
    );
  }

  const normalized = sanitizeLessonDocument(html, windowLike);
  const parsed = new windowLike.DOMParser().parseFromString(normalized, 'text/html');
  return hasRenderableDomContent(parsed.body);
}

/**
 * Sanitizes a lesson HTML fragment. In browsers this uses DOMPurify followed by
 * an attribute-level allowlist pass. The optional window argument lets Node
 * scripts provide a DOM implementation; a conservative synchronous parser is
 * used when no DOM is available.
 */
export function sanitizeLessonHtml(source = '', windowLike = defaultWindow()) {
  const html = asString(source);
  if (!html) return '';
  if (!windowLike?.document?.createElement) return sanitizeWithoutDom(html);

  // DOMPurify intentionally sanitizes a document body. Wrapping in an unknown
  // element makes every user node a descendant, which also avoids DOM shims
  // treating the first lesson element as the disposable document root.
  const purified = getPurifier(windowLike).sanitize(
    `<lesson-sanitizer-root>${html}</lesson-sanitizer-root>`,
    {
      ALLOW_ARIA_ATTR: false,
      ALLOW_DATA_ATTR: false,
      ALLOWED_ATTR: ALL_ALLOWED_ATTRS,
      ALLOWED_TAGS: LESSON_HTML_ALLOWED_TAGS,
      FORBID_ATTR: ['style'],
      FORBID_TAGS: [...BLOCKED_CONTENT_TAGS],
    },
  );

  return scrubDomHtml(purified, windowLike);
}

/** Returns only a complete HTML document's body, or the original fragment. */
export function extractHtmlBody(source = '', windowLike = defaultWindow()) {
  const html = asString(source).replace(/^\uFEFF/, '');
  if (!html) return '';
  if (!/<(?:!doctype|html|head|body)\b/i.test(html)) return html;

  const Parser = windowLike?.DOMParser;
  if (Parser) {
    const document = new Parser().parseFromString(html, 'text/html');
    if (document?.body) return document.body.innerHTML;
  }

  const body = html.match(/<body(?:\s[^>]*)?>([\s\S]*?)<\/body\s*>/i);
  if (body) return body[1];
  const unclosedBody = html.match(/<body(?:\s[^>]*)?>([\s\S]*)$/i);
  return unclosedBody ? unclosedBody[1] : html;
}

/**
 * Normalizes both full files and fragments for the shared HungTran layout.
 * Only body content survives; document CSS and shell attributes never enter
 * the host page.
 */
export function sanitizeManagedLessonHtml(source = '', windowLike = defaultWindow()) {
  return sanitizeLessonHtml(extractHtmlBody(source, windowLike), windowLike);
}

/** Returns false when managed sanitization removes all visible/static content. */
export function hasRenderableManagedLessonHtml(source = '', windowLike = defaultWindow()) {
  const normalized = sanitizeManagedLessonHtml(source, windowLike);
  if (!normalized.trim()) return false;

  if (!windowLike?.document?.createElement) {
    return (
      normalized
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .trim().length > 0 || /<(?:img|hr|table|details|pre|code)\b/i.test(normalized)
    );
  }

  const template = windowLike.document.createElement('template');
  template.innerHTML = normalized;
  return hasRenderableDomContent(template.content);
}

export function normalizeLessonHtml(source = '', windowLike = defaultWindow()) {
  return isFullHtmlDocument(source)
    ? sanitizeLessonDocument(source, windowLike)
    : sanitizeLessonHtml(source, windowLike);
}

export function getLessonHtmlByteSize(source = '') {
  const value = asString(source);
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).byteLength;
  return Buffer.byteLength(value, 'utf8');
}

export function isLessonHtmlWithinLimit(source = '') {
  return getLessonHtmlByteSize(source) <= LESSON_HTML_MAX_BYTES;
}
