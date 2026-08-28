const LINE_HEIGHT_PX = 16;

function isScrollableOverflow(value) {
  return value === 'auto' || value === 'scroll' || value === 'overlay';
}

export function normalizeWheelDelta(event, lineHeight = LINE_HEIGHT_PX) {
  const mode = Number(event?.deltaMode ?? 0);
  let deltaX = Number(event?.deltaX ?? 0);
  let deltaY = Number(event?.deltaY ?? 0);
  if (!Number.isFinite(deltaX)) deltaX = 0;
  if (!Number.isFinite(deltaY)) deltaY = 0;
  if (mode === 1) {
    deltaX *= lineHeight;
    deltaY *= lineHeight;
  } else if (mode === 2) {
    const page = Number(event?.view?.innerHeight) || 800;
    deltaX *= page;
    deltaY *= page;
  }
  return { deltaX, deltaY };
}

export function canElementScroll(element, deltaX = 0, deltaY = 0, getStyle = getComputedStyle) {
  if (!element || element.nodeType !== 1) return false;
  const style = getStyle(element);
  const maxY = element.scrollHeight - element.clientHeight;
  const maxX = element.scrollWidth - element.clientWidth;
  if (deltaY && isScrollableOverflow(style.overflowY) && maxY > 1) {
    if (deltaY > 0 && element.scrollTop < maxY - 1) return true;
    if (deltaY < 0 && element.scrollTop > 1) return true;
  }
  if (deltaX && isScrollableOverflow(style.overflowX) && maxX > 1) {
    if (deltaX > 0 && element.scrollLeft < maxX - 1) return true;
    if (deltaX < 0 && element.scrollLeft > 1) return true;
  }
  return false;
}

export function findInnerScrollTarget(start, { deltaX = 0, deltaY = 0, root = null, getStyle = getComputedStyle } = {}) {
  let node = start?.nodeType === 1 ? start : start?.parentElement;
  while (node && node !== root) {
    if (canElementScroll(node, deltaX, deltaY, getStyle)) return node;
    node = node.parentElement;
  }
  return null;
}

export function getOuterScrollParent(node, getStyle = getComputedStyle) {
  let current = node?.parentElement;
  while (current) {
    const style = getStyle(current);
    if (
      (isScrollableOverflow(style.overflowY) && current.scrollHeight > current.clientHeight + 1) ||
      (isScrollableOverflow(style.overflowX) && current.scrollWidth > current.clientWidth + 1)
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

export function applyWheelScroll(scroller, deltaX, deltaY) {
  if (!scroller) return;
  if (typeof scroller.scrollBy === 'function') {
    scroller.scrollBy(deltaX, deltaY);
    return;
  }
  scroller.scrollTop = (scroller.scrollTop || 0) + deltaY;
  scroller.scrollLeft = (scroller.scrollLeft || 0) + deltaX;
}

/** Chromium already chains wheel from a non-scrolling iframe to the parent page. */
export function iframeNeedsWheelForward(userAgent = globalThis.navigator?.userAgent) {
  const ua = String(userAgent || '');
  if (/firefox|fxios|crios/i.test(ua)) return true;
  return /safari/i.test(ua) && !/chrome|chromium|android|edg/i.test(ua);
}

/** Wheel over iframe should move the outer page unless an inner pane can still scroll. */
export function shouldForwardIframeWheel(event, { frame, getStyle } = {}) {
  if (!event || event.ctrlKey || event.metaKey) return false;
  const { deltaX, deltaY } = normalizeWheelDelta(event);
  if (!deltaX && !deltaY) return false;
  const styleOf = getStyle || getComputedStyle;
  const inner = findInnerScrollTarget(event.target, {
    deltaX,
    deltaY,
    root: event.view?.document?.documentElement,
    getStyle: styleOf,
  });
  if (inner) return false;
  return Boolean(getOuterScrollParent(frame, styleOf) || event.view);
}

function snapshotStyle(element, names) {
  return names.map((name) => ({
    name,
    value: element.style.getPropertyValue(name),
    priority: element.style.getPropertyPriority(name),
  }));
}

function restoreStyle(element, snapshot) {
  for (const { name, value, priority } of snapshot) {
    if (value) element.style.setProperty(name, value, priority);
    else element.style.removeProperty(name);
  }
}

function unlockDocumentHeight(element) {
  element.style.setProperty('overflow', 'visible', 'important');
  element.style.setProperty('height', 'auto', 'important');
  element.style.setProperty('min-height', '0', 'important');
}

/** Measure authored height without collapsing the iframe (that clamps outer scrollTop). */
export function measureLessonDocumentHeight(frame) {
  const document = frame?.contentDocument;
  if (!document?.documentElement) return 0;
  const html = document.documentElement;
  const body = document.body;
  const names = ['overflow', 'height', 'min-height'];
  const htmlSnap = snapshotStyle(html, names);
  const bodySnap = body ? snapshotStyle(body, names) : [];
  unlockDocumentHeight(html);
  if (body) unlockDocumentHeight(body);
  const nextHeight = Math.ceil(
    Math.max(
      html.scrollHeight,
      body?.scrollHeight || 0,
      html.offsetHeight,
      body?.offsetHeight || 0,
    ),
  );
  restoreStyle(html, htmlSnap);
  if (body) restoreStyle(body, bodySnap);
  return nextHeight > 0 ? nextHeight + 8 : 0;
}
