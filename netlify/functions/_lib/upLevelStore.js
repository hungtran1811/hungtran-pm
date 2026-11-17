import { FieldValue } from 'firebase-admin/firestore';
import { planUpLevel, progressionId } from '../../../src/lib/upLevel.js';
import { normalizeClassLookupInput } from '../../../src/lib/classAccessCode.js';

function plainStudent(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    ...data,
    classId: data.classId || data.classCode || '',
    classCode: data.classCode || data.classId || '',
  };
}

async function applyGroup(db, writes) {
  const pending = [];
  for (const write of writes) {
    const ref = db.collection(write.collection).doc(write.id);
    const snap = await ref.get();
    if (write.once && snap.exists) continue;
    if (write.kind === 'mirror' && snap.data()?.classId === write.data.classId) continue;
    const data = { ...write.data, updatedAt: FieldValue.serverTimestamp() };
    if (!snap.exists) data.createdAt = FieldValue.serverTimestamp();
    pending.push({ ref, data });
  }
  for (let index = 0; index < pending.length; index += 400) {
    const batch = db.batch();
    for (const item of pending.slice(index, index + 400)) {
      batch.set(item.ref, item.data, { merge: true });
    }
    await batch.commit();
  }
}

async function acquireLock(db, { operationId, sourceCode, targetCode, requestHash }) {
  const ref = db.collection('classProgressions').doc(operationId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists ? snap.data() : null;
    if (existing?.state === 'committed') {
      const sameTarget = normalizeClassLookupInput(existing.targetClassCode) === targetCode;
      const sameHash = !existing.requestHash || existing.requestHash === requestHash;
      if (sameTarget && sameHash) {
        return { ok: true, already: true, targetClassCode: existing.targetClassCode, operationId };
      }
      return { ok: false, status: 409, error: 'Lớp nguồn đã có một chuyển cấp khác.' };
    }
    if (existing?.requestHash && existing.requestHash !== requestHash && existing.state !== 'rolled_back') {
      return { ok: false, status: 409, error: 'Đang có một Up Level khác cho lớp này.' };
    }
    tx.set(ref, {
      operationId,
      state: 'preparing',
      sourceClassCode: sourceCode,
      targetClassCode: targetCode,
      requestHash,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ok: true, already: false, operationId };
  });
}

async function verifyPrepared(db, plan) {
  const target = plan.targetClassCode;
  const classSnap = await db.collection('classes').doc(target).get();
  if (!classSnap.exists || classSnap.data()?.hidden !== true) return false;
  const selectedIds = plan.writes
    .filter((write) => write.collection === 'classEnrollments' && write.data?.classCode === target && write.data?.status === 'active')
    .map((write) => write.data.studentId);
  for (const studentId of selectedIds) {
    const enrollment = await db.collection('classEnrollments').doc(`${target}__${studentId}`).get();
    const state = await db.collection('classStudentStates').doc(`${target}__${studentId}`).get();
    if (!enrollment.exists || enrollment.data()?.status !== 'active') return false;
    if (!state.exists || Number(state.data()?.currentProgressPercent) !== 0) return false;
    const sourceState = await db.collection('classStudentStates').doc(`${plan.sourceClassCode || ''}__${studentId}`).get();
    if (!sourceState.exists) return false;
  }
  return selectedIds.length > 0;
}

function previewBody(plan, aliasStatus) {
  return {
    operationId: plan.operationId,
    requestHash: plan.requestHash,
    eligible: true,
    dryRun: true,
    warnings: plan.warnings || [],
    blockingErrors: [],
    sourceClassCode: plan.writes.find((write) => write.collection === 'classes' && write.step === 'commit' && write.data?.status === 'completed')?.id || '',
    targetClassCode: plan.targetClassCode,
    movedCount: plan.studentCount,
    skippedCount: plan.skippedCount || 0,
    pinStatusCounts: plan.pinStatusCounts,
    aliasStatus,
    historySnapshotCount: plan.writes.filter((write) => write.collection === 'classStudentStates' && write.id.startsWith(`${plan.writes.find((item) => item.collection === 'classes' && item.step === 'commit')?.id || ''}__`)).length,
  };
}

export async function readUpLevelStatus(db, { sourceClassCode, operationId }) {
  const sourceCode = normalizeClassLookupInput(sourceClassCode);
  const id = operationId || (sourceCode ? progressionId(sourceCode) : '');
  if (!id) return { ok: false, status: 400, error: 'Thiếu mã thao tác.' };
  const snap = await db.collection('classProgressions').doc(id).get();
  if (!snap.exists) return { ok: false, status: 404, error: 'Chưa có Up Level cho lớp này.' };
  const data = snap.data() || {};
  const targetSnap = data.targetClassCode
    ? await db.collection('classes').doc(data.targetClassCode).get()
    : null;
  const published = targetSnap?.exists && targetSnap.data()?.hidden === false && targetSnap.data()?.status === 'active';
  return {
    ok: true,
    body: {
      operationId: id,
      state: data.state || '',
      sourceClassCode: data.sourceClassCode || '',
      targetClassCode: data.targetClassCode || '',
      requestHash: data.requestHash || '',
      safeToResume: data.state === 'failed' || data.state === 'preparing' || data.state === 'prepared',
      published,
      failureReason: data.failureReason || '',
    },
  };
}

export async function rollbackUpLevel(db, { sourceClassCode, operationId }) {
  const sourceCode = normalizeClassLookupInput(sourceClassCode);
  const id = operationId || (sourceCode ? progressionId(sourceCode) : '');
  const ref = db.collection('classProgressions').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, status: 404, error: 'Chưa có Up Level để hoàn tác.' };
  const data = snap.data() || {};
  if (data.state === 'committed') {
    return { ok: false, status: 409, error: 'Lớp mới đã công bố. Không tự xóa dữ liệu đã phát sinh.' };
  }
  const target = normalizeClassLookupInput(data.targetClassCode);
  const targetSnap = target ? await db.collection('classes').doc(target).get() : null;
  if (targetSnap?.exists && targetSnap.data()?.hidden === false) {
    return { ok: false, status: 409, error: 'Lớp mới đã công bố. Không tự xóa dữ liệu đã phát sinh.' };
  }
  const reports = target
    ? await db.collection('reports').where('classCode', '==', target).limit(1).get()
    : { empty: true };
  if (!reports.empty) {
    return { ok: false, status: 409, error: 'Lớp mới đã có báo cáo. Không tự hoàn tác.' };
  }
  const studentIds = Array.isArray(data.studentIds) ? data.studentIds : [];
  const batch = db.batch();
  if (targetSnap?.exists) batch.delete(targetSnap.ref);
  for (const studentId of studentIds) {
    batch.delete(db.collection('classEnrollments').doc(`${target}__${studentId}`));
    batch.delete(db.collection('classStudentStates').doc(`${target}__${studentId}`));
    const sourceEnrollment = db.collection('classEnrollments').doc(`${data.sourceClassCode}__${studentId}`);
    batch.set(sourceEnrollment, {
      classCode: data.sourceClassCode,
      studentId,
      status: 'active',
      targetClassCode: '',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  batch.set(ref, {
    state: 'rolled_back',
    failureReason: '',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  return { ok: true, body: { operationId: id, state: 'rolled_back', targetClassCode: target } };
}

export async function commitUpLevel(db, body, options = {}) {
  if (body?.action === 'status') return readUpLevelStatus(db, body);
  if (body?.action === 'rollback') return rollbackUpLevel(db, body);

  const sourceCode = normalizeClassLookupInput(body.sourceClassCode);
  const targetCode = normalizeClassLookupInput(body.targetClassCode);
  if (!sourceCode) return { ok: false, status: 400, error: 'Không tìm thấy lớp nguồn.' };

  const sourceSnap = await db.collection('classes').doc(sourceCode).get();
  if (!sourceSnap.exists) return { ok: false, status: 404, error: 'Không tìm thấy lớp nguồn.' };
  const source = { id: sourceSnap.id, ...sourceSnap.data(), classCode: sourceSnap.data()?.classCode || sourceSnap.id };

  const operationId = progressionId(source.classCode);
  const progressionRef = db.collection('classProgressions').doc(operationId);
  const progressionSnap = await progressionRef.get();
  const existingProgression = progressionSnap.exists ? progressionSnap.data() : null;

  const targetProgramId = String(body.programId || '').trim();
  const sourceProgramId = String(source.curriculumProgramId || '').trim();
  const [programSnap, sourceProgramSnap, targetSnap, studentSnap, uploadSnap] = await Promise.all([
    targetProgramId ? db.collection('curriculumPrograms').doc(targetProgramId).get() : Promise.resolve({ exists: false }),
    sourceProgramId ? db.collection('curriculumPrograms').doc(sourceProgramId).get() : Promise.resolve({ exists: false }),
    targetCode ? db.collection('classes').doc(targetCode).get() : Promise.resolve({ exists: false }),
    db.collection('students').where('classId', '==', source.classCode).where('active', '==', true).get(),
    db.collection('submissionUploadSessions').where('classCode', '==', source.classCode).limit(20).get(),
  ]);

  const knownIds = new Set(studentSnap.docs.map((doc) => doc.id));
  const extraIds = [...(existingProgression?.studentIds || []), ...(Array.isArray(body.selectedIds) ? body.selectedIds : [])]
    .filter((id) => id && !knownIds.has(id));
  const extraSnaps = extraIds.length
    ? await db.getAll(...extraIds.map((id) => db.collection('students').doc(id)))
    : [];
  const students = [...studentSnap.docs, ...extraSnaps.filter((snap) => snap.exists)].map(plainStudent);
  const now = Date.now();
  const uploadOpen = uploadSnap.docs.some((doc) => (doc.data()?.expiresAt?.toMillis?.() || 0) > now);
  const targetReports = targetSnap.exists
    ? await db.collection('reports').where('classCode', '==', targetCode).limit(1).get()
    : { empty: true };
  const selectedIds = Array.isArray(body.selectedIds) ? body.selectedIds.filter(Boolean) : [];
  const credentialSnaps = selectedIds.length
    ? await db.getAll(...selectedIds.map((id) => db.collection('studentCredentials').doc(id)))
    : [];
  const credentialStudentIds = credentialSnaps.filter((snap) => snap.exists).map((snap) => snap.id);
  const access = normalizeClassLookupInput(body.studentAccessCode);
  const aliasSnap = access
    ? await db.collection('classes').where('studentAccessCode', '==', access).get()
    : { docs: [] };
  const aliasConflicts = aliasSnap.docs.filter((doc) => {
    const data = doc.data() || {};
    return data.status === 'active' && data.hidden !== true && normalizeClassLookupInput(data.classCode || doc.id) !== targetCode;
  });

  const plan = planUpLevel({
    source,
    students,
    program: programSnap.exists ? { id: programSnap.id, ...programSnap.data() } : null,
    sessionTotal: sourceProgramSnap.exists ? sourceProgramSnap.data()?.totalSessionCount : 0,
    targetClassCode: targetCode,
    className: body.className,
    studentAccessCode: body.studentAccessCode,
    selectedIds: body.selectedIds,
    confirmCode: body.confirmCode,
    override: body.override === true,
    overrideReason: body.overrideReason,
    actor: body.email || '',
    existingProgression,
    targetClass: targetSnap.exists ? { id: targetSnap.id, ...targetSnap.data() } : null,
    targetHasReports: !targetReports.empty,
    gameOpen: Boolean(source.activeSpySessionId || source.activeShowdownSessionId),
    uploadOpen,
    credentialStudentIds,
  });
  if (!plan.ok) return { ok: false, status: plan.status || 400, error: plan.error };
  if (plan.already) {
    return {
      ok: true,
      body: {
        operationId,
        targetClassCode: plan.targetClassCode,
        already: true,
        alreadyCommitted: true,
        studentCount: plan.studentCount,
      },
    };
  }
  if (body.dryRun === true) {
    return { ok: true, body: { ...previewBody({ ...plan, sourceClassCode: source.classCode }, aliasConflicts.length ? 'ambiguous' : 'unique'), sourceClassCode: source.classCode } };
  }

  const lock = await acquireLock(db, {
    operationId,
    sourceCode: source.classCode,
    targetCode: plan.targetClassCode,
    requestHash: plan.requestHash,
  });
  if (!lock.ok) return lock;
  if (lock.already) {
    return { ok: true, body: { operationId, targetClassCode: lock.targetClassCode, already: true, alreadyCommitted: true } };
  }

  try {
    await applyGroup(db, plan.writes.filter((write) => write.step === 'prepare'));
    await progressionRef.set({
      state: 'prepared',
      studentIds: plan.writes.find((write) => write.collection === 'classProgressions')?.data.studentIds || [],
      checkpoints: { prepared: true },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    if (options.failAfter === 'prepare') {
      const error = new Error('injected prepare failure');
      error.code = 'UPLEVEL_INJECTED';
      throw error;
    }
    const ready = await verifyPrepared(db, { ...plan, sourceClassCode: source.classCode });
    if (!ready) {
      await progressionRef.set({
        state: 'failed',
        failureReason: 'verify',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return {
        ok: false,
        status: 409,
        error: 'Chưa đủ dữ liệu lớp mới để công bố. Có thể chạy lại cùng thao tác.',
        body: { operationId, safeToResume: true, targetClassCode: plan.targetClassCode },
      };
    }
    await applyGroup(db, plan.writes.filter((write) => write.step === 'commit'));
  } catch (error) {
    await progressionRef.set({
      state: existingProgression?.state === 'committed' ? 'committed' : 'failed',
      sourceClassCode: source.classCode,
      targetClassCode: plan.targetClassCode,
      failureReason: String(error.message || 'failed').slice(0, 200),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    if (error.code === 'UPLEVEL_INJECTED') {
      return {
        ok: false,
        status: 500,
        error: 'Up Level dừng trước khi công bố lớp mới.',
        body: { operationId, safeToResume: true, targetClassCode: plan.targetClassCode },
      };
    }
    throw error;
  }

  return {
    ok: true,
    body: {
      operationId,
      targetClassCode: plan.targetClassCode,
      already: false,
      studentCount: plan.studentCount,
      skippedCount: plan.skippedCount,
      warnings: plan.warnings,
    },
  };
}
