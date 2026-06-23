import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase.js';

const COLLECTION = 'minigameAttendance';

function attendanceRef(classCode) {
  return doc(db, COLLECTION, classCode);
}

export async function fetchMinigameAttendance(classCode) {
  if (!classCode) return null;
  try {
    const snapshot = await getDoc(attendanceRef(classCode));
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    return {
      classCode,
      presentStudentIds: Array.isArray(data.presentStudentIds) ? data.presentStudentIds : [],
      updatedAt: data.updatedAt ?? null,
    };
  } catch {
    return null;
  }
}

export function subscribeMinigameAttendance(classCode, onData, onError) {
  if (!classCode) return () => {};
  return onSnapshot(
    attendanceRef(classCode),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      const data = snapshot.data();
      onData({
        classCode,
        presentStudentIds: Array.isArray(data.presentStudentIds) ? data.presentStudentIds : [],
        updatedAt: data.updatedAt ?? null,
      });
    },
    onError,
  );
}

export async function saveMinigameAttendance(classCode, presentStudentIds) {
  if (!classCode) return;
  await setDoc(
    attendanceRef(classCode),
    {
      classCode,
      presentStudentIds: [...presentStudentIds],
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
