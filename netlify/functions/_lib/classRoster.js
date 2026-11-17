import { normalizeClassLookupInput } from '../../../src/lib/classAccessCode.js';
import { preserveClassCode } from '../../../src/lib/upLevel.js';

const OPEN_HISTORY = new Set(['active', 'completed', 'archived']);

async function loadClass(db, raw) {
  const exact = preserveClassCode(raw);
  const folded = normalizeClassLookupInput(exact);
  if (!folded) return null;
  const direct = await db.collection('classes').doc(exact).get();
  if (direct.exists) return direct;
  if (folded !== exact) {
    const upper = await db.collection('classes').doc(folded).get();
    if (upper.exists) return upper;
  }
  const all = await db.collection('classes').get();
  return all.docs.find((doc) => {
    const data = doc.data() || {};
    return normalizeClassLookupInput(doc.id) === folded
      || normalizeClassLookupInput(data.classCode) === folded;
  }) || null;
}

export async function listPublicRoster(db, classCode) {
  if (!normalizeClassLookupInput(classCode)) {
    return { ok: false, status: 400, error: 'Hãy nhập mã lớp đầy đủ.' };
  }
  const classSnap = await loadClass(db, classCode);
  if (!classSnap) return { ok: false, status: 404, error: 'Không tìm thấy lớp.' };
  const data = classSnap.data() || {};
  const code = data.classCode || classSnap.id;
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
