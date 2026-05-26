import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseServices } from '../config/firebase.js';
import {
  toQuizAttemptModel,
  toQuizAttemptSubmissionModel,
} from '../models/quiz.model.js';
import { getAuthState } from '../state/auth.store.js';
import { toAppError } from '../utils/firebase-error.js';
import {
  buildQuizAttemptId,
  QUIZ_ATTEMPT_STATUS_REOPENED,
  QUIZ_MODE_OFFICIAL,
} from '../utils/quiz.js';
import {
  ADMIN_QUIZ_PREVIEW_STUDENT_ID,
  ADMIN_QUIZ_PREVIEW_STUDENT_NAME,
  isAdminQuizPreviewRecord,
} from './quiz-admin-preview.service.js';

function sortQuizAttempts(attempts = []) {
  return [...attempts].sort((left, right) => {
    const leftTime = left.submittedAt ? left.submittedAt.getTime() : 0;
    const rightTime = right.submittedAt ? right.submittedAt.getTime() : 0;

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    if (left.sessionNumber !== right.sessionNumber) {
      return left.sessionNumber - right.sessionNumber;
    }

    return left.studentName.localeCompare(right.studentName, 'vi');
  });
}

function sortQuizAttemptSubmissions(submissions = []) {
  return [...submissions].sort((left, right) => {
    if (left.submissionNumber !== right.submissionNumber) {
      return left.submissionNumber - right.submissionNumber;
    }

    const leftTime = left.submittedAt ? left.submittedAt.getTime() : 0;
    const rightTime = right.submittedAt ? right.submittedAt.getTime() : 0;
    return leftTime - rightTime;
  });
}

function isPermissionDeniedError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();

  return code.includes('permission-denied') || message.includes('missing or insufficient permissions');
}

export async function getQuizAttemptsByClass(classCode) {
  const normalizedClassCode = String(classCode ?? '').trim().toUpperCase();

  if (!normalizedClassCode) {
    return [];
  }

  const { db } = getFirebaseServices();

  try {
    const attemptsQuery = query(collection(db, 'quizAttempts'), where('classCode', '==', normalizedClassCode));
    const attemptsSnapshot = await getDocs(attemptsQuery);
    let submissionsSnapshot = null;

    try {
      const submissionsQuery = query(
        collection(db, 'quizAttemptSubmissions'),
        where('classCode', '==', normalizedClassCode),
      );
      submissionsSnapshot = await getDocs(submissionsQuery);
    } catch (error) {
      if (!isPermissionDeniedError(error)) {
        throw error;
      }
    }

    const submissionsByAttemptId = (submissionsSnapshot?.docs || []).reduce((result, snapshot) => {
      const submission = toQuizAttemptSubmissionModel(snapshot);

      if (!submission.attemptId) {
        return result;
      }

      if (!result.has(submission.attemptId)) {
        result.set(submission.attemptId, []);
      }

      result.get(submission.attemptId).push(submission);
      return result;
    }, new Map());

    return sortQuizAttempts(
      attemptsSnapshot.docs.map((snapshot) => {
        const attempt = toQuizAttemptModel(snapshot);
        const submissions = sortQuizAttemptSubmissions(submissionsByAttemptId.get(attempt.id) || []);

        return {
          ...(isAdminQuizPreviewRecord(attempt)
            ? {
                ...attempt,
                studentId: ADMIN_QUIZ_PREVIEW_STUDENT_ID,
                studentName: ADMIN_QUIZ_PREVIEW_STUDENT_NAME,
              }
            : attempt),
          submissions: submissions.map((submission) =>
            isAdminQuizPreviewRecord(submission)
              ? {
                  ...submission,
                  studentId: ADMIN_QUIZ_PREVIEW_STUDENT_ID,
                }
              : submission,
          ),
        };
      }),
    );
  } catch (error) {
    throw toAppError(error, 'Không tải được danh sách bài nộp trắc nghiệm.');
  }
}

export async function getQuizLiveAttemptsByClass(classCode) {
  const normalizedClassCode = String(classCode ?? '').trim().toUpperCase();

  if (!normalizedClassCode) {
    return [];
  }

  const { db } = getFirebaseServices();

  try {
    const liveAttemptsQuery = query(
      collection(db, 'quizLiveAttempts'),
      where('classCode', '==', normalizedClassCode),
      where('status', '==', 'draft'),
    );
    const snapshot = await getDocs(liveAttemptsQuery);

    return snapshot.docs
      .map((docSnapshot) => {
        const data = docSnapshot.data();

        return {
          id: docSnapshot.id,
          attemptId: String(data.attemptId || '').trim(),
          classCode: String(data.classCode || '').trim().toUpperCase(),
          studentId: String(data.studentId || '').trim(),
          sessionNumber: Number(data.sessionNumber || 0),
          submissionNumber: Math.max(1, Number(data.submissionNumber || 1)),
          questionCount: Number(data.questionCount || 0),
          answerCount:
            data.answers && typeof data.answers === 'object'
              ? Object.keys(data.answers).filter((key) => String(data.answers[key] ?? '').trim()).length
              : 0,
          updatedAt: data.updatedAt?.toDate?.() || null,
        };
      })
      .sort((left, right) => {
        if (left.sessionNumber !== right.sessionNumber) {
          return left.sessionNumber - right.sessionNumber;
        }

        return left.studentId.localeCompare(right.studentId, 'vi');
      });
  } catch (error) {
    throw toAppError(error, 'Không tải được danh sách bài đang làm.');
  }
}

export async function reopenQuizAttempt(payload = {}) {
  const { db } = getFirebaseServices();
  const normalizedPayload =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : { attemptId: payload };
  const normalizedAttemptId = String(normalizedPayload.attemptId ?? '').trim();
  const fallbackClassCode = String(normalizedPayload.classCode ?? '').trim().toUpperCase();
  const fallbackStudentId = String(normalizedPayload.studentId ?? '').trim();
  const fallbackSessionNumber = Number(normalizedPayload.sessionNumber || 0);
  const attemptRef = normalizedAttemptId ? doc(db, 'quizAttempts', normalizedAttemptId) : null;
  const authState = getAuthState();
  const reopenedBy = authState.user?.email || '';

  try {
    const attemptSnapshot = attemptRef ? await getDoc(attemptRef) : null;

    if (!attemptSnapshot?.exists() && (!fallbackClassCode || !fallbackStudentId || !fallbackSessionNumber)) {
      throw new Error('Không tìm thấy bài nộp cần mở lại.');
    }

    const attemptData = attemptSnapshot?.exists() ? attemptSnapshot.data() : {};
    const targetClassCode = String(attemptData.classCode ?? fallbackClassCode).trim().toUpperCase();
    const targetStudentId = String(attemptData.studentId ?? fallbackStudentId).trim();
    const targetSessionNumber = Number(attemptData.sessionNumber || fallbackSessionNumber || 0);

    if (!targetClassCode || !targetStudentId || !targetSessionNumber) {
      throw new Error('Thiếu thông tin để mở lại lượt làm cho học sinh này.');
    }

    const batch = writeBatch(db);
    const reopenedAt = serverTimestamp();
    const canonicalAttemptId = buildQuizAttemptId(targetClassCode, targetStudentId, targetSessionNumber);
    const attemptQuery = query(
      collection(db, 'quizAttempts'),
      where('classCode', '==', targetClassCode),
      where('studentId', '==', targetStudentId),
      where('sessionNumber', '==', targetSessionNumber),
    );
    const attemptStateQuery = query(
      collection(db, 'quizAttemptStates'),
      where('classCode', '==', targetClassCode),
      where('studentId', '==', targetStudentId),
      where('sessionNumber', '==', targetSessionNumber),
    );
    const [matchingAttemptSnapshots, matchingAttemptStateSnapshots] = await Promise.all([
      getDocs(attemptQuery),
      getDocs(attemptStateQuery),
    ]);
    const attemptDocsById = new Map();
    const attemptStateDocsById = new Map();

    if (attemptSnapshot?.exists()) {
      attemptDocsById.set(attemptSnapshot.id, attemptSnapshot);
    }

    matchingAttemptSnapshots.docs.forEach((snapshot) => {
      attemptDocsById.set(snapshot.id, snapshot);
    });

    matchingAttemptStateSnapshots.docs.forEach((snapshot) => {
      attemptStateDocsById.set(snapshot.id, snapshot);
    });

    if (!attemptDocsById.size) {
      attemptDocsById.set(canonicalAttemptId, null);
    }

    if (!attemptStateDocsById.size) {
      attemptStateDocsById.set(canonicalAttemptId, null);
    }

    attemptDocsById.forEach((_snapshot, docId) => {
      batch.set(
        doc(db, 'quizAttempts', docId),
        {
          classCode: targetClassCode,
          studentId: targetStudentId,
          sessionNumber: targetSessionNumber,
          quizMode: QUIZ_MODE_OFFICIAL,
          status: QUIZ_ATTEMPT_STATUS_REOPENED,
          reopenedAt,
          reopenedBy,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });

    attemptStateDocsById.forEach((snapshot, docId) => {
      const snapshotData = snapshot?.data?.() || {};

      batch.set(
        doc(db, 'quizAttemptStates', docId),
        {
          classCode: targetClassCode,
          studentId: targetStudentId,
          sessionNumber: targetSessionNumber,
          quizMode: QUIZ_MODE_OFFICIAL,
          status: QUIZ_ATTEMPT_STATUS_REOPENED,
          submissionCount: Number(snapshotData.submissionCount || attemptData.submissionCount || 0),
          submittedAt: snapshotData.submittedAt ?? attemptData.submittedAt ?? null,
          createdAt: snapshotData.createdAt ?? attemptData.createdAt ?? null,
          reopenedAt,
          reopenedBy,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });

    await batch.commit();
  } catch (error) {
    throw toAppError(error, 'Không thể mở lại lượt làm bài này.');
  }
}
