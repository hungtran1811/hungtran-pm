// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  filterPresentStudents,
  loadPresentStudentIds,
  maxSpyCount,
  normalizePresentIds,
  savePresentStudentIds,
} from './minigameAttendance.js';

describe('minigameAttendance', () => {
  it('maxSpyCount follows floor(present/3) rule', () => {
    expect(maxSpyCount(2)).toBe(0);
    expect(maxSpyCount(3)).toBe(1);
    expect(maxSpyCount(8)).toBe(2);
    expect(maxSpyCount(9)).toBe(3);
  });

  it('normalizePresentIds returns empty when stored empty', () => {
    expect([...normalizePresentIds(['a', 'b'], [])]).toEqual([]);
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

  it('loadPresentStudentIds returns empty when nothing stored', () => {
    expect([...loadPresentStudentIds('empty-class', ['a', 'b'])]).toEqual([]);
  });
});
