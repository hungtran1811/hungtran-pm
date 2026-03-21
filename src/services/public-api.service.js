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
import { httpsCallable } from 'firebase/functions';
import { getFirebaseServices } from '../config/firebase.js';
import { toDateKey } from '../utils/date.js';
import { toAppError } from '../utils/firebase-error.js';

function callable(name) {
  const { functions } = getFirebaseServices();
  return httpsCallable(functions, name);
}

function normalizeClassCode(value) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function shouldUseFirestoreFallback(error) {
  const code = String(error?.code ?? '').trim().toLowerCase();
  const message = String(error?.message ?? '').trim().toLowerCase();

  return (
    code === 'internal' ||
    code === 'unavailable' ||
    code.startsWith('functions/') ||
    message === 'internal' ||
    message.includes('404') ||
    message.includes('not found') ||
    message.includes('failed to fetch')
  );
}

function mapRosterStudent(snapshot) {
  const data = snapshot.data();

  return {
    studentId: snapshot.id,
    fullName: data.fullName ?? '',
    projectName: data.projectName ?? '',
    lastReportedAt: data.lastReportedAt ?? null,
    currentProgressPercent: Number(data.currentProgressPercent ?? 0),
    currentStage: data.currentStage ?? 'Ý tưởng',
    currentStatus: data.currentStatus ?? 'Chưa bắt đầu',
  };
}

async function listActiveClassesFromFirestore() {
  const { db } = getFirebaseServices();
  const classesQuery = query(collection(db, 'classes'), where('status', '==', 'active'), where('hidden', '==', false));
  const snapshot = await getDocs(classesQuery);

  return snapshot.docs
    .map((classDoc) => {
      const data = classDoc.data();

      return {
        classId: classDoc.id,
        classCode: data.classCode ?? classDoc.id,
        className: data.className ?? '',
      };
    })
    .sort((left, right) => left.className.localeCompare(right.className, 'vi'));
}

async function getClassRosterFromFirestore(classCode) {
  const { db } = getFirebaseServices();
  const normalizedClassCode = normalizeClassCode(classCode);
  const classSnapshot = await getDoc(doc(db, 'classes', normalizedClassCode));

  if (!classSnapshot.exists()) {
    throw new Error('Không tìm thấy lớp học.');
  }

  const classData = classSnapshot.data();

  if (classData.status !== 'active' || classData.hidden) {
    throw new Error('Lớp học hiện không mở để gửi báo cáo.');
  }

  const studentsQuery = query(
    collection(db, 'students'),
    where('classId', '==', normalizedClassCode),
    where('active', '==', true),
  );
  const snapshot = await getDocs(studentsQuery);

  return snapshot.docs.map(mapRosterStudent).sort((left, right) => left.fullName.localeCompare(right.fullName, 'vi'));
}

async function submitStudentReportViaFirestore(payload) {
  const { db } = getFirebaseServices();
  const classCode = normalizeClassCode(payload.classCode);
  const studentId = normalizeText(payload.studentId);
  const classSnapshot = await getDoc(doc(db, 'classes', classCode));

  if (!classSnapshot.exists()) {
    throw new Error('Không tìm thấy lớp học.');
  }

  const classData = classSnapshot.data();

  if (classData.status !== 'active' || classData.hidden) {
    throw new Error('Lớp học hiện không mở để gửi báo cáo.');
  }

  const studentRef = doc(db, 'students', studentId);
  const studentSnapshot = await getDoc(studentRef);

  if (!studentSnapshot.exists()) {
    throw new Error('Không tìm thấy học sinh.');
  }

  const studentData = studentSnapshot.data();

  if (!studentData.active || studentData.classId !== classCode) {
    throw new Error('Học sinh hiện không thuộc lớp được chọn hoặc đã bị khóa.');
  }

  const progressPercent = Number(payload.progressPercent);
  const previousProgress = Number(studentData.currentProgressPercent ?? 0);
  const progressStalledCount =
    progressPercent <= previousProgress ? Number(studentData.progressStalledCount ?? 0) + 1 : 0;
  const reportRef = doc(collection(db, 'reports'));
  const submittedAt = serverTimestamp();
  const difficulties = normalizeText(payload.difficulties);
  const stage = normalizeText(payload.stage);
  const status = normalizeText(payload.status);
  const batch = writeBatch(db);

  batch.set(reportRef, {
    classId: classCode,
    classCode,
    studentId,
    studentName: studentData.fullName ?? '',
    projectName: studentData.projectName ?? '',
    progressPercent,
    stage,
    status,
    doneToday: normalizeText(payload.doneToday),
    nextGoal: normalizeText(payload.nextGoal),
    difficulties,
    submittedAt,
    submittedDateKey: toDateKey(new Date()),
    source: 'student-form',
    createdAt: submittedAt,
  });

  batch.update(studentRef, {
    currentProgressPercent: progressPercent,
    currentStage: stage,
    currentStatus: status,
    currentDifficulties: difficulties,
    lastReportedAt: submittedAt,
    latestReportId: reportRef.id,
    progressStalledCount,
    updatedAt: submittedAt,
  });

  await batch.commit();

  return {
    reportId: reportRef.id,
    submittedAt: new Date().toISOString(),
  };
}

export async function listActiveClasses() {
  try {
    const response = await callable('listActiveClasses')({});
    return response.data.classes ?? [];
  } catch (error) {
    if (shouldUseFirestoreFallback(error)) {
      try {
        return await listActiveClassesFromFirestore();
      } catch (fallbackError) {
        throw toAppError(fallbackError, 'Không tải được danh sách lớp đang mở.');
      }
    }

    throw toAppError(error, 'Không tải được danh sách lớp đang mở.');
  }
}

export async function getClassRoster(classCode) {
  try {
    const response = await callable('getClassRoster')({ classCode });
    return response.data.students ?? [];
  } catch (error) {
    if (shouldUseFirestoreFallback(error)) {
      try {
        return await getClassRosterFromFirestore(classCode);
      } catch (fallbackError) {
        throw toAppError(fallbackError, 'Không tải được danh sách học sinh của lớp này.');
      }
    }

    throw toAppError(error, 'Không tải được danh sách học sinh của lớp này.');
  }
}

export async function submitStudentReport(payload) {
  try {
    const response = await callable('submitStudentReport')(payload);
    return response.data;
  } catch (error) {
    if (shouldUseFirestoreFallback(error)) {
      try {
        return await submitStudentReportViaFirestore(payload);
      } catch (fallbackError) {
        throw toAppError(fallbackError, 'Không thể gửi báo cáo lúc này.');
      }
    }

    throw toAppError(error, 'Không thể gửi báo cáo lúc này.');
  }
}
