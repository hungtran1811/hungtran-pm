import { describe, expect, it } from 'vitest';
import {
  classRequiresProgressAndProduct,
  findProgramForClass,
  studentLearnPath,
  studentLessonsPath,
  studentProjectPath,
  studentSubmitPath,
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
    expect(studentSubmitPath('EX1')).toBe('/c/EX1/submit');
  });
});

describe('classRequiresProgressAndProduct', () => {
  it('requires both deliverables only for final project classes', () => {
    expect(classRequiresProgressAndProduct({ curriculumPhase: 'learning' })).toBe(false);
    expect(
      classRequiresProgressAndProduct({ curriculumPhase: 'final', finalMode: 'project' }),
    ).toBe(true);
    expect(classRequiresProgressAndProduct({ curriculumPhase: 'final', finalMode: 'exam' })).toBe(
      false,
    );
    expect(
      classRequiresProgressAndProduct({ curriculumPhase: 'final', programId: 'p1' }, { finalMode: 'exam' }),
    ).toBe(false);
  });

  it('resolves the matching program for a class', () => {
    const program = { id: 'web', finalMode: 'project' };
    expect(findProgramForClass({ curriculumProgramId: 'web' }, [program])).toEqual(program);
    expect(findProgramForClass({ programId: 'web' }, [program])).toEqual(program);
    expect(findProgramForClass({ programId: 'other' }, [program])).toBeNull();
  });
});
