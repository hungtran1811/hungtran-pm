import { describe, expect, it } from 'vitest';
import { CREW_MINI_GAME_IDS } from '../data/crewMiniGames.js';
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

  it('can assign all new mini-game ids from the expanded pool', () => {
    const picks = assignCrewTasks({ sessionId: 's1', studentId: 'st1', count: 40 });
    const ids = new Set(picks.map((row) => row.taskId));
    for (const id of CREW_MINI_GAME_IDS) {
      expect(ids.has(id)).toBe(true);
    }
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

  it('validates number sort', () => {
    buildTaskInstance('number_sort', 111);
    expect(validateCrewTask('number_sort', 111, { sequence: [1, 2, 3, 4, 5, 6] }).ok).toBe(true);
    expect(validateCrewTask('number_sort', 111, { sequence: [1, 2, 3, 4, 6, 5] }).ok).toBe(false);
  });

  it('validates math pick', () => {
    const instance = buildTaskInstance('math_pick', 222);
    expect(instance.options).toHaveLength(4);
    expect(instance.options).toContain(instance.answer);
    expect(validateCrewTask('math_pick', 222, { answer: instance.answer }).ok).toBe(true);
    expect(validateCrewTask('math_pick', 222, { answer: instance.answer + 99 }).ok).toBe(false);
  });

  it('validates symbol hunt', () => {
    const instance = buildTaskInstance('symbol_hunt', 333);
    expect(instance.grid).toHaveLength(9);
    expect(instance.grid[instance.targetIndex]).toBe(instance.target);
    expect(validateCrewTask('symbol_hunt', 333, { pickIndex: instance.targetIndex }).ok).toBe(true);
    expect(validateCrewTask('symbol_hunt', 333, { pickIndex: (instance.targetIndex + 1) % 9 }).ok).toBe(false);
  });

  it('validates direction dash', () => {
    const instance = buildTaskInstance('direction_dash', 444);
    expect(instance.buttonOrder).toHaveLength(4);
    expect(validateCrewTask('direction_dash', 444, { direction: instance.direction }).ok).toBe(true);
    const wrong = instance.buttonOrder.find((d) => d !== instance.direction);
    expect(validateCrewTask('direction_dash', 444, { direction: wrong }).ok).toBe(false);
  });
});
