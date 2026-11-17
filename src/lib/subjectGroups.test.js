import { describe, expect, it } from 'vitest';
import {
  filterClassesBySubject,
  firstProgramForSubject,
  groupProgramsBySubjectAndLevel,
  catalogForGroupName,
  nextMindxProgram,
  resolveClassSubject,
  resolveProgramLevel,
  resolveProgramLevelMeta,
  resolveProgramSubject,
  resolveProgramSubjectMeta,
  subjectsWithClasses,
  subjectsWithPrograms,
} from './subjectGroups.js';

const programs = [
  { id: 'python-basic', name: 'Python Basic', subject: 'python', level: 'basic' },
  { id: 'python-adv', name: 'Python nâng cao', subject: '', level: '' },
  { id: 'web-intro', name: 'Web Intro', subject: 'web', level: 'Cơ bản' },
  { id: 'robot-1', name: 'Robotics 101', subject: 'Robotics', level: 'intensive' },
  { id: 'mystery', name: 'Mystery Course', subject: '', level: '' },
];

const programsById = Object.fromEntries(programs.map((p) => [p.id, p]));

const classes = [
  { classCode: 'PY1', curriculumProgramId: 'python-basic' },
  { classCode: 'WEB1', curriculumProgramId: 'web-intro' },
  { classCode: 'ROB1', curriculumProgramId: 'robot-1' },
  { classCode: 'MY1', curriculumProgramId: 'mystery' },
];

describe('subject grouping', () => {
  it('does not dump unknown subjects into web', () => {
    expect(resolveProgramSubject('mystery', programs[4])).toBe('other');
    expect(resolveProgramSubjectMeta('robot-1', programs[3])).toEqual({
      id: 'robotics',
      label: 'Robotics',
    });
  });

  it('resolves level from field then name/id', () => {
    expect(resolveProgramLevel(programs[0])).toBe('basic');
    expect(resolveProgramLevel(programs[1])).toBe('advanced');
    expect(resolveProgramLevel(programs[2])).toBe('basic');
    expect(resolveProgramLevel(programs[3])).toBe('intensive');
    expect(resolveProgramLevel(programs[4])).toBe('other');
  });

  it('groups programs by subject then level', () => {
    const groups = groupProgramsBySubjectAndLevel(programs);
    expect(groups.map((g) => g.id)).toEqual(['python', 'web', 'robotics', 'other']);

    const python = groups.find((g) => g.id === 'python');
    expect(python.levels.map((l) => l.id)).toEqual(['basic', 'advanced']);
    expect(python.levels[0].programs.map((p) => p.id)).toEqual(['python-basic']);
    expect(python.levels[1].programs.map((p) => p.id)).toEqual(['python-adv']);
  });

  it('only lists subject chips that have programs', () => {
    const chips = subjectsWithPrograms(programs);
    expect(chips.map((c) => c.id)).toEqual(['all', 'python', 'web', 'robotics', 'other']);
    expect(chips.some((c) => c.id === 'scratch')).toBe(false);
  });

  it('lists class subject chips from attached programs including custom subjects', () => {
    const chips = subjectsWithClasses(classes, programsById);
    expect(chips.map((c) => c.id)).toEqual(['all', 'python', 'web', 'robotics', 'other']);
    expect(resolveClassSubject(classes[2], programsById)).toBe('robotics');
    expect(filterClassesBySubject(classes, 'python', programsById).map((c) => c.classCode)).toEqual([
      'PY1',
    ]);
    expect(filterClassesBySubject(classes, 'robotics', programsById).map((c) => c.classCode)).toEqual([
      'ROB1',
    ]);
  });

  it('follows the MindX path and stops after Computer Scientist', () => {
    const mindx = [
      { id: 'scratch-basic', name: 'Scratch Basic', subject: 'Scratch', level: 'Basic' },
      { id: 'scratch-advanced', name: 'Scratch Advanced', subject: 'Scratch', level: 'Advanced' },
      { id: 'scratch-intensive', name: 'Scratch Intensive', subject: 'Scratch', level: 'Intensive' },
      { id: 'gamemaker-basic', name: 'Gamemaker Basic', subject: 'Gamemaker', level: 'Basic' },
      { id: 'python-app-basic', name: 'Python Basic', subject: 'Python', level: 'Basic' },
      { id: 'python-intensive', name: 'Python Intensive', subject: 'Python App', level: 'Intensive' },
      { id: 'web-basic', name: 'Web Basic', subject: 'Web', level: 'Basic' },
      { id: 'web-intensive', name: 'Web Intensive', subject: 'Web', level: 'Intensive' },
      { id: 'computer-science-basic', name: 'Computer Science Basic', subject: 'Computer Science', level: 'Basic' },
      { id: 'computer-science-intensive', name: 'Computer Science Intensive', subject: 'Computer Science', level: 'Intensive' },
      { id: 'robot-lab', name: 'Robot Lab', subject: 'Robotics', level: 'Basic', catalog: 'custom' },
    ];
    const groups = groupProgramsBySubjectAndLevel(mindx.filter((program) => program.catalog !== 'custom'));
    expect(groups.map((group) => group.id)).toEqual(['scratch', 'gamemaker', 'python', 'web', 'cs']);
    expect(nextMindxProgram(mindx[0], mindx).program.id).toBe('scratch-advanced');
    expect(nextMindxProgram(mindx[2], mindx).program.id).toBe('gamemaker-basic');
    expect(nextMindxProgram(mindx[5], mindx).program.id).toBe('web-basic');
    expect(nextMindxProgram(mindx[7], mindx).toLabel).toBe('Computer Scientist · Basic');
    expect(nextMindxProgram(mindx[9], mindx)).toMatchObject({ program: null, terminal: true });
    expect(nextMindxProgram(mindx[10], mindx).program).toBeNull();
    expect(resolveProgramSubjectMeta('robot-lab', mindx[10]).id).toBe('custom-robotics');
    expect(catalogForGroupName('Scratch')).toBe('mindx');
    expect(catalogForGroupName('Robotics')).toBe('custom');
    expect(resolveProgramLevelMeta({ level: 'Khối 6' })).toEqual({ id: 'level-khoi-6', label: 'Khối 6' });
  });

  it('picks the first basic program for a subject chip', () => {
    expect(firstProgramForSubject(programs, 'all')).toBeNull();
    expect(firstProgramForSubject(programs, 'python')?.id).toBe('python-basic');
    expect(firstProgramForSubject(programs, 'web')?.id).toBe('web-intro');
    expect(firstProgramForSubject(programs, 'robotics')?.id).toBe('robot-1');
  });
});
