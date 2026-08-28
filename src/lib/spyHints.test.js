import { describe, expect, it } from 'vitest';
import { advanceSpyHint, buildSpyNameHint } from './spyHints.js';

describe('buildSpyNameHint', () => {
  it('returns vague hint at low levels', () => {
    expect(buildSpyNameHint('Nguyễn Văn An', 1)).toContain('chữ cái');
    expect(buildSpyNameHint('Nguyễn Văn An', 2)).toContain('N');
    expect(buildSpyNameHint('Nguyễn Văn An', 7)).toContain('Nguyễn Văn An');
  });
});

describe('advanceSpyHint', () => {
  const participants = [
    { id: 'spy', studentName: 'Spy One', isSpy: true },
    { id: 'a', studentName: 'Alice', isSpy: false },
    { id: 'b', studentName: 'Bob', isSpy: false },
  ];

  it('returns empty hint when no civilian eliminated', () => {
    expect(advanceSpyHint({ participants, eliminatedIds: [] }).spyHintText).toBe('');
  });

  it('returns hint when civilian is eliminated', () => {
    const hint = advanceSpyHint({ participants, eliminatedIds: ['a'] });
    expect(hint.spyHintText).toBeTruthy();
    expect(hint.spyHintLevel).toBeGreaterThan(0);
  });

  it('does not hint when only spy eliminated', () => {
    expect(advanceSpyHint({ participants, eliminatedIds: ['spy'] }).spyHintText).toBe('');
  });
});
