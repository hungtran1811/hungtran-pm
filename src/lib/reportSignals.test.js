import { describe, expect, it } from 'vitest';
import {
  completionSignal,
  lastActivityTime,
  signalLabel,
  sortByRecentActivity,
} from './reportSignals.js';

describe('reportSignals', () => {
  it('maps report + file into traffic-light states', () => {
    const flags = { showReport: true, showDrive: true };
    expect(completionSignal({ hasReport: true, hasFile: true, isComplete: true }, flags)).toBe('green');
    expect(completionSignal({ hasReport: true, hasFile: true, isComplete: false }, flags)).toBe('yellow');
    expect(completionSignal({ hasReport: true, hasFile: false }, flags)).toBe('yellow');
    expect(completionSignal({ hasReport: false, hasFile: true }, flags)).toBe('yellow');
    expect(completionSignal({ hasReport: false, hasFile: false }, flags)).toBe('red');
    expect(signalLabel('yellow', flags)).toBe('Thiếu một phần');
  });

  it('sorts the newest submission first', () => {
    const older = {
      student: { fullName: 'An' },
      report: { submittedAt: new Date('2026-09-12T08:00:00') },
    };
    const newer = {
      student: { fullName: 'Bình' },
      drive: { latest: { submittedAt: new Date('2026-09-12T10:00:00') } },
    };
    const idle = { student: { fullName: 'Chi' } };
    expect(sortByRecentActivity([idle, older, newer]).map((item) => item.student.fullName)).toEqual([
      'Bình',
      'An',
      'Chi',
    ]);
    expect(lastActivityTime(newer)).toBeGreaterThan(lastActivityTime(older));
  });
});
