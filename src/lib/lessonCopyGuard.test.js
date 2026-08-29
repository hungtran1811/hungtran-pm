// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { attachLessonCopyGuard, protectLessonIframeDocument } from './lessonCopyGuard.js';

describe('attachLessonCopyGuard', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('prevents copy, cut, contextmenu, selectstart and dragstart', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const detach = attachLessonCopyGuard(root);

    for (const type of ['copy', 'cut', 'contextmenu', 'selectstart', 'dragstart']) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      root.dispatchEvent(event);
      expect(event.defaultPrevented, type).toBe(true);
    }

    detach();
  });

  it('prevents Ctrl/Cmd clipboard shortcuts', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const detach = attachLessonCopyGuard(root);

    for (const key of ['c', 'x', 'a', 's', 'p']) {
      const event = new KeyboardEvent('keydown', {
        key,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      root.dispatchEvent(event);
      expect(event.defaultPrevented, key).toBe(true);
    }

    const allowed = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    root.dispatchEvent(allowed);
    expect(allowed.defaultPrevented).toBe(false);

    detach();
  });

  it('detach removes listeners', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const detach = attachLessonCopyGuard(root);
    detach();

    const event = new Event('copy', { bubbles: true, cancelable: true });
    root.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('protectLessonIframeDocument', () => {
  it('injects protect CSS and blocks copy inside the document', () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const doc = iframe.contentDocument;
    doc.open();
    doc.write('<!doctype html><html><head></head><body><pre>code</pre></body></html>');
    doc.close();

    const detach = protectLessonIframeDocument(doc);
    expect(doc.documentElement.getAttribute('data-lesson-copy-protect')).toBe('');
    expect(doc.querySelector('style[data-lesson-copy-protect]')).not.toBeNull();

    const event = new Event('copy', { bubbles: true, cancelable: true });
    doc.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    detach();
    expect(doc.documentElement.getAttribute('data-lesson-copy-protect')).toBeNull();
    expect(doc.querySelector('style[data-lesson-copy-protect]')).toBeNull();
    iframe.remove();
  });
});
