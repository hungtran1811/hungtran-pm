import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { toKnowledgeReportModel } from '../models/index.js';

const knowledgeReportsRef = collection(db, 'knowledgeReports');

export function buildFeedbackId(classCode, studentId, lessonId) {
  return `${classCode}__${studentId}__${lessonId}`;
}

export function buildStudentFeedbackIndexId(classCode, studentId) {
  return `${classCode}__${studentId}`;
}

/** 1 read thay vì query tối đa 50 phản hồi — fallback legacy nếu chưa có index. */
export async function getStudentFeedbackLessonIds(classCode, studentId) {
  if (!classCode || !studentId) return [];
  const indexId = buildStudentFeedbackIndexId(classCode, studentId);
  const snapshot = await getDoc(doc(db, 'studentFeedbackIndex', indexId));
  if (snapshot.exists()) {
    const lessonIds = snapshot.data()?.lessonIds;
    return Array.isArray(lessonIds) ? lessonIds : [];
  }
  const reports = await listKnowledgeReportsByStudent(studentId, 50);
  return reports.filter((r) => r.classCode === classCode).map((r) => r.lessonId);
}

// Single-field equality (classCode) uses the automatic index, so this avoids
// needing a composite index (classCode + submittedAt). Sorted client-side.
function sortKnowledgeReports(docs) {
  return docs
    .map(toKnowledgeReportModel)
    .sort((a, b) => (b.submittedAt?.getTime?.() ?? 0) - (a.submittedAt?.getTime?.() ?? 0));
}

export async function listKnowledgeReportsByClass(classCode, max = 500) {
  const snapshot = await getDocs(
    query(knowledgeReportsRef, where('classCode', '==', classCode), limit(max)),
  );
  return sortKnowledgeReports(snapshot.docs);
}

export function subscribeKnowledgeReportsByClass(classCode, onData, onError, max = 500) {
  const q = query(knowledgeReportsRef, where('classCode', '==', classCode), limit(max));
  return onSnapshot(
    q,
    (snapshot) => onData(sortKnowledgeReports(snapshot.docs)),
    onError,
  );
}

// Single-field equality (studentId) uses the automatic index, so this avoids
// needing a new composite index. Sorted client-side by submission time.
export function getSubmittedStudentIdsForSession(feedbacks, sessionNumber) {
  const ids = new Set();
  feedbacks.forEach((f) => {
    if (Number(f.sessionNumber) === Number(sessionNumber)) ids.add(f.studentId);
  });
  return ids;
}

export async function listKnowledgeReportsByStudent(studentId, max = 50) {
  const snapshot = await getDocs(
    query(knowledgeReportsRef, where('studentId', '==', studentId), limit(max)),
  );
  return snapshot.docs
    .map(toKnowledgeReportModel)
    .sort((a, b) => (b.submittedAt?.getTime?.() ?? 0) - (a.submittedAt?.getTime?.() ?? 0));
}

export async function getKnowledgeReport(feedbackId) {
  const snapshot = await getDoc(doc(db, 'knowledgeReports', feedbackId));
  return snapshot.exists() ? toKnowledgeReportModel(snapshot) : null;
}

// Students can read their own receipt (firestore.rules allows `get` by shape +
// open-class/active-student checks), so this is how the portal detects whether a
// lesson feedback was already submitted.
export async function hasSubmittedFeedback(classCode, studentId, lessonId) {
  const feedbackId = buildFeedbackId(classCode, studentId, lessonId);
  try {
    const snapshot = await getDoc(doc(db, 'knowledgeReportReceipts', feedbackId));
    return snapshot.exists();
  } catch {
    return false;
  }
}

export function subscribeFeedbackReceipt(classCode, studentId, lessonId, onData, onError) {
  const feedbackId = buildFeedbackId(classCode, studentId, lessonId);
  return onSnapshot(
    doc(db, 'knowledgeReportReceipts', feedbackId),
    (snapshot) => onData(snapshot.exists()),
    onError,
  );
}

export function subscribeKnowledgeReportsByStudent(studentId, onData, onError, max = 50) {
  if (!studentId) return () => {};
  const q = query(knowledgeReportsRef, where('studentId', '==', studentId), limit(max));
  return onSnapshot(
    q,
    (snapshot) => onData(sortKnowledgeReports(snapshot.docs)),
    onError,
  );
}

// Submits a per-lesson session feedback. Mirrors firestore.rules: the feedback
// document and its receipt are written together so the receipt's
// `hasMatchingKnowledgeReportAfter` check passes (shared serverTimestamp).
export async function submitKnowledgeReport({ student, classDoc, lesson, form }) {
  const feedbackId = buildFeedbackId(classDoc.classCode, student.id, lesson.id);
  const batch = writeBatch(db);
  const reportRef = doc(db, 'knowledgeReports', feedbackId);
  const receiptRef = doc(db, 'knowledgeReportReceipts', feedbackId);

  const base = {
    feedbackId,
    classCode: classDoc.classCode,
    studentId: student.id,
    curriculumProgramId: classDoc.curriculumProgramId,
    sessionNumber: Number(lesson.sessionNumber),
    lessonId: lesson.id,
    submittedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  batch.set(reportRef, {
    ...base,
    studentName: student.fullName,
    understoodTopics: form.understoodTopics.trim(),
    unclearTopics: form.unclearTopics.trim(),
    understandingLevel: Number(form.understandingLevel),
    supportRequest: form.supportRequest?.trim() ?? '',
  });

  batch.set(receiptRef, base);

  const indexRef = doc(
    db,
    'studentFeedbackIndex',
    buildStudentFeedbackIndexId(classDoc.classCode, student.id),
  );
  batch.set(
    indexRef,
    {
      classCode: classDoc.classCode,
      studentId: student.id,
      lessonIds: arrayUnion(lesson.id),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();
  return feedbackId;
}

/** Admin: xóa phản hồi + receipt để học sinh điền lại form buổi học. */
export async function resetKnowledgeFeedback(feedbackId) {
  if (!feedbackId) throw new Error('Thiếu mã phản hồi.');
  const reportSnap = await getDoc(doc(db, 'knowledgeReports', feedbackId));
  const batch = writeBatch(db);
  batch.delete(doc(db, 'knowledgeReports', feedbackId));
  batch.delete(doc(db, 'knowledgeReportReceipts', feedbackId));

  if (reportSnap.exists()) {
    const { classCode, studentId, lessonId } = reportSnap.data();
    if (classCode && studentId && lessonId) {
      batch.set(
        doc(db, 'studentFeedbackIndex', buildStudentFeedbackIndexId(classCode, studentId)),
        {
          classCode,
          studentId,
          lessonIds: arrayRemove(lessonId),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }
  }

  await batch.commit();
}
