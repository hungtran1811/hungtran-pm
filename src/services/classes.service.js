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
} from 'firebase/firestore';
import { getFirebaseServices } from '../config/firebase.js';
import { toClassModel } from '../models/class.model.js';
import { toAppError } from '../utils/firebase-error.js';

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
