import { marked } from 'marked';
import createDOMPurify from 'dompurify';

marked.setOptions({ breaks: true, gfm: true });

const UNSAFE_TAGS = new Set(['script', 'iframe', 'object', 'embed', 'base', 'form']);
const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction']);

function isUnsafeUrl(value = '') {
  const compact = String(value).replace(/[\u0000-\u001f\s]+/g, '').toLowerCase();
  return compact.startsWith('javascript:');
}

function scrubResidualUnsafeHtml(html) {
  if (typeof document === 'undefined') return html;

  const template = document.createElement('template');
  template.innerHTML = html;

  for (const el of [...template.content.querySelectorAll('*')]) {
    if (UNSAFE_TAGS.has(el.tagName.toLowerCase())) {
      el.remove();
      continue;
    }

    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || (URL_ATTRS.has(name) && isUnsafeUrl(attr.value))) {
        el.removeAttribute(attr.name);
      }
    }
  }

  return template.innerHTML;
}

function sanitizeHtml(html) {
  let sanitized;
  if (typeof window !== 'undefined') {
    sanitized = createDOMPurify(window).sanitize(html);
  } else {
    sanitized = createDOMPurify.sanitize(html);
  }
  return scrubResidualUnsafeHtml(sanitized);
}

export function renderSafeMarkdown(content = '') {
  if (!content) return '';
  const raw = marked.parse(content, { async: false });
  return sanitizeHtml(raw);
}
