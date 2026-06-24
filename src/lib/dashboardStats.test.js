import { describe, expect, it } from 'vitest';
import { computeDashboardStats, studentClassCode } from './dashboardStats.js';

describe('studentClassCode', () => {
  it('prefers classCode then classId', () => {
    expect(studentClassCode({ classCode: 'A', classId: 'B' })).toBe('A');
    expect(studentClassCode({ classId: 'B' })).toBe('B');
  });
});

describe('computeDashboardStats', () => {
  const classes = [
    { classCode: 'ACTIVE', status: 'active', studentCount: 3 },
    { classCode: 'DONE', status: 'completed', studentCount: 2 },
  ];

  const students = [
    { id: '1', active: true, classCode: 'ACTIVE', currentStatus: 'Đang làm' },
    { id: '2', active: true, classId: 'ACTIVE', currentStatus: 'Cần hỗ trợ' },
    { id: '3', active: true, classCode: 'DONE', currentStatus: 'Hoàn thành' },
    { id: '4', active: false, classCode: 'ACTIVE', currentStatus: 'Đang làm' },
  ];

  it('counts only active students in active classes', () => {
    const stats = computeDashboardStats(classes, students);
    expect(stats.activeClasses).toBe(1);
    expect(stats.activeStudents).toBe(2);
    expect(stats.needsHelp).toBe(1);
    expect(stats.alumniStudents).toBe(1);
  });
});
