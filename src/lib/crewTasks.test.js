import { describe, expect, it } from 'vitest';
import { assignCrewTasks, buildTaskInstance, validateCrewTask } from './crewTasks.js';

describe('assignCrewTasks', () => {
  it('returns stable tasks for same session and student', () => {
    const a = assignCrewTasks({ sessionId: 's1', studentId: 'st1', count: 5 });
    const b = assignCrewTasks({ sessionId: 's1', studentId: 'st1', count: 5 });
    expect(a).toEqual(b);
  });

  it('changes task seeds for different students', () => {
    const a = assignCrewTasks({ sessionId: 's1', studentId: 'st1', count: 5 });
    const b = assignCrewTasks({ sessionId: 's1', studentId: 'st2', count: 5 });
    expect(a).not.toEqual(b);
  });
});

describe('validateCrewTask', () => {
  it('validates tap sequence', () => {
    const task = assignCrewTasks({ sessionId: 's1', studentId: 'st1', count: 1 })[0];
    const instance = buildTaskInstance('tap_sequence', task.instanceSeed);
    expect(validateCrewTask('tap_sequence', task.instanceSeed, { sequence: instance.order }).ok).toBe(true);
  });

  it('validates odd one out', () => {
    const instance = buildTaskInstance('odd_one_out', 123);
    expect(validateCrewTask('odd_one_out', 123, { pickIndex: instance.oddIndex }).ok).toBe(true);
  });

  it('validates timing bar', () => {
    const instance = buildTaskInstance('timing_bar', 456);
    expect(validateCrewTask('timing_bar', 456, { position: instance.zoneStart + 1 }).ok).toBe(true);
  });

  it('validates wire match', () => {
    const instance = buildTaskInstance('wire_match', 789);
    expect(validateCrewTask('wire_match', 789, {
      matches: instance.leftOrder.map((color) => ({ left: color, right: color })),
    }).ok).toBe(true);
  });

  it('validates quick count', () => {
    const instance = buildTaskInstance('quick_count', 321);
    expect(validateCrewTask('quick_count', 321, { answer: instance.count }).ok).toBe(true);
  });
});
