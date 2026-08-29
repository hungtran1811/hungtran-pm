const BLOCKED_CLIPBOARD_KEYS = new Set(['c', 'x', 'a', 's', 'p']);

const IFRAME_PROTECT_STYLE_ATTR = 'data-lesson-copy-protect';

const IFRAME_PROTECT_CSS = `
[${IFRAME_PROTECT_STYLE_ATTR}],
[${IFRAME_PROTECT_STYLE_ATTR}] * {
  -webkit-user-select: none !important;
  user-select: none !important;
  -webkit-touch-callout: none !important;
}
`.trim();

function prevent(event) {
  event.preventDefault();
}

function isBlockedShortcut(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;
  const key = String(event.key || '').toLowerCase();
  return BLOCKED_CLIPBOARD_KEYS.has(key);
}

/**
 * Blocks copy/cut/select/context-menu shortcuts on a document or element root.
 * @param {Document | Element} root
 * @returns {() => void} detach
 */
export function attachLessonCopyGuard(root) {
  if (!root?.addEventListener) return () => {};

  const onKeyDown = (event) => {
    if (!isBlockedShortcut(event)) return;
    prevent(event);
  };

  const options = { capture: true };
  root.addEventListener('copy', prevent, options);
  root.addEventListener('cut', prevent, options);
  root.addEventListener('contextmenu', prevent, options);
  root.addEventListener('selectstart', prevent, options);
  root.addEventListener('dragstart', prevent, options);
  root.addEventListener('keydown', onKeyDown, options);

  return () => {
    root.removeEventListener('copy', prevent, options);
    root.removeEventListener('cut', prevent, options);
    root.removeEventListener('contextmenu', prevent, options);
    root.removeEventListener('selectstart', prevent, options);
    root.removeEventListener('dragstart', prevent, options);
    root.removeEventListener('keydown', onKeyDown, options);
  };
}

/**
 * Injects user-select:none CSS into an iframe document and attaches the guard.
 * @param {Document} contentDocument
 * @returns {() => void} detach
 */
export function protectLessonIframeDocument(contentDocument) {
  if (!contentDocument?.documentElement) return () => {};

  const head = contentDocument.head || contentDocument.documentElement;
  let style = contentDocument.querySelector(`style[${IFRAME_PROTECT_STYLE_ATTR}]`);
  if (!style) {
    style = contentDocument.createElement('style');
    style.setAttribute(IFRAME_PROTECT_STYLE_ATTR, '');
    style.textContent = IFRAME_PROTECT_CSS;
    head.appendChild(style);
  }

  contentDocument.documentElement.setAttribute(IFRAME_PROTECT_STYLE_ATTR, '');
  const detachGuard = attachLessonCopyGuard(contentDocument);

  return () => {
    detachGuard();
    contentDocument.documentElement.removeAttribute(IFRAME_PROTECT_STYLE_ATTR);
    style?.remove();
  };
}
