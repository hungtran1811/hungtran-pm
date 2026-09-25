import { getAdminDb } from './_lib/firebaseAdmin.js';
import { clientIp, json, parseJsonBody, preflight } from './_lib/http.js';
import { checkRateLimit, DRIVE_LIMITS } from './_lib/rateLimit.js';
import {
  loadActiveStudent,
  loadOpenClass,
  namesMatch,
  studentBelongsToClass,
  validateStudentIdentityInput,
} from './_lib/submissionValidate.js';
import { toStudentSubmissionNotes } from '../../src/lib/submissionStudentNotes.js';
import { functionErrorCode, logFunctionError } from './_lib/functionLog.js';

export async function handler(event) {
  const early = preflight(event);
  if (early) return early;

  if (!checkRateLimit(`list:ip:${clientIp(event)}`, { max: DRIVE_LIMITS.list.ip })) {
    return json(429, { error: 'Bạn thao tác quá nhanh. Thử lại sau vài phút.' });
  }

  let body;
  try {
    body = parseJsonBody(event);
  } catch {
    return json(400, { error: 'Dữ liệu gửi lên không hợp lệ.' });
  }

  const input = validateStudentIdentityInput(body);
  if (!input.ok) return json(400, { error: input.error });
  if (
    input.studentId &&
    !checkRateLimit(`list:student:${input.studentId}`, { max: DRIVE_LIMITS.list.student })
  ) {
    return json(429, { error: 'Bạn thao tác quá nhanh. Thử lại sau vài phút.' });
  }

  try {
    const db = getAdminDb();
    const classDoc = await loadOpenClass(db, input.classCode);
    if (!classDoc) {
      return json(404, { error: 'Không tìm thấy lớp.' });
    }

    const student = await loadActiveStudent(db, input.studentId);
    if (!student?.active) {
      return json(403, { error: 'Không tìm thấy học sinh trong lớp.' });
    }
    if (!studentBelongsToClass(student, classDoc.classCode, classDoc.id)) {
      return json(403, { error: 'Học sinh không thuộc lớp này.' });
    }
    if (!namesMatch(input.studentName, student.fullName)) {
      return json(403, { error: 'Tên học sinh không khớp danh sách lớp.' });
    }

    const snap = await db
      .collection('submissions')
      .where('classCode', '==', classDoc.classCode)
      .where('studentId', '==', student.id)
      .get();

    const submissions = toStudentSubmissionNotes(
      snap.docs.map((doc) => {
        const data = doc.data() || {};
        return {
          lessonKey: data.lessonKey,
          originalFileName: data.originalFileName,
          storedFileName: data.storedFileName,
          submittedAt: data.submittedAt?.toDate?.() || data.submittedAt,
          attempt: data.attempt,
          isLatest: data.isLatest,
        };
      }),
    );

    return json(200, { submissions });
  } catch (error) {
    const code = functionErrorCode(error);
    logFunctionError('drive-list-my-submissions', code, error);
    if (code === 'CONFIG_MISSING') {
      return json(503, { error: 'Chức năng nộp bài chưa được cấu hình.' });
    }
    return json(502, { error: 'Không tải được bài đã nộp.' });
  }
}
