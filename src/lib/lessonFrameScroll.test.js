import { describe, expect, it } from 'vitest';
import {
  applyWheelScroll,
  canElementScroll,
  findInnerScrollTarget,
  iframeNeedsWheelForward,
  measureLessonDocumentHeight,
  normalizeWheelDelta,
  shouldForwardIframeWheel,
} from './lessonFrameScroll.js';

function style(overflowY = 'visible', overflowX = 'visible') {
  return () => ({ overflowY, overflowX });
}

describe('lesson iframe wheel forwarding', () => {
  it('converts line and page deltas into pixels', () => {
    expect(normalizeWheelDelta({ deltaX: 0, deltaY: 3, deltaMode: 1 })).toEqual({
      deltaX: 0,
      deltaY: 48,
    });
    expect(normalizeWheelDelta({ deltaX: 0, deltaY: 1, deltaMode: 2, view: { innerHeight: 500 } })).toEqual({
      deltaX: 0,
      deltaY: 500,
    });
    expect(normalizeWheelDelta({ deltaX: 2, deltaY: 40, deltaMode: 0 })).toEqual({
      deltaX: 2,
      deltaY: 40,
    });
  });

  it('only treats overflow auto/scroll panes as inner scrollers', () => {
    const pane = { nodeType: 1, scrollHeight: 400, clientHeight: 120, scrollTop: 0 };
    expect(canElementScroll(pane, 0, 80, style('hidden'))).toBe(false);
    expect(canElementScroll(pane, 0, 80, style('auto'))).toBe(true);
    pane.scrollTop = 279;
    expect(canElementScroll(pane, 0, 80, style('auto'))).toBe(false);
    expect(canElementScroll(pane, 0, -80, style('auto'))).toBe(true);
  });

  it('keeps wheel inside a nested lesson scroller instead of forwarding', () => {
    const root = { nodeType: 1, parentElement: null };
    const inner = {
      nodeType: 1,
      parentElement: root,
      scrollHeight: 800,
      clientHeight: 200,
      scrollTop: 10,
      scrollWidth: 200,
      clientWidth: 200,
      scrollLeft: 0,
    };
    const getStyle = (el) =>
      el === inner ? { overflowY: 'auto', overflowX: 'visible' } : { overflowY: 'visible', overflowX: 'visible' };
    expect(findInnerScrollTarget(inner, { deltaY: 40, root, getStyle })).toBe(inner);
    expect(
      shouldForwardIframeWheel(
        { deltaY: 40, deltaMode: 0, target: inner, view: { document: { documentElement: root } } },
        { frame: { parentElement: null }, getStyle },
      ),
    ).toBe(false);
  });

  it('forwards wheel to the outer page when the iframe itself cannot scroll', () => {
    const html = { nodeType: 1, parentElement: null };
    const frame = {
      parentElement: {
        parentElement: null,
        scrollHeight: 2000,
        clientHeight: 400,
        scrollWidth: 400,
        clientWidth: 400,
      },
    };
    const body = {
      nodeType: 1,
      parentElement: html,
      scrollHeight: 2000,
      clientHeight: 2000,
      scrollTop: 0,
    };
    const getStyle = (el) =>
      el === frame.parentElement
        ? { overflowY: 'auto', overflowX: 'visible' }
        : { overflowY: 'hidden', overflowX: 'hidden' };
    expect(
      shouldForwardIframeWheel(
        { deltaY: 100, deltaMode: 0, target: body, view: { document: { documentElement: html } } },
        { frame, getStyle },
      ),
    ).toBe(true);
  });

  it('applies pixel deltas with scrollBy when available', () => {
    const calls = [];
    const scroller = { scrollBy: (x, y) => calls.push([x, y]) };
    applyWheelScroll(scroller, 0, 48);
    expect(calls).toEqual([[0, 48]]);
  });

  it('does not synthetic-scroll Chromium, where the parent already receives the wheel', () => {
    expect(
      iframeNeedsWheelForward(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      ),
    ).toBe(false);
    expect(
      iframeNeedsWheelForward(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
      ),
    ).toBe(false);
    expect(iframeNeedsWheelForward('Mozilla/5.0 (Windows NT 10.0; rv:129.0) Gecko/20100101 Firefox/129.0')).toBe(
      true,
    );
    expect(
      iframeNeedsWheelForward(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.0.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(true);
    expect(
      iframeNeedsWheelForward(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      ),
    ).toBe(true);
  });

  it('ignores pinch-zoom wheel events', () => {
    expect(
      shouldForwardIframeWheel(
        { deltaY: 40, deltaMode: 0, ctrlKey: true, target: { nodeType: 1, parentElement: null } },
        { frame: { parentElement: null } },
      ),
    ).toBe(false);
  });

  it('measures document height without collapsing the iframe', () => {
    function mockStyle() {
      return {
        getPropertyValue: () => '',
        getPropertyPriority: () => '',
        setProperty() {},
        removeProperty() {},
      };
    }
    const html = { style: mockStyle(), scrollHeight: 1800, offsetHeight: 1800 };
    const body = { style: mockStyle(), scrollHeight: 1800, offsetHeight: 400 };
    const frame = {
      style: { height: '400px' },
      contentDocument: { documentElement: html, body },
    };
    expect(measureLessonDocumentHeight(frame)).toBe(1808);
    expect(frame.style.height).toBe('400px');
  });
});
