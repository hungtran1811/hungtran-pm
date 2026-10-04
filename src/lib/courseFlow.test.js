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
  isLessonKeyOpenForClass,
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
    expect(isLessonKeyOpenForClass('B03', classDoc)).toBe(true);
    expect(isLessonKeyOpenForClass('L03', classDoc)).toBe(true);
    expect(isLessonKeyOpenForClass('B04', classDoc)).toBe(false);
    expect(isLessonKeyOpenForClass('L04', classDoc)).toBe(false);
    expect(isLessonKeyOpenForClass('B01', { curriculumCurrentSession: 0 })).toBe(false);
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
  it('normalizes supported GitHub, Canva, and Google Slides links', () => {
    expect(
      validateProjectLinks({
        githubUrl: 'github.com/me/app',
        canvaUrl: 'canva.com/design/abc',
        slidesUrl: 'docs.google.com/presentation/d/xyz/edit',
      }),
    ).toEqual({
      githubUrl: 'https://github.com/me/app',
      canvaUrl: 'https://canva.com/design/abc',
      slidesUrl: 'https://docs.google.com/presentation/d/xyz/edit',
      otherUrl: '',
    });
  });

  it('accepts a Google Slides share path with /u/0/', () => {
    expect(
      validateProjectLinks({
        slidesUrl: 'https://docs.google.com/presentation/u/0/d/abc/edit',
      }),
    ).toMatchObject({
      slidesUrl: 'https://docs.google.com/presentation/u/0/d/abc/edit',
    });
  });

  it('rejects unsupported hosts', () => {
    expect(validateProjectLinks({ githubUrl: 'example.com/app', canvaUrl: '' }).error).toMatch(
      /GitHub/,
    );
    expect(validateProjectLinks({ githubUrl: '', canvaUrl: 'figma.com/file/1' }).error).toMatch(
      /Canva/,
    );
    expect(
      validateProjectLinks({ githubUrl: '', canvaUrl: '', slidesUrl: 'docs.google.com/document/d/1' })
        .error,
    ).toMatch(/Google Slides/);
    expect(
      validateProjectLinks({ githubUrl: '', canvaUrl: '', slidesUrl: 'drive.google.com/file/d/1' })
        .error,
    ).toMatch(/Google Slides/);
  });

  it('accepts any https link in the extra field and stores http as https', () => {
    expect(
      validateProjectLinks({
        githubUrl: '',
        canvaUrl: '',
        slidesUrl: '',
        otherUrl: '',
      }),
    ).toMatchObject({ otherUrl: '' });
    expect(
      validateProjectLinks({ otherUrl: 'example.com/app' }),
    ).toMatchObject({ otherUrl: 'https://example.com/app' });
    expect(
      validateProjectLinks({ otherUrl: 'http://docs.example.com/notes' }),
    ).toMatchObject({ otherUrl: 'https://docs.example.com/notes' });
    expect(validateProjectLinks({ otherUrl: 'không phải link' }).error).toMatch(/Link khác/);
  });
});
