export function enrollmentDocId(classCode, studentId) {
  return `${classCode}__${studentId}`;
}

export async function assertWritableEnrollment(db, classCode, studentId) {
  if (!classCode || !studentId) return { ok: true, mode: 'legacy' };
  const snap = await db.collection('classEnrollments').doc(enrollmentDocId(classCode, studentId)).get();
  if (!snap.exists) return { ok: true, mode: 'legacy' };
  if (snap.data()?.status === 'active') return { ok: true, mode: 'active' };
  return { ok: false, status: 403, error: 'Học sinh không thuộc lớp này.' };
}
