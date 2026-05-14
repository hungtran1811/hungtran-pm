import {
  collection,
  doc,
  getCountFromServer,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { DEFAULT_STAGE } from '../constants/stages.js';
import { getFirebaseServices } from '../config/firebase.js';
import { toStudentModel } from '../models/student.model.js';
import { toAppError } from '../utils/firebase-error.js';

function slugifyVietnamese(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .replaceAll(/đ/g, 'd')
    .replaceAll(/Đ/g, 'D')
    .trim()
    .toLowerCase();
}

function sortStudents(items) {
  return [...items].sort((left, right) => left.fullName.localeCompare(right.fullName, 'vi'));
}

async function syncClassStudentCount(classId) {
  if (!classId) {
    return;
  }

  const { db } = getFirebaseServices();
  const studentsQuery = query(collection(db, 'students'), where('classId', '==', classId), where('active', '==', true));
  const countSnapshot = await getCountFromServer(studentsQuery);

  try {
    await updateDoc(doc(db, 'classes', classId), {
      studentCount: countSnapshot.data().count,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw toAppError(error, 'Không thể đồng bộ sĩ số lớp lúc này.');
  }
}

export function subscribeStudents(onData, onError) {
  const { db } = getFirebaseServices();
  const studentsQuery = query(collection(db, 'students'), orderBy('fullNameKey'));

  return onSnapshot(
    studentsQuery,
    (snapshot) => {
      onData(sortStudents(snapshot.docs.map(toStudentModel)));
    },
    onError,
  );
}

export async function createStudent(values) {
  const { db } = getFirebaseServices();
  const studentRef = doc(collection(db, 'students'));
  const classId = String(values.classId ?? '').trim().toUpperCase();

  try {
    await setDoc(studentRef, {
      fullName: String(values.fullName ?? '').trim(),
      fullNameKey: slugifyVietnamese(values.fullName),
      classId,
      classCode: classId,
      projectName: String(values.projectName ?? '').trim(),
      active: Boolean(values.active ?? true),
      currentProgressPercent: Number(values.currentProgressPercent ?? 0),
      currentStage: values.currentStage ?? DEFAULT_STAGE,
      currentStatus: values.currentStatus ?? 'Chưa bắt đầu',
      currentDifficulties: values.currentDifficulties ?? '',
      lastReportedAt: values.lastReportedAt ?? null,
      latestReportId: values.latestReportId ?? '',
      progressStalledCount: Number(values.progressStalledCount ?? 0),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await syncClassStudentCount(classId);
    return studentRef.id;
  } catch (error) {
    throw toAppError(error, 'Không thể tạo học sinh mới lúc này.');
  }
}

export async function updateStudent(studentId, values, previousClassId = '') {
  const { db } = getFirebaseServices();
  const classId = String(values.classId ?? '').trim().toUpperCase();

  try {
    await updateDoc(doc(db, 'students', studentId), {
      fullName: String(values.fullName ?? '').trim(),
      fullNameKey: slugifyVietnamese(values.fullName),
      classId,
      classCode: classId,
      projectName: String(values.projectName ?? '').trim(),
      active: Boolean(values.active ?? true),
      updatedAt: serverTimestamp(),
    });

    await syncClassStudentCount(classId);

    if (previousClassId && previousClassId !== classId) {
      await syncClassStudentCount(previousClassId);
    }
  } catch (error) {
    throw toAppError(error, 'Không thể cập nhật học sinh lúc này.');
  }
}
