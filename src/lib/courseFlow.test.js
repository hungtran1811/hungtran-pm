import { describe, expect, it } from 'vitest';
import {
  classUsesProjectNames,
  displayStudentStatus,
  isProjectNameApproved,
  needsProjectNameSetup,
  projectNameAwaitingReview,
  projectNameDisplay,
  resolveFinalMode,
} from './classFinalMode.js';
import {
  ALL_SESSIONS_VALUE,
  filterBySessionScope,
  filterBySessionScopeMulti,
  sessionNumbersUpToCurrent,
  sessionNumbersUpToCurrentMulti,
  unlockedLessonSessionCap,
} from './sessionScope.js';
import { validateProjectLinks } from './projectLinks.js';

describe('classFinalMode', () => {
  it('resolves final mode with class override before program default', () => {
    expect(resolveFinalMode({ finalMode: 'exam' }, { finalMode: 'project' })).toBe('exam');
    expect(resolveFinalMode({}, { finalMode: 'exam' })).toBe('exam');
    expect(resolveFinalMode({}, {})).toBe('project');
  });

  it('detects project-name states for student portal gating', () => {
    const pending = { projectNameStatus: 'pending', projectNameSubmission: 'Todo App' };
    const rejected = { projectNameStatus: 'rejected', projectNameSubmission: 'Old Idea' };
    const approved = { projectNameStatus: 'approved', projectName: 'Final App' };

    expect(classUsesProjectNames({ finalMode: 'project' })).toBe(true);
    expect(projectNameAwaitingReview(pending)).toBe('Todo App');
    expect(needsProjectNameSetup(rejected, { finalMode: 'project' })).toBe(true);
    expect(isProjectNameApproved(approved)).toBe(true);
    expect(projectNameDisplay(approved)).toBe('Final App');
  });

  it('shows neutral learning status for exam-mode classes without project tracking', () => {
    expect(displayStudentStatus({ currentStatus: 'Chưa bắt đầu' }, { finalMode: 'exam' })).toBe(
      'Đang học',
    );
    expect(displayStudentStatus({ currentStatus: 'Cần hỗ trợ' }, { finalMode: 'exam' })).toBe(
      'Cần hỗ trợ',
    );
  });
});

describe('sessionScope', () => {
  const classDoc = { classCode: 'A', curriculumCurrentSession: 3 };
  const rows = [
    { id: 's1', classCode: 'A', sessionNumber: 1 },
    { id: 's4', classCode: 'A', sessionNumber: 4 },
  ];

  it('unlocks sessions up to the class current session', () => {
    expect(unlockedLessonSessionCap(classDoc)).toBe(3);
    expect(sessionNumbersUpToCurrent(classDoc)).toEqual([1, 2, 3]);
    expect(sessionNumbersUpToCurrent({ curriculumCurrentSession: 0 })).toEqual([]);
  });

  it('filters rows by explicit and implicit session scope', () => {
    expect(filterBySessionScope(rows, classDoc, ALL_SESSIONS_VALUE).map((r) => r.id)).toEqual([
      's1',
    ]);
    expect(filterBySessionScope(rows, classDoc, '4').map((r) => r.id)).toEqual(['s4']);
  });

  it('supports multi-class session scope', () => {
    const classesByCode = new Map([
      ['A', { classCode: 'A', curriculumCurrentSession: 1 }],
      ['B', { classCode: 'B', curriculumCurrentSession: 2 }],
    ]);
    const multiRows = [
      { id: 'a1', classCode: 'A', sessionNumber: 1 },
      { id: 'a2', classCode: 'A', sessionNumber: 2 },
      { id: 'b2', classCode: 'B', sessionNumber: 2 },
    ];

    expect(sessionNumbersUpToCurrentMulti([...classesByCode.values()])).toEqual([1, 2]);
    expect(filterBySessionScopeMulti(multiRows, classesByCode, ALL_SESSIONS_VALUE).map((r) => r.id))
      .toEqual(['a1', 'b2']);
  });
});

describe('projectLinks', () => {
  it('normalizes supported GitHub and Canva links', () => {
    expect(validateProjectLinks({ githubUrl: 'github.com/me/app', canvaUrl: 'canva.com/design/abc' }))
      .toEqual({
        githubUrl: 'https://github.com/me/app',
        canvaUrl: 'https://canva.com/design/abc',
      });
  });

  it('rejects unsupported hosts', () => {
    expect(validateProjectLinks({ githubUrl: 'example.com/app', canvaUrl: '' }).error).toMatch(
      /GitHub/,
    );
    expect(validateProjectLinks({ githubUrl: '', canvaUrl: 'figma.com/file/1' }).error).toMatch(
      /Canva/,
    );
  });
});
