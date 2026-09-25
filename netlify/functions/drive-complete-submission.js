import { FieldValue } from 'firebase-admin/firestore';
import { normalizeStudentName } from '../../src/lib/normalizeStudentName.js';
import { lessonKeyAliases, normalizeLessonKey } from '../../src/lib/submissionFileName.js';
import { getAdminDb } from './_lib/firebaseAdmin.js';
import { getDriveFile } from './_lib/driveFolders.js';
import { clientIp, json, parseJsonBody, preflight } from './_lib/http.js';
import { checkRateLimit, DRIVE_LIMITS } from './_lib/rateLimit.js';
import { functionErrorCode, logFunctionError } from './_lib/functionLog.js';

function sameSize(left, right) {
  return Number(left) === Number(right);
}

function submissionPayload(doc) {
  const data = doc.data() || {};
  return {
    ok: true,
    submissionId: doc.id,
    storedFileName: data.storedFileName || '',
    originalFileName: data.originalFileName || '',
    attempt: Number(data.attempt) || 1,
    submittedAt: data.submittedAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
  };
}

function findByDriveFileQuery(db, driveFileId) {
  return db.collection('submissions').where('driveFileId', '==', driveFileId).limit(1);
}

export async function handler(event) {
  const early = preflight(event);
  if (early) return early;

  if (!checkRateLimit(`complete:ip:${clientIp(event)}`, { max: DRIVE_LIMITS.complete.ip })) {
    return json(429, { error: 'Bạn thao tác quá nhanh. Thử lại sau vài phút.' });
  }

  let body;
  try {
    body = parseJsonBody(event);
  } catch {
    return json(400, { error: 'Dữ liệu gửi lên không hợp lệ.' });
  }

  const uploadToken = String(body.uploadToken || '').trim();
  const driveFileId = String(body.driveFileId || '').trim();
  if (!uploadToken || !driveFileId) {
    return json(400, { error: 'Thiếu thông tin hoàn tất nộp bài.' });
  }

  try {
    const db = getAdminDb();
    const sessionRef = db.collection('submissionUploadSessions').doc(uploadToken);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      const existing = await findByDriveFileQuery(db, driveFileId).get();
      if (!existing.empty) return json(200, submissionPayload(existing.docs[0]));
      return json(404, { error: 'Phiên nộp bài đã hết hạn hoặc không tồn tại.' });
    }

    const session = sessionSnap.data() || {};
    const expiresAt = session.expiresAt?.toMillis?.() || 0;
    if (expiresAt && expiresAt < Date.now()) {
      await sessionRef.delete().catch(() => {});
      return json(410, { error: 'Phiên nộp bài đã hết hạn. Nộp lại từ đầu.' });
    }

    if (
      session.studentId &&
      !checkRateLimit(`complete:student:${session.studentId}`, { max: DRIVE_LIMITS.complete.student })
    ) {
      return json(429, { error: 'Bạn thao tác quá nhanh. Thử lại sau vài phút.' });
    }

    const file = await getDriveFile(driveFileId);
    if (!file?.id || file.trashed) {
      return json(400, { error: 'Không tìm thấy file vừa tải lên.' });
    }
    if (file.name !== session.storedFileName) {
      return json(400, { error: 'Tên file trên Drive không khớp phiên nộp.' });
    }
    if (!sameSize(file.size, session.fileSize)) {
      return json(400, { error: 'Dung lượng file trên Drive không khớp.' });
    }
    if (!Array.isArray(file.parents) || !file.parents.includes(session.driveFolderId)) {
      return json(400, { error: 'File không nằm trong thư mục buổi học.' });
    }

    const lessonKey = normalizeLessonKey(session.lessonKey) || session.lessonKey;
    const submissionRef = db.collection('submissions').doc();
    const result = await db.runTransaction(async (tx) => {
      const liveSession = await tx.get(sessionRef);
      if (!liveSession.exists) {
        const existingSnap = await tx.get(findByDriveFileQuery(db, driveFileId));
        if (!existingSnap.empty) return { existing: existingSnap.docs[0] };
        const err = new Error('SESSION_GONE');
        err.code = 'SESSION_GONE';
        throw err;
      }

      const lessonSnaps = await Promise.all(
        lessonKeyAliases(lessonKey).map((key) =>
          tx.get(
            db
              .collection('submissions')
              .where('classCode', '==', session.classCode)
              .where('studentId', '==', session.studentId)
              .where('lessonKey', '==', key),
          ),
        ),
      );
      const lessonDocs = lessonSnaps.flatMap((snap) => snap.docs);
      const previousAttempt = lessonDocs.reduce(
        (max, doc) => Math.max(max, Number(doc.data()?.attempt) || 0),
        0,
      );
      const attempt = previousAttempt + 1;

      lessonDocs.forEach((doc) => {
        if (doc.data()?.isLatest) {
          tx.update(doc.ref, {
            isLatest: false,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });

      tx.set(submissionRef, {
        classCode: session.classCode,
        studentId: session.studentId,
        studentName: session.studentName,
        studentNameNormalized: normalizeStudentName(session.studentName),
        lessonKey,
        originalFileName: session.originalFileName,
        storedFileName: session.storedFileName,
        fileSize: session.fileSize,
        mimeType: session.mimeType || file.mimeType || '',
        driveFileId: file.id,
        driveFolderId: session.driveFolderId,
        attempt,
        isLatest: true,
        status: 'submitted',
        submittedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.delete(sessionRef);
      return { attempt, submissionId: submissionRef.id };
    });

    if (result.existing) {
      return json(200, submissionPayload(result.existing));
    }

    console.log(
      JSON.stringify({
        event: 'UPLOAD_COMPLETED',
        classCode: session.classCode,
        studentId: session.studentId,
        lessonKey: session.lessonKey,
        driveFileId: file.id,
        attempt: result.attempt,
      }),
    );

    return json(200, {
      ok: true,
      submissionId: result.submissionId,
      storedFileName: session.storedFileName,
      originalFileName: session.originalFileName,
      attempt: result.attempt,
      submittedAt: new Date().toISOString(),
    });
  } catch (error) {
    const code = functionErrorCode(error);
    logFunctionError('drive-complete-submission', code, error);
    if (code === 'SESSION_GONE') {
      return json(404, { error: 'Phiên nộp bài đã hết hạn hoặc không tồn tại.' });
    }
    if (code === 'CONFIG_MISSING') {
      return json(503, { error: 'Chức năng nộp bài chưa được cấu hình.' });
    }
    return json(502, { error: 'Không lưu được bài nộp. Thử lại sau.' });
  }
}
