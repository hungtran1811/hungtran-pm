export function enrollmentDocId(classCode, studentId) {
  return `${classCode}__${studentId}`;
}

function closedClass(classStatus) {
  return classStatus === 'completed' || classStatus === 'archived';
}

export async function assertReadableEnrollment(db, classCode, studentId) {
  if (!classCode || !studentId) return { ok: true, mode: 'legacy' };
  const snap = await db.collection('classEnrollments').doc(enrollmentDocId(classCode, studentId)).get();
  if (!snap.exists) return { ok: true, mode: 'legacy' };
  const status = snap.data()?.status;
  if (status === 'active' || status === 'completed') return { ok: true, mode: status };
  return { ok: false, status: 403, error: 'Học sinh không thuộc lớp này.' };
}

export async function assertWritableEnrollment(db, classCode, studentId, classStatus = '') {
  if (!classCode || !studentId) return { ok: true, mode: 'legacy' };
  if (closedClass(classStatus)) {
    return { ok: false, status: 403, error: 'Lớp này chỉ còn để xem lịch sử.' };
  }
  const snap = await db.collection('classEnrollments').doc(enrollmentDocId(classCode, studentId)).get();
  if (!snap.exists) return { ok: true, mode: 'legacy' };
  if (snap.data()?.status === 'active') return { ok: true, mode: 'active' };
  return { ok: false, status: 403, error: 'Học sinh không thuộc lớp này.' };
}
