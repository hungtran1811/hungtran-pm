// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  filterPresentStudents,
  loadPresentStudentIds,
  maxSpyCount,
  normalizePresentIds,
  savePresentStudentIds,
} from './minigameAttendance.js';
import { responsesToPracticeAnswers, responsesToRawAnswers } from './quizResponses.js';

describe('minigameAttendance', () => {
  it('maxSpyCount follows floor(present/3) rule', () => {
    expect(maxSpyCount(2)).toBe(0);
    expect(maxSpyCount(3)).toBe(1);
    expect(maxSpyCount(8)).toBe(2);
    expect(maxSpyCount(9)).toBe(3);
  });

  it('normalizePresentIds defaults to all when stored empty', () => {
    expect([...normalizePresentIds(['a', 'b'], [])]).toEqual(['a', 'b']);
  });

  it('filterPresentStudents keeps only checked ids', () => {
    const students = [
      { id: 'a', fullName: 'A' },
      { id: 'b', fullName: 'B' },
    ];
    expect(filterPresentStudents(students, new Set(['b']))).toEqual([{ id: 'b', fullName: 'B' }]);
  });

  it('sessionStorage round-trip for present ids', () => {
    const key = 'minigame-present:test-class';
    sessionStorage.setItem(key, JSON.stringify(['a']));
    expect([...loadPresentStudentIds('test-class', ['a', 'b'])]).toEqual(['a']);
    savePresentStudentIds('test-class', new Set(['b']));
    expect([...loadPresentStudentIds('test-class', ['a', 'b'])]).toEqual(['b']);
    sessionStorage.removeItem(key);
  });
});

describe('quizResponses', () => {
  it('responsesToRawAnswers reconstructs mcq and code answers', () => {
    const raw = responsesToRawAnswers([
      { questionId: 'q1', questionType: 'mcq', selectedIndex: 2 },
      { questionId: 'q2', questionType: 'code', codeAnswer: 'print(1)' },
      { questionId: 'q3', questionType: 'code', codeAnswer: '(chưa trả lời)' },
    ]);
    expect(raw).toEqual({ q1: 2, q2: 'print(1)', q3: '' });
  });

  it('responsesToPracticeAnswers maps selected indices', () => {
    const raw = responsesToPracticeAnswers([
      { questionId: 'p1', selectedIndex: 0 },
      { questionId: 'p2', selectedIndex: -1 },
    ]);
    expect(raw).toEqual({ p1: 0 });
  });
});
