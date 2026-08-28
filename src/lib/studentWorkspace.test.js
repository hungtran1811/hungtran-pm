import { describe, expect, it } from 'vitest';
import {
  studentLearnPath,
  studentLessonsPath,
  studentProjectPath,
  studentUsesProjectWorkspace,
  studentWorkspaceHomePath,
} from './studentWorkspace.js';

describe('student workspace paths', () => {
  it('sends a learning-phase class to the lesson reader', () => {
    expect(studentWorkspaceHomePath('PY 101', { curriculumPhase: 'learning' })).toBe(
      '/c/PY%20101/learn',
    );
    expect(studentUsesProjectWorkspace({ curriculumPhase: 'learning' })).toBe(false);
  });

  it('sends a final project class to the project workspace', () => {
    const classDoc = { curriculumPhase: 'final', finalMode: 'project' };
    expect(studentWorkspaceHomePath('WEB1', classDoc)).toBe('/c/WEB1/project');
    expect(studentUsesProjectWorkspace(classDoc)).toBe(true);
    expect(studentLessonsPath('WEB1')).toBe('/c/WEB1/lessons');
    expect(studentProjectPath('WEB1')).toBe('/c/WEB1/project');
  });

  it('keeps a final exam class on the lesson reader', () => {
    const classDoc = { curriculumPhase: 'final', finalMode: 'exam' };
    expect(studentWorkspaceHomePath('EX1', classDoc)).toBe('/c/EX1/learn');
    expect(studentUsesProjectWorkspace(classDoc)).toBe(false);
    expect(studentLearnPath('EX1')).toBe('/c/EX1/learn');
  });
});
