const REVEAL_TEXT =
  /đáp\s*án|xem\s*đáp|hiện\s*đáp|ẩn\s*đáp|show\s*answer|hide\s*answer|giải\s*thích|xem\s*gợi\s*ý|spoiler/i;
const ANSWER_CLASS = /(?:^|\s)(?:answer|answers|dap-an|spoiler|solution|hint|giai-thich)(?:\s|$)/i;
const TOGGLE_CLASSES = ['show', 'open', 'revealed', 'is-open', 'active', 'visible'];

function asString(value) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function decodeHtmlEntities(value) {
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

export function isSafeDomId(id) {
  return /^[A-Za-z][\w:.-]*$/.test(asString(id));
}

export function isSafeClassName(name) {
  return /^-?[_A-Za-z][\w-]*$/.test(asString(name));
}

export function isSafeRevealSelector(value) {
  return /^[#.]?[A-Za-z][\w:-]*(?:\s*>\s*[#.]?[A-Za-z][\w:-]*){0,3}$/.test(asString(value).trim());
}

export function rewriteOnclickToDataAttrs(code) {
  const decoded = decodeHtmlEntities(code);
  const attrs = [];

  const idMatch =
    decoded.match(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/) ||
    decoded.match(/querySelector\(\s*['"]#([^'"]+)['"]\s*\)/);
  if (idMatch?.[1] && isSafeDomId(idMatch[1])) {
    attrs.push(`data-lesson-reveal="${idMatch[1]}"`);
  }

  const classSelector = decoded.match(/querySelector\(\s*['"]\.([^'"]+)['"]\s*\)/);
  if (!idMatch && classSelector?.[1] && isSafeClassName(classSelector[1])) {
    attrs.push(`data-lesson-reveal-selector=".${classSelector[1]}"`);
  }

  const toggle = decoded.match(/classList\.toggle\(\s*['"]([^'"]+)['"]\s*\)/);
  if (toggle?.[1] && isSafeClassName(toggle[1])) {
    attrs.push(`data-lesson-toggle-class="${toggle[1]}"`);
  }

  if (/nextElementSibling|nextSibling/.test(decoded)) {
    attrs.push('data-lesson-reveal-next="1"');
  }

  return attrs.length ? ` ${attrs.join(' ')}` : '';
}

function rewriteOnEventAttributes(html) {
  return html.replace(/\son([a-z]+)\s*=\s*(["'])([\s\S]*?)\2/gi, (full, eventName, _quote, code) => {
    if (eventName.toLowerCase() !== 'click') return '';
    return rewriteOnclickToDataAttrs(code);
  });
}

function rewriteJavascriptHref(html) {
  return html.replace(/\shref\s*=\s*(["'])\s*javascript:([^"']*)\1/gi, (full, _quote, code) => {
    const rewritten = rewriteOnclickToDataAttrs(code);
    return rewritten ? ` href="#"${rewritten}` : '';
  });
}

function rewriteFrameworkTargets(html) {
  return html.replace(/<([a-z][a-z0-9:-]*)(\s[^>]*?)>/gi, (full, tag, attrs) => {
    if (/\sdata-lesson-reveal\s*=/i.test(attrs)) return full;
    const target = attrs.match(/\sdata-(?:bs-)?target\s*=\s*(["'])#?([A-Za-z][\w:.-]*)\1/i);
    if (!target?.[2] || !isSafeDomId(target[2])) return full;
    return `<${tag}${attrs} data-lesson-reveal="${target[2]}">`;
  });
}

/** Turns common answer-toggle JS into static data attributes before sanitizing. */
export function rewriteLessonInteractiveMarkup(html) {
  return rewriteFrameworkTargets(rewriteJavascriptHref(rewriteOnEventAttributes(asString(html))));
}

export function isRevealTextTrigger(element) {
  const text = asString(element?.textContent)
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 0 && text.length <= 80 && REVEAL_TEXT.test(text);
}

function looksLikeAnswer(element) {
  if (!element) return false;
  if (element.hasAttribute('hidden')) return true;
  if (ANSWER_CLASS.test(element.className || '')) return true;
  return /display\s*:\s*none/i.test(element.getAttribute('style') || '');
}

export function findRevealTrigger(target, document) {
  if (!target?.closest) return null;
  if (target.closest('summary, input, label, a[href^="http"], a[href^="//"], a[href^="mailto"], a[href^="tel"]')) {
    return null;
  }

  const marked = target.closest(
    'button, [data-lesson-reveal], [data-lesson-reveal-next], [data-lesson-toggle-class], [data-lesson-reveal-selector], [aria-controls]',
  );
  if (marked) return marked;

  const anchor = target.closest('a[href^="#"]');
  if (anchor) {
    const id = (anchor.getAttribute('href') || '').slice(1);
    const panel = id && isSafeDomId(id) ? document.getElementById(id) : null;
    if (panel && (isRevealTextTrigger(anchor) || looksLikeAnswer(panel))) return anchor;
  }

  const clickable = target.closest('button, a, [role="button"]');
  if (clickable && isRevealTextTrigger(clickable)) return clickable;
  return null;
}

function guessAnswerTarget(trigger) {
  const next = trigger.nextElementSibling;
  if (next && looksLikeAnswer(next)) return next;
  const root = trigger.closest('li, article, section, div, p, td') || trigger.parentElement;
  const nested = root?.querySelector(
    '[hidden], .answer, .answers, .dap-an, .spoiler, .solution, .hint, .giai-thich',
  );
  if (nested && nested !== trigger && !trigger.contains(nested)) return nested;
  if (next && isRevealTextTrigger(trigger)) return next;
  return null;
}

export function findRevealTargets(trigger, document) {
  const targets = [];
  const add = (element) => {
    if (element && element !== trigger && !trigger.contains(element) && !targets.includes(element)) {
      targets.push(element);
    }
  };

  for (const value of [
    trigger.getAttribute('data-lesson-reveal'),
    trigger.getAttribute('aria-controls'),
  ]) {
    for (const id of asString(value).split(/\s+/).filter(Boolean)) {
      if (isSafeDomId(id)) add(document.getElementById(id));
    }
  }

  const selector = trigger.getAttribute('data-lesson-reveal-selector');
  if (selector && isSafeRevealSelector(selector)) {
    try {
      add(document.querySelector(selector));
    } catch {
      /* ignore invalid selectors */
    }
  }

  if (trigger.hasAttribute('data-lesson-reveal-next')) add(trigger.nextElementSibling);

  const href = trigger.getAttribute('href') || '';
  if (href.startsWith('#') && href.length > 1 && isSafeDomId(href.slice(1))) {
    const panel = document.getElementById(href.slice(1));
    if (panel && (isRevealTextTrigger(trigger) || looksLikeAnswer(panel))) add(panel);
  }

  if (!targets.length) add(guessAnswerTarget(trigger));
  return targets;
}

export function toggleLessonReveal(trigger, targets) {
  const willOpen = trigger.getAttribute('aria-expanded') !== 'true';
  trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  const extraClass = trigger.getAttribute('data-lesson-toggle-class');

  for (const target of targets) {
    if (extraClass) target.classList.toggle(extraClass, willOpen);
    for (const name of TOGGLE_CLASSES) target.classList.toggle(name, willOpen);

    if (willOpen) {
      target.removeAttribute('hidden');
      if (target.style.display === 'none') target.style.display = '';
      const computed = target.ownerDocument.defaultView?.getComputedStyle(target);
      if (computed?.display === 'none') target.style.display = 'block';
    } else {
      if (target.style.display === 'block') target.style.display = '';
      target.setAttribute('hidden', '');
    }
  }
}

