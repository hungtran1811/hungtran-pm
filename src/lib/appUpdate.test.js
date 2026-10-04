import { describe, expect, it } from 'vitest';
import { isUserEditing, shouldReloadForVersion } from './appUpdate.js';

describe('shouldReloadForVersion', () => {
  it('reloads when the published build differs from the running one', () => {
    expect(shouldReloadForVersion('abc', 'def')).toBe(true);
    expect(shouldReloadForVersion('abc', 'abc')).toBe(false);
  });

  it('does not reload local or missing versions', () => {
    expect(shouldReloadForVersion('dev', 'abc')).toBe(false);
    expect(shouldReloadForVersion('abc', 'dev')).toBe(false);
    expect(shouldReloadForVersion('', 'abc')).toBe(false);
  });
});

describe('isUserEditing', () => {
  it('treats form fields as in progress', () => {
    expect(isUserEditing({ tagName: 'TEXTAREA', isContentEditable: false })).toBe(true);
    expect(isUserEditing({ tagName: 'DIV', isContentEditable: false })).toBe(false);
    expect(isUserEditing(null)).toBe(false);
  });
});
