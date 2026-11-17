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

  it('returns the same target when the source was already committed', () => {
    const again = plan({
      targetClassCode: 'PVĐ-OTHER',
      confirmCode: 'PVĐ-OTHER',
      existingProgression: { state: 'committed', targetClassCode: 'PVĐ-JSB06', studentIds: ['a'] },
    });
    expect(again).toMatchObject({ ok: true, already: true, targetClassCode: 'PVĐ-JSB06', writes: [] });
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
    const allowed = plan({ source: { ...source, curriculumCurrentSession: 7 }, override: true });
    expect(allowed.ok).toBe(true);
    expect(allowed.writes.find((write) => write.collection === 'classProgressions').data.earlyOverride).toBe(true);
  });

  it('blocks the commit while a game or upload session is open', () => {
    expect(plan({ gameOpen: true }).ok).toBe(false);
    expect(plan({ uploadOpen: true }).ok).toBe(false);
  });

  it('does not open lesson 1 when the target session is 0', () => {
    const classDoc = { curriculumCurrentSession: 0 };
    const nextProgram = { totalSessionCount: 8, lessons: [{ sessionNumber: 1, title: 'Bài 1' }] };
    expect(buildStudentLessonOptions(classDoc, nextProgram)).toEqual([]);
    expect(defaultLessonKey(classDoc, nextProgram)).toBe('');
    expect(classRoadmapSessions(classDoc, nextProgram).every((session) => session.state === 'locked')).toBe(true);
  });
});
