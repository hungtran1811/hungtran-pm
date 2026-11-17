import { describe, expect, it } from 'vitest';
import { buildStudentLessonOptions, classRoadmapSessions, defaultLessonKey } from './submissionLessons.js';
import { planUpLevel, upLevelGate } from './upLevel.js';

const source = {
  classCode: 'PVĐ-JSB05',
  curriculumProgramId: 'web-basic',
  curriculumCurrentSession: 8,
  cohortId: '',
};

const program = { id: 'web-next', totalSessionCount: 8, finalMode: 'project' };

function student(id, progress = 70) {
  return {
    id,
    active: true,
    classId: source.classCode,
    classCode: source.classCode,
    fullName: id,
    currentProgressPercent: progress,
    currentStatus: 'Đang làm',
    currentStage: 'Xây dựng sản phẩm',
    projectName: 'Sản phẩm cũ',
    latestReportId: 'report-old',
    openedLessonIds: ['L08'],
    pinHash: 'should-not-copy',
    credentialVersion: 4,
  };
}

function plan(overrides = {}) {
  return planUpLevel({
    source,
    students: [student('a', 70), student('b', 40)],
    program,
    sessionTotal: 8,
    targetClassCode: 'PVĐ-JSB06',
    className: 'Web tiếp',
    studentAccessCode: 'JSB06',
    selectedIds: ['a'],
    confirmCode: 'PVĐ-JSB06',
    ...overrides,
  });
}

describe('upLevelGate', () => {
  it('uses the program session count instead of a fixed 14', () => {
    expect(upLevelGate(7, 8)).toEqual({ ready: false, early: true });
    expect(upLevelGate(8, 8)).toEqual({ ready: true, early: false });
    expect(upLevelGate(13, 14)).toEqual({ ready: false, early: true });
    expect(upLevelGate(14, 14)).toEqual({ ready: true, early: false });
  });
});

describe('planUpLevel', () => {
  it('judges the source program length, not the destination program', () => {
    const result = plan({ program: { id: 'longer', totalSessionCount: 14, finalMode: 'project' } });
    expect(result.ok).toBe(true);
    expect(result.writes.find((write) => write.id === 'PVĐ-JSB06' && write.step === 'prepare').data.curriculumCurrentSession).toBe(0);
  });

  it('rejects a target code that already exists, including an archived class', () => {
    const archived = plan({
      targetClass: { classCode: 'PVĐ-JSB06', status: 'archived', previousClassCode: '' },
    });
    expect(archived.ok).toBe(false);
    expect(archived.error).toBe('Mã lớp đã tồn tại.');
  });

  it('returns the same target when the same committed request is repeated', () => {
    const again = plan({
      existingProgression: {
        state: 'committed',
        targetClassCode: 'PVĐ-JSB06',
        studentIds: ['a'],
        requestHash: '',
      },
    });
    expect(again).toMatchObject({ ok: true, already: true, targetClassCode: 'PVĐ-JSB06', writes: [] });
  });

  it('rejects a second target after the source was committed', () => {
    const other = plan({
      targetClassCode: 'PVĐ-OTHER',
      confirmCode: 'PVĐ-OTHER',
      studentAccessCode: 'OTHER',
      existingProgression: { state: 'committed', targetClassCode: 'PVĐ-JSB06', studentIds: ['a'] },
    });
    expect(other).toMatchObject({ ok: false, status: 409 });
  });

  it('keeps the source progress snapshot and starts the target at zero', () => {
    const result = plan();
    expect(result.ok).toBe(true);
    const snapshot = result.writes.find((write) => write.collection === 'classStudentStates' && write.id === 'PVĐ-JSB05__a');
    const targetState = result.writes.find((write) => write.collection === 'classStudentStates' && write.id === 'PVĐ-JSB06__a');
    const sourceClass = result.writes.find((write) => write.collection === 'classes' && write.id === 'PVĐ-JSB05');
    expect(snapshot.data.currentProgressPercent).toBe(70);
    expect(snapshot.data.latestReportId).toBe('report-old');
    expect(targetState.data).toMatchObject({
      currentProgressPercent: 0,
      projectName: '',
      latestReportId: '',
      openedLessonIds: [],
    });
    expect(sourceClass.data).toMatchObject({ status: 'completed', nextClassCode: 'PVĐ-JSB06' });
    expect(sourceClass.data.currentProgressPercent).toBeUndefined();
    expect(result.writes.some((write) => write.data?.currentProgressPercent === 100)).toBe(false);
  });

  it('does not write credentials and does not enroll an excluded student on the target', () => {
    const result = plan();
    expect(result.writes.some((write) => write.collection === 'studentCredentials')).toBe(false);
    const mirror = result.writes.find((write) => write.collection === 'students' && write.id === 'a');
    expect(mirror.data.pinHash).toBeUndefined();
    expect(mirror.data.credentialVersion).toBeUndefined();
    expect(mirror.data.currentProgressPercent).toBe(0);
    expect(result.writes.some((write) => write.id === 'PVĐ-JSB06__b')).toBe(false);
    expect(result.writes.find((write) => write.id === 'PVĐ-JSB05__b').data.status).toBe('active');
  });

  it('requires an override before the last session and records it', () => {
    const blocked = plan({ source: { ...source, curriculumCurrentSession: 7 } });
    expect(blocked.ok).toBe(false);
    const allowed = plan({
      source: { ...source, curriculumCurrentSession: 7 },
      override: true,
      overrideReason: 'Lớp cần chuyển trước vì lịch khai giảng.',
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.writes.find((write) => write.collection === 'classProgressions').data.earlyOverride).toBe(true);
    expect(allowed.writes.find((write) => write.collection === 'classProgressions').data.overrideReason).toContain('khai giảng');
  });

  it('blocks the commit while a game or upload session is open', () => {
    expect(plan({ gameOpen: true }).ok).toBe(false);
    expect(plan({ uploadOpen: true }).ok).toBe(false);
  });

  it('keeps the project history fields that a fresh mirror would clear', () => {
    const rich = student('a', 70);
    rich.projectTopic = 'Chủ đề cũ';
    rich.projectProblemSolution = 'Cách giải';
    rich.projectPlannedFeatures = 'Tính năng';
    rich.projectNameSubmission = 'Tên đã nộp';
    rich.projectNameReviewNote = 'Ổn';
    rich.progressStalledCount = 2;
    const result = plan({ students: [rich, student('b', 40)] });
    const snapshot = result.writes.find((write) => write.id === 'PVĐ-JSB05__a' && write.collection === 'classStudentStates');
    expect(snapshot.data).toMatchObject({
      projectTopic: 'Chủ đề cũ',
      projectProblemSolution: 'Cách giải',
      projectPlannedFeatures: 'Tính năng',
      projectNameSubmission: 'Tên đã nộp',
      projectNameReviewNote: 'Ổn',
      progressStalledCount: 2,
    });
    const targetClass = result.writes.find((write) => write.collection === 'classes' && write.id === 'PVĐ-JSB06' && write.step === 'prepare');
    expect(targetClass.data).toMatchObject({ hidden: true, status: 'preparing', curriculumCurrentSession: 0 });
  });

  it('warns when a selected student has no PIN credential and does not invent one', () => {
    const result = plan({ credentialStudentIds: [] });
    expect(result.warnings.join(' ')).toContain('chưa có PIN');
    expect(result.writes.some((write) => write.collection === 'studentCredentials')).toBe(false);
    expect(result.writes.some((write) => write.collection === 'pinResetRequests')).toBe(false);
  });

  it('keeps a mixed-case source code instead of looking up the uppercased id', () => {
    const result = plan({
      source: { ...source, classCode: 'Test' },
      students: [{ ...student('a', 70), classId: 'Test', classCode: 'Test' }],
      targetClassCode: 'test-next',
      confirmCode: 'TEST-NEXT',
      studentAccessCode: '',
    });
    expect(result.ok).toBe(true);
    const sourceWrite = result.writes.find((write) => write.collection === 'classes' && write.id === 'Test');
    expect(sourceWrite.data.status).toBe('completed');
    expect(result.targetClassCode).toBe('test-next');
    expect(result.writes.some((write) => write.id === 'TEST')).toBe(false);
    expect(result.writes.find((write) => write.id === 'Test__a').data.classCode).toBe('Test');
  });

  it('writes the source snapshot when the class code is mixed case', () => {
    const result = plan({
      source: { ...source, classCode: 'Test' },
      students: [{ ...student('a', 70), classId: 'Test', classCode: 'Test' }],
      targetClassCode: 't',
      confirmCode: 't',
      className: 't',
      studentAccessCode: 'T',
    });
    expect(result.ok).toBe(true);
    expect(result.writes.some((write) => write.collection === 'classStudentStates' && write.id === 'Test__a')).toBe(true);
  });

  it('resumes a failed up level for the same target', () => {
    const result = plan({
      targetClassCode: 'PVĐ-JSB06',
      confirmCode: 'PVĐ-JSB06',
      studentAccessCode: 'JSB06',
      existingProgression: {
        state: 'failed',
        targetClassCode: 'PVĐ-JSB06',
        requestHash: 'other-hash',
      },
      targetClass: { classCode: 'PVĐ-JSB06', previousClassCode: 'PVĐ-JSB05', hidden: true, status: 'preparing' },
    });
    expect(result.ok).toBe(true);
    expect(result.writes.find((write) => write.collection === 'classes' && write.id === 'PVĐ-JSB06' && write.step === 'commit').data.status).toBe('active');
  });

  it('blocks a different in-flight payload for the same source', () => {
    const conflict = plan({
      targetClassCode: 'PVĐ-JSB07',
      confirmCode: 'PVĐ-JSB07',
      studentAccessCode: 'JSB07',
      existingProgression: {
        state: 'preparing',
        targetClassCode: 'PVĐ-JSB06',
        requestHash: 'other-hash',
      },
    });
    expect(conflict).toMatchObject({ ok: false, status: 409 });
  });

  it('does not open lesson 1 when the target session is 0', () => {
    const classDoc = { curriculumCurrentSession: 0 };
    const nextProgram = { totalSessionCount: 8, lessons: [{ sessionNumber: 1, title: 'Bài 1' }] };
    expect(buildStudentLessonOptions(classDoc, nextProgram)).toEqual([]);
    expect(defaultLessonKey(classDoc, nextProgram)).toBe('');
    expect(classRoadmapSessions(classDoc, nextProgram).every((session) => session.state === 'locked')).toBe(true);
  });
});
