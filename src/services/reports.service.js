import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { getFirebaseServices } from '../config/firebase.js';
import { toReportModel } from '../models/report.model.js';
import { toAppError } from '../utils/firebase-error.js';
import { startOfToday } from '../utils/date.js';

export function subscribeReports(onData, onError, limitSize = 300) {
  const { db } = getFirebaseServices();
  const reportsQuery = query(collection(db, 'reports'), orderBy('submittedAt', 'desc'), limit(limitSize));

  return onSnapshot(
    reportsQuery,
    (snapshot) => {
      onData(snapshot.docs.map(toReportModel));
    },
    onError,
  );
}

export function subscribeTodayReports(onData, onError) {
  const { db } = getFirebaseServices();
  const reportsQuery = query(
    collection(db, 'reports'),
    where('submittedAt', '>=', startOfToday()),
    orderBy('submittedAt', 'desc'),
  );

  return onSnapshot(
    reportsQuery,
    (snapshot) => {
      onData(snapshot.docs.map(toReportModel));
    },
    onError,
  );
}

export async function getStudentReportHistory(studentId, limitSize = 20) {
  const { db } = getFirebaseServices();
  const historyQuery = query(
    collection(db, 'reports'),
    where('studentId', '==', studentId),
    orderBy('submittedAt', 'desc'),
    limit(limitSize),
  );

  try {
    const snapshot = await getDocs(historyQuery);
    return snapshot.docs.map(toReportModel);
  } catch (error) {
    throw toAppError(error, 'Không tải được lịch sử báo cáo của học sinh này.');
  }
}
