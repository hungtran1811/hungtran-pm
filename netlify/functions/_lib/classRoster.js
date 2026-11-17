import { normalizeClassLookupInput } from '../../../src/lib/classAccessCode.js';

const OPEN_HISTORY = new Set(['active', 'completed', 'archived']);

export async function listPublicRoster(db, classCode) {
  const code = normalizeClassLookupInput(classCode);
  if (!code) return { ok: false, status: 400, error: 'Hãy nhập mã lớp đầy đủ.' };
  const classSnap = await db.collection('classes').doc(code).get();
  if (!classSnap.exists) return { ok: false, status: 404, error: 'Không tìm thấy lớp.' };
  const data = classSnap.data() || {};
  if (data.hidden === true || !OPEN_HISTORY.has(data.status)) {
    return { ok: false, status: 403, error: 'Lớp này không mở.' };
  }

  const enrollmentSnap = await db.collection('classEnrollments').where('classCode', '==', code).get();
  const enrolled = enrollmentSnap.docs
    .map((doc) => doc.data())
    .filter((row) => row.status === 'active' || row.status === 'completed');
  let students;
  if (enrolled.length) {
    const snaps = await db.getAll(...enrolled.map((row) => db.collection('students').doc(row.studentId)));
    students = snaps
      .filter((snap) => snap.exists && snap.data()?.active !== false)
      .map((snap) => ({
        id: snap.id,
        fullName: String(snap.data()?.fullName || '').trim(),
        active: snap.data()?.active !== false,
      }));
  } else {
    const fallback = await db.collection('students').where('classId', '==', code).where('active', '==', true).get();
    students = fallback.docs.map((snap) => ({
      id: snap.id,
      fullName: String(snap.data()?.fullName || '').trim(),
      active: true,
    }));
  }
  students.sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
  return { ok: true, body: { classCode: code, students } };
}
