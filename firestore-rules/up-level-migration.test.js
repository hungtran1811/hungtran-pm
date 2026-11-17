import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { beforeAll, describe, expect, it } from 'vitest';
import { commitUpLevel, rollbackUpLevel } from '../netlify/functions/_lib/upLevelStore.js';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Refusing Up Level migration tests outside the Firestore emulator.');
}

const app = getApps().find((item) => item.name === 'up-level-emulator')
  || initializeApp({ projectId: 'demo-hungtran-pm-rules' }, 'up-level-emulator');
const db = getFirestore(app);

async function seedLevel({
  source,
  students,
  session = 14,
  programId = 'web-basic',
  total = 14,
}) {
  await db.collection('curriculumPrograms').doc(programId).set({ id: programId, totalSessionCount: total, active: true });
  await db.collection('curriculumPrograms').doc('web-next').set({ id: 'web-next', totalSessionCount: total, active: true, finalMode: 'project' });
  await db.collection('classes').doc(source).set({
    classCode: source,
    className: source,
    status: 'active',
    hidden: false,
    pinRequired: true,
    curriculumProgramId: programId,
    curriculumCurrentSession: session,
    curriculumPhase: 'learning',
    studentCount: students.length,
  });
  for (const student of students) {
    await db.collection('students').doc(student.id).set({
      fullName: student.name,
      active: true,
      classId: source,
      classCode: source,
      currentClassCode: source,
      currentProgressPercent: student.progress ?? 40,
      projectName: student.projectName || '',
      projectTopic: student.projectTopic || '',
      projectProblemSolution: student.solution || '',
      projectPlannedFeatures: student.features || '',
      latestReportId: student.reportId || '',
      openedLessonIds: student.openedLessonIds || [],
    });
  }
}

function request(source, target, ids) {
  return {
    sourceClassCode: source,
    targetClassCode: target,
    confirmCode: target,
    className: `Lớp ${target}`,
    programId: 'web-next',
    studentAccessCode: target,
    selectedIds: ids,
    email: 'teacher@example.com',
  };
}

describe('Up Level emulator migration', () => {
  beforeAll(() => {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      throw new Error('Firestore emulator is required.');
    }
  });

  it('moves one student, keeps the PIN, and leaves the excluded student on the source', async () => {
    await seedLevel({
      source: 'SRC01',
      students: [
        { id: 'stu-a', name: 'Học sinh A', progress: 80, projectName: 'Game cũ', projectTopic: 'Chủ đề', solution: 'Cách', features: 'Tính năng', reportId: 'rep-a', openedLessonIds: ['L14'] },
        { id: 'stu-b', name: 'Học sinh B', progress: 20, projectName: 'Ở lại' },
      ],
    });
    await db.collection('studentCredentials').doc('stu-a').set({
      salt: 'salt-a',
      hash: 'hash-a',
      scryptN: 4096,
      credentialVersion: 3,
      failedCount: 0,
      locked: false,
    });
    await db.collection('pinResetRequests').doc('reset-a').set({
      studentId: 'stu-a',
      classCode: 'SRC01',
      status: 'pending',
    });
    await db.collection('reports').doc('rep-a').set({
      classCode: 'SRC01',
      classId: 'SRC01',
      studentId: 'stu-a',
      studentName: 'Học sinh A',
      projectName: 'Game cũ',
    });

    const first = await commitUpLevel(db, request('SRC01', 'DST01', ['stu-a']));
    expect(first.ok).toBe(true);
    expect(first.body.already).toBe(false);

    const target = await db.collection('classes').doc('DST01').get();
    const source = await db.collection('classes').doc('SRC01').get();
    const student = await db.collection('students').doc('stu-a').get();
    const credential = await db.collection('studentCredentials').doc('stu-a').get();
    const sourceState = await db.collection('classStudentStates').doc('SRC01__stu-a').get();
    const targetState = await db.collection('classStudentStates').doc('DST01__stu-a').get();
    const targetEnrollmentB = await db.collection('classEnrollments').doc('DST01__stu-b').get();
    const reset = await db.collection('pinResetRequests').doc('reset-a').get();
    const report = await db.collection('reports').doc('rep-a').get();

    expect(target.data()).toMatchObject({ status: 'active', hidden: false, curriculumCurrentSession: 0, previousClassCode: 'SRC01' });
    expect(source.data()).toMatchObject({ status: 'completed', nextClassCode: 'DST01' });
    expect(student.data()).toMatchObject({ classId: 'DST01', currentProgressPercent: 0, projectName: '', currentClassCode: 'DST01' });
    expect(student.id).toBe('stu-a');
    expect(credential.data()).toMatchObject({ hash: 'hash-a', credentialVersion: 3 });
    expect(credential.data().pinCipher).toBeUndefined();
    expect(sourceState.data()).toMatchObject({ projectName: 'Game cũ', projectTopic: 'Chủ đề', currentProgressPercent: 80 });
    expect(targetState.data()).toMatchObject({ currentProgressPercent: 0, projectName: '', openedLessonIds: [] });
    expect(targetEnrollmentB.exists).toBe(false);
    expect(reset.data().status).toBe('pending');
    expect(reset.data().classCode).toBe('SRC01');
    expect(report.data().classCode).toBe('SRC01');

    const again = await commitUpLevel(db, request('SRC01', 'DST01', ['stu-a']));
    expect(again.body.already).toBe(true);
    const conflict = await commitUpLevel(db, request('SRC01', 'DST99', ['stu-a']));
    expect(conflict).toMatchObject({ ok: false, status: 409 });
    expect((await db.collection('classes').doc('DST99').get()).exists).toBe(false);
  });

  it('keeps the target hidden when prepare fails and resumes the same operation', async () => {
    await seedLevel({
      source: 'SRC02',
      students: [{ id: 'stu-c', name: 'Học sinh C', progress: 50, projectName: 'Đồ án', projectTopic: 'Giữ lại' }],
    });
    await db.collection('studentCredentials').doc('stu-c').set({ salt: 's', hash: 'hash-c', scryptN: 4096, credentialVersion: 1 });
    const failed = await commitUpLevel(db, request('SRC02', 'DST02', ['stu-c']), { failAfter: 'prepare' });
    expect(failed.ok).toBe(false);
    expect(failed.body.safeToResume).toBe(true);
    const hidden = await db.collection('classes').doc('DST02').get();
    expect(hidden.data()).toMatchObject({ hidden: true, status: 'preparing' });
    expect((await db.collection('students').doc('stu-c').get()).data().classId).toBe('SRC02');
    expect((await db.collection('classStudentStates').doc('SRC02__stu-c').get()).data().projectTopic).toBe('Giữ lại');

    const resumed = await commitUpLevel(db, request('SRC02', 'DST02', ['stu-c']));
    expect(resumed.ok).toBe(true);
    expect((await db.collection('classes').doc('DST02').get()).data()).toMatchObject({ hidden: false, status: 'active' });
    expect((await db.collection('students').doc('stu-c').get()).data().classId).toBe('DST02');
    expect((await db.collection('studentCredentials').doc('stu-c').get()).data().hash).toBe('hash-c');
  });

  it('rolls a staged class back without deleting the source snapshot', async () => {
    await seedLevel({
      source: 'SRC03',
      students: [{ id: 'stu-d', name: 'Học sinh D', projectTopic: 'Snapshot' }],
    });
    await commitUpLevel(db, request('SRC03', 'DST03', ['stu-d']), { failAfter: 'prepare' });
    const rolled = await rollbackUpLevel(db, { sourceClassCode: 'SRC03' });
    expect(rolled.body.state).toBe('rolled_back');
    expect((await db.collection('classes').doc('DST03').get()).exists).toBe(false);
    expect((await db.collection('classStudentStates').doc('SRC03__stu-d').get()).data().projectTopic).toBe('Snapshot');
    expect((await db.collection('students').doc('stu-d').get()).data().classId).toBe('SRC03');
  });

  it('accepts only one of two different targets', async () => {
    await seedLevel({
      source: 'SRC04',
      students: [{ id: 'stu-e', name: 'Học sinh E' }],
    });
    const [left, right] = await Promise.all([
      commitUpLevel(db, request('SRC04', 'DST04A', ['stu-e'])),
      commitUpLevel(db, request('SRC04', 'DST04B', ['stu-e'])),
    ]);
    const results = [left, right];
    expect(results.filter((item) => item.ok).length).toBe(1);
    expect(results.filter((item) => item.status === 409).length).toBe(1);
    const visible = [];
    for (const code of ['DST04A', 'DST04B']) {
      const snap = await db.collection('classes').doc(code).get();
      if (snap.exists && snap.data().hidden === false) visible.push(code);
    }
    expect(visible).toHaveLength(1);
  });

  it('keeps one student and one PIN across two level moves', async () => {
    await seedLevel({
      source: 'LVL-A',
      students: [{ id: 'stu-chain', name: 'Học sinh chuỗi', projectName: 'Cấp một', projectTopic: 'A' }],
    });
    await db.collection('studentCredentials').doc('stu-chain').set({ salt: 'chain', hash: 'hash-chain', scryptN: 4096, credentialVersion: 2 });
    await db.collection('reports').doc('rep-chain-a').set({ classCode: 'LVL-A', classId: 'LVL-A', studentId: 'stu-chain' });
    expect((await commitUpLevel(db, request('LVL-A', 'LVL-B', ['stu-chain']))).ok).toBe(true);
    await db.collection('reports').doc('rep-chain-b').set({ classCode: 'LVL-B', classId: 'LVL-B', studentId: 'stu-chain' });
    await db.collection('classes').doc('LVL-B').update({ curriculumCurrentSession: 14, curriculumProgramId: 'web-next' });
    expect((await commitUpLevel(db, request('LVL-B', 'LVL-C', ['stu-chain']))).ok).toBe(true);
    const student = await db.collection('students').doc('stu-chain').get();
    const credential = await db.collection('studentCredentials').doc('stu-chain').get();
    expect(student.data().classId).toBe('LVL-C');
    expect(credential.data()).toMatchObject({ hash: 'hash-chain', credentialVersion: 2 });
    expect((await db.collection('classStudentStates').doc('LVL-A__stu-chain').get()).data().projectTopic).toBe('A');
    expect((await db.collection('reports').doc('rep-chain-a').get()).data().classCode).toBe('LVL-A');
    expect((await db.collection('reports').doc('rep-chain-b').get()).data().classCode).toBe('LVL-B');
    expect((await db.collection('classes').doc('LVL-C').get()).data().curriculumCurrentSession).toBe(0);
  });
});
