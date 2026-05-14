import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { COMPLETED_STAGE } from '../constants/stages.js';
import { getFirebaseServices } from '../config/firebase.js';
import { toClassModel } from '../models/class.model.js';
import { toAppError } from '../utils/firebase-error.js';

const CLASS_COMPLETION_BATCH_SIZE = 450;
const COMPLETED_CLASS_STAGE = COMPLETED_STAGE || 'Bảo trì & cải tiến';

function sortClasses(items) {
  return [...items].sort((left, right) => left.className.localeCompare(right.className, 'vi'));
}

export function subscribeClasses(onData, onError) {
  const { db } = getFirebaseServices();
  const classesQuery = query(collection(db, 'classes'), orderBy('className'));

  return onSnapshot(
    classesQuery,
    (snapshot) => {
      onData(sortClasses(snapshot.docs.map(toClassModel)));
    },
    onError,
  );
}

export async function getClassesOnce() {
  const { db } = getFirebaseServices();
  const snapshot = await getDocs(collection(db, 'classes'));
  return sortClasses(snapshot.docs.map(toClassModel));
}

export async function createClass(values) {
  const { db } = getFirebaseServices();
  const classCode = String(values.classCode ?? '').trim().toUpperCase();
  const classRef = doc(db, 'classes', classCode);
  const existingSnap = await getDoc(classRef);

  if (existingSnap.exists()) {
    throw new Error(`Mã lớp ${classCode} đã tồn tại.`);
  }

  const payload = {
    classCode,
    className: String(values.className ?? '').trim(),
    status: values.status ?? 'active',
    hidden: Boolean(values.hidden),
    startDate: values.startDate || '',
    endDate: values.endDate || '',
    studentCount: Number(values.studentCount ?? 0),
    curriculumProgramId: String(values.curriculumProgramId ?? '').trim(),
    curriculumCurrentSession: Number(values.curriculumCurrentSession ?? 1),
    curriculumPhase: values.curriculumPhase === 'final' ? 'final' : 'learning',
    activeQuizMode: 'official_quiz',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(classRef, payload);
    return classCode;
  } catch (error) {
    throw toAppError(error, 'Không thể tạo lớp mới lúc này.');
  }
}

export async function updateClass(classId, values) {
  const { db } = getFirebaseServices();

  try {
    await updateDoc(doc(db, 'classes', classId), {
      className: String(values.className ?? '').trim(),
      status: values.status ?? 'active',
      hidden: Boolean(values.hidden),
      startDate: values.startDate || '',
      endDate: values.endDate || '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw toAppError(error, 'Không thể cập nhật lớp lúc này.');
  }
}

export async function completeClass(classId) {
  const { db } = getFirebaseServices();
  const classRef = doc(db, 'classes', classId);

  try {
    const [classSnapshot, studentsSnapshot] = await Promise.all([
      getDoc(classRef),
      getDocs(query(collection(db, 'students'), where('classId', '==', classId))),
    ]);

    if (!classSnapshot.exists()) {
      throw new Error('Không tìm thấy lớp cần cập nhật.');
    }

    const activeStudents = studentsSnapshot.docs;
    const totalBatches = Math.max(1, Math.ceil(activeStudents.length / CLASS_COMPLETION_BATCH_SIZE));

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
      const batch = writeBatch(db);

      if (batchIndex === 0) {
        batch.update(classRef, {
          status: 'completed',
          hidden: true,
          updatedAt: serverTimestamp(),
        });
      }

      const batchStudents = activeStudents.slice(
        batchIndex * CLASS_COMPLETION_BATCH_SIZE,
        (batchIndex + 1) * CLASS_COMPLETION_BATCH_SIZE,
      );

      batchStudents.forEach((studentDoc) => {
        batch.update(studentDoc.ref, {
          currentProgressPercent: 100,
          currentStage: COMPLETED_CLASS_STAGE,
          currentStatus: 'Hoàn thành',
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
    }

    return {
      updatedStudentCount: activeStudents.length,
    };
  } catch (error) {
    throw toAppError(error, 'Không thể hoàn thành lớp lúc này.');
  }
}
