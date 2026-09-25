import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from './_lib/firebaseAdmin.js';
import { createResumableUpload, findOrCreateSubmissionFolder } from './_lib/driveFolders.js';
import { clientIp, json, parseJsonBody, preflight, requestOrigin } from './_lib/http.js';
import { checkRateLimit, DRIVE_LIMITS } from './_lib/rateLimit.js';
import {
  UPLOAD_SESSION_TTL_MS,
  buildStoredFileName,
  buildSubmissionDrivePath,
  isOpenClass,
  loadActiveStudent,
  loadOpenClass,
  namesMatch,
  studentBelongsToClass,
  validateCreateSessionInput,
} from './_lib/submissionValidate.js';
import { isLessonKeyOpenForClass } from '../../src/lib/sessionScope.js';
import { functionErrorCode, logFunctionError } from './_lib/functionLog.js';

export async function handler(event) {
  const early = preflight(event);
  if (early) return early;

  if (!checkRateLimit(`create:ip:${clientIp(event)}`, { max: DRIVE_LIMITS.create.ip })) {
    return json(429, { error: 'Bạn thao tác quá nhanh. Thử lại sau vài phút.' });
  }

  let body;
  try {
    body = parseJsonBody(event);
  } catch {
    return json(400, { error: 'Dữ liệu gửi lên không hợp lệ.' });
  }

  const input = validateCreateSessionInput(body);
  if (!input.ok) return json(400, { error: input.error });
  if (
    input.studentId &&
    !checkRateLimit(`create:student:${input.studentId}`, { max: DRIVE_LIMITS.create.student })
  ) {
    return json(429, { error: 'Bạn thao tác quá nhanh. Thử lại sau vài phút.' });
  }

  try {
    const db = getAdminDb();
    const classDoc = await loadOpenClass(db, input.classCode);
    if (!classDoc || !isOpenClass(classDoc)) {
      return json(403, { error: 'Lớp này hiện không mở nộp bài.' });
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
    if (!isLessonKeyOpenForClass(input.lessonKey, classDoc)) {
      return json(403, { error: 'Buổi này chưa mở nộp bài cho lớp.' });
    }

    const storedFileName = buildStoredFileName({
      classCode: classDoc.classCode,
      studentName: student.fullName,
      lessonKey: input.lessonKey,
      originalFileName: input.fileName,
    });
    const drivePath = buildSubmissionDrivePath({
      classCode: classDoc.classCode,
      studentName: student.fullName,
      lessonKey: input.lessonKey,
    });

    const { classFolderId, lessonFolderId } = await findOrCreateSubmissionFolder({
      classCode: classDoc.classCode,
      cachedClassFolderId: classDoc.driveFolderId,
      studentFolderName: drivePath.studentFolderName,
      lessonFolderName: drivePath.lessonFolderName,
    });
    if (classFolderId && classFolderId !== classDoc.driveFolderId) {
      await db.collection('classes').doc(classDoc.id).set(
        { driveFolderId: classFolderId, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    }

    const uploadUrl = await createResumableUpload({
      storedFileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      folderId: lessonFolderId,
      origin: requestOrigin(event),
    });

    const uploadToken = randomUUID();
    const now = Date.now();
    await db.collection('submissionUploadSessions').doc(uploadToken).set({
      classCode: classDoc.classCode,
      classId: classDoc.id,
      studentId: student.id,
      studentName: student.fullName,
      lessonKey: input.lessonKey,
      originalFileName: input.fileName,
      storedFileName,
      fileSize: input.fileSize,
      mimeType: input.mimeType || '',
      driveFolderId: lessonFolderId,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(now + UPLOAD_SESSION_TTL_MS),
    });

    return json(200, { uploadUrl, storedFileName, uploadToken });
  } catch (error) {
    const code = functionErrorCode(error);
    logFunctionError('drive-create-upload-session', code, error);
    if (code === 'CONFIG_MISSING') {
      return json(503, { error: 'Chức năng nộp bài chưa được cấu hình.' });
    }
    return json(502, { error: 'Không tạo được phiên tải lên. Thử lại sau.' });
  }
}
