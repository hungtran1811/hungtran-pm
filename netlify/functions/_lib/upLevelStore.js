import { FieldValue } from 'firebase-admin/firestore';
import { planUpLevel } from '../../../src/lib/upLevel.js';
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

export async function commitUpLevel(db, body) {
  const sourceCode = normalizeClassLookupInput(body.sourceClassCode);
  const targetCode = normalizeClassLookupInput(body.targetClassCode);
  if (!sourceCode) return { ok: false, status: 400, error: 'Không tìm thấy lớp nguồn.' };

  const sourceSnap = await db.collection('classes').doc(sourceCode).get();
  if (!sourceSnap.exists) return { ok: false, status: 404, error: 'Không tìm thấy lớp nguồn.' };
  const source = { id: sourceSnap.id, ...sourceSnap.data(), classCode: sourceSnap.data()?.classCode || sourceSnap.id };

  const progressionRef = db.collection('classProgressions').doc(`uplevel_${source.classCode}`);
  const progressionSnap = await progressionRef.get();
  const existingProgression = progressionSnap.exists ? progressionSnap.data() : null;
  if (existingProgression?.state === 'committed' && existingProgression.targetClassCode) {
    return { ok: true, body: { targetClassCode: existingProgression.targetClassCode, already: true } };
  }

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
    actor: body.email || '',
    existingProgression,
    targetClass: targetSnap.exists ? { id: targetSnap.id, ...targetSnap.data() } : null,
    targetHasReports: !targetReports.empty,
    gameOpen: Boolean(source.activeSpySessionId || source.activeShowdownSessionId),
    uploadOpen,
  });
  if (!plan.ok) return { ok: false, status: 400, error: plan.error };
  if (plan.already) return { ok: true, body: { targetClassCode: plan.targetClassCode, already: true } };

  try {
    await applyGroup(db, plan.writes.filter((write) => write.step === 'prepare'));
    await applyGroup(db, plan.writes.filter((write) => write.step === 'commit'));
  } catch (error) {
    await progressionRef.set(
      {
        state: existingProgression?.state === 'committed' ? 'committed' : 'failed',
        sourceClassCode: source.classCode,
        targetClassCode: plan.targetClassCode,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    throw error;
  }

  return {
    ok: true,
    body: { targetClassCode: plan.targetClassCode, already: false, studentCount: plan.studentCount },
  };
}
