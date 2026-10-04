import { FieldValue } from 'firebase-admin/firestore';
import { normalizeStudentName } from '../../src/lib/normalizeStudentName.js';
import { lessonKeyAliases, normalizeLessonKey, schoolPackFolderName } from '../../src/lib/submissionFileName.js';
import { normalizeCompleteSubmissionItems } from '../../src/lib/submissionValidate.js';
import { getAdminDb } from './_lib/firebaseAdmin.js';
import {
  copyDriveFile,
  deleteDriveFile,
  findOrCreateClassFolder,
  findOrCreateSchoolPackStudentFolder,
  getDriveFile,
} from './_lib/driveFolders.js';
import { copyLatestIntoSchoolPack } from './_lib/schoolPack.js';
import { loadOpenClass } from './_lib/submissionValidate.js';
import { clientIp, json, parseJsonBody, preflight } from './_lib/http.js';
import { checkRateLimit, DRIVE_LIMITS } from './_lib/rateLimit.js';
import { functionErrorCode, logFunctionError } from './_lib/functionLog.js';

function sameSize(left, right) {
  return Number(left) === Number(right);
}

function filePayload(doc) {
  const data = typeof doc.data === 'function' ? doc.data() || {} : doc || {};
  return {
    submissionId: doc.id || '',
    storedFileName: data.storedFileName || '',
    originalFileName: data.originalFileName || '',
  };
}

function batchPayload(docs, extra = {}) {
  const files = docs.map((doc) => filePayload(doc));
  const first = files[0] || {};
  const firstData = docs[0] && (typeof docs[0].data === 'function' ? docs[0].data() || {} : docs[0] || {});
  return {
    ok: true,
    submissionId: first.submissionId || '',
    storedFileName: first.storedFileName || '',
    originalFileName: first.originalFileName || '',
    attempt: extra.attempt || Number(firstData.attempt) || 1,
    submittedAt: extra.submittedAt || new Date().toISOString(),
    files,
  };
}

function findByDriveFileQuery(db, driveFileId) {
  return db.collection('submissions').where('driveFileId', '==', driveFileId).limit(1);
}

async function previousPackFileIds(db, { classCode, studentId, lessonKey }) {
  const snaps = await Promise.all(
    lessonKeyAliases(lessonKey).map((key) =>
      db
        .collection('submissions')
        .where('classCode', '==', classCode)
        .where('studentId', '==', studentId)
        .where('lessonKey', '==', key)
        .get(),
    ),
  );
  const ids = [];
  for (const snap of snaps) {
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const fileId = String(data.schoolPackDriveFileId || '').trim();
      if (data.isLatest && fileId) ids.push(fileId);
    }
  }
  return ids;
}

function sessionsAligned(sessions) {
  const first = sessions[0];
  if (!first) return false;
  const lessonKey = normalizeLessonKey(first.lessonKey) || first.lessonKey;
  return sessions.every((session) => {
    const nextLesson = normalizeLessonKey(session.lessonKey) || session.lessonKey;
    return (
      session.classCode === first.classCode &&
      session.studentId === first.studentId &&
      nextLesson === lessonKey
    );
  });
}

async function loadExistingDocs(db, driveFileIds) {
  const snaps = await Promise.all(driveFileIds.map((id) => findByDriveFileQuery(db, id).get()));
  return snaps.map((snap) => (snap.empty ? null : snap.docs[0]));
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

  const parsed = normalizeCompleteSubmissionItems(body);
  if (!parsed.ok) return json(400, { error: parsed.error });
  const { items } = parsed;

  try {
    const db = getAdminDb();
    const sessionRefs = items.map((item) => db.collection('submissionUploadSessions').doc(item.uploadToken));
    const sessionSnaps = await Promise.all(sessionRefs.map((ref) => ref.get()));

    if (sessionSnaps.every((snap) => !snap.exists)) {
      const existing = (await loadExistingDocs(db, items.map((item) => item.driveFileId))).filter(Boolean);
      if (existing.length === items.length) return json(200, batchPayload(existing));
      return json(404, { error: 'Phiên nộp bài đã hết hạn hoặc không tồn tại.' });
    }

    if (sessionSnaps.some((snap) => !snap.exists)) {
      return json(404, { error: 'Phiên nộp bài đã hết hạn hoặc không tồn tại.' });
    }

    const sessions = sessionSnaps.map((snap) => snap.data() || {});
    if (!sessionsAligned(sessions)) {
      return json(400, { error: 'Các file nộp phải cùng học sinh và cùng buổi.' });
    }

    const now = Date.now();
    if (
      sessions.some((session) => {
        const expiresAt = session.expiresAt?.toMillis?.() || 0;
        return expiresAt && expiresAt < now;
      })
    ) {
      await Promise.all(sessionRefs.map((ref) => ref.delete().catch(() => {})));
      return json(410, { error: 'Phiên nộp bài đã hết hạn. Nộp lại từ đầu.' });
    }

    const studentId = sessions[0].studentId;
    if (studentId && !checkRateLimit(`complete:student:${studentId}`, { max: DRIVE_LIMITS.complete.student })) {
      return json(429, { error: 'Bạn thao tác quá nhanh. Thử lại sau vài phút.' });
    }

    const driveFiles = await Promise.all(items.map((item) => getDriveFile(item.driveFileId)));
    for (let index = 0; index < items.length; index += 1) {
      const file = driveFiles[index];
      const session = sessions[index];
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
    }

    const firstSession = sessions[0];
    const lessonKey = normalizeLessonKey(firstSession.lessonKey) || firstSession.lessonKey;
    let packCopies = [];
    if (firstSession.schoolPack) {
      const classDoc = await loadOpenClass(db, firstSession.classCode);
      if (!classDoc?.id) {
        return json(502, { error: 'Không lưu được bài nộp. Thử lại sau.' });
      }
      const classFolderId = await findOrCreateClassFolder(classDoc.classCode, classDoc.driveFolderId);
      const packed = await copyLatestIntoSchoolPack({
        classFolderId,
        packFolderName: firstSession.schoolPackFolderName || schoolPackFolderName(14),
        studentFolderName: normalizeStudentName(firstSession.studentName) || 'HocSinh',
        previousPackFileIds: await previousPackFileIds(db, {
          classCode: firstSession.classCode,
          studentId: firstSession.studentId,
          lessonKey,
        }),
        files: items.map((item, index) => ({
          driveFileId: item.driveFileId,
          storedFileName: sessions[index].storedFileName,
        })),
        findOrCreateSchoolPackStudentFolder,
        copyDriveFile,
        deleteDriveFile,
      });
      packCopies = packed.copiedIds;
      if (packed.packFolderId && packed.packFolderId !== classDoc.driveSchoolPackFolderId) {
        await db.collection('classes').doc(classDoc.id).set(
          { driveSchoolPackFolderId: packed.packFolderId, updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
      }
    }
    const submissionRefs = items.map(() => db.collection('submissions').doc());
    const result = await db.runTransaction(async (tx) => {
      const liveSessions = await Promise.all(sessionRefs.map((ref) => tx.get(ref)));
      if (liveSessions.every((snap) => !snap.exists)) {
        const existingSnaps = await Promise.all(
          items.map((item) => tx.get(findByDriveFileQuery(db, item.driveFileId))),
        );
        const existingDocs = existingSnaps.map((snap) => (snap.empty ? null : snap.docs[0]));
        if (existingDocs.every(Boolean)) return { existing: existingDocs };
        const err = new Error('SESSION_GONE');
        err.code = 'SESSION_GONE';
        throw err;
      }
      if (liveSessions.some((snap) => !snap.exists)) {
        const err = new Error('SESSION_GONE');
        err.code = 'SESSION_GONE';
        throw err;
      }

      const lessonSnaps = await Promise.all(
        lessonKeyAliases(lessonKey).map((key) =>
          tx.get(
            db
              .collection('submissions')
              .where('classCode', '==', firstSession.classCode)
              .where('studentId', '==', firstSession.studentId)
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

      const written = items.map((item, index) => {
        const session = sessions[index];
        const file = driveFiles[index];
        const submissionRef = submissionRefs[index];
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
          schoolPackDriveFileId: packCopies[index] || '',
          attempt,
          isLatest: true,
          status: 'submitted',
          submittedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        });
        tx.delete(sessionRefs[index]);
        return {
          id: submissionRef.id,
          storedFileName: session.storedFileName,
          originalFileName: session.originalFileName,
          attempt,
        };
      });

      return { attempt, written };
    });

    if (result.existing) {
      return json(200, batchPayload(result.existing));
    }

    console.log(
      JSON.stringify({
        event: 'UPLOAD_COMPLETED',
        classCode: firstSession.classCode,
        studentId: firstSession.studentId,
        lessonKey: firstSession.lessonKey,
        driveFileId: items.map((item) => item.driveFileId).join(','),
        fileCount: items.length,
        attempt: result.attempt,
      }),
    );

    return json(
      200,
      batchPayload(result.written, {
        attempt: result.attempt,
        submittedAt: new Date().toISOString(),
      }),
    );
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
