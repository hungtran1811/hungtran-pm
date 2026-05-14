import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { DEFAULT_STAGE } from '../constants/stages.js';
import { getFirebaseServices } from '../config/firebase.js';
import { toReportModel } from '../models/report.model.js';
import { toAppError } from '../utils/firebase-error.js';
import { startOfToday } from '../utils/date.js';

function sortReportsBySubmittedAt(items) {
  return [...items].sort((left, right) => {
    const leftTime = left.submittedAt ? left.submittedAt.getTime() : 0;
    const rightTime = right.submittedAt ? right.submittedAt.getTime() : 0;
    return rightTime - leftTime;
  });
}

function calculateProgressStalledCount(sortedReports) {
  let stalledCount = 0;

  for (let index = 0; index < sortedReports.length - 1; index += 1) {
    if (sortedReports[index].progressPercent <= sortedReports[index + 1].progressPercent) {
      stalledCount += 1;
      continue;
    }

    break;
  }

  return stalledCount;
}

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
  const historyQuery = query(collection(db, 'reports'), where('studentId', '==', studentId));

  try {
    const snapshot = await getDocs(historyQuery);
    return sortReportsBySubmittedAt(snapshot.docs.map(toReportModel)).slice(0, limitSize);
  } catch (error) {
    throw toAppError(error, 'Không tải được lịch sử báo cáo của học sinh này.');
  }
}

export async function deleteReport(reportId) {
  const { db } = getFirebaseServices();
  const reportRef = doc(db, 'reports', reportId);

  try {
    const reportSnapshot = await getDoc(reportRef);

    if (!reportSnapshot.exists()) {
      throw new Error('Không tìm thấy báo cáo cần xóa.');
    }

    const report = toReportModel(reportSnapshot);
    const studentRef = doc(db, 'students', report.studentId);
    const studentSnapshot = await getDoc(studentRef);
    const batch = writeBatch(db);

    batch.delete(reportRef);

    if (studentSnapshot.exists()) {
      const studentData = studentSnapshot.data();

      if ((studentData.latestReportId ?? '') === reportId) {
        const historySnapshot = await getDocs(query(collection(db, 'reports'), where('studentId', '==', report.studentId)));
        const remainingReports = sortReportsBySubmittedAt(
          historySnapshot.docs.filter((item) => item.id !== reportId).map(toReportModel),
        );
        const latestRemainingReport = remainingReports[0] ?? null;

        if (latestRemainingReport) {
          batch.update(studentRef, {
            currentProgressPercent: latestRemainingReport.progressPercent,
            currentStage: latestRemainingReport.stage,
            currentStatus: latestRemainingReport.status,
            currentDifficulties: latestRemainingReport.difficulties,
            lastReportedAt: latestRemainingReport.submittedAt,
            latestReportId: latestRemainingReport.id,
            progressStalledCount: calculateProgressStalledCount(remainingReports),
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.update(studentRef, {
            currentProgressPercent: 0,
            currentStage: DEFAULT_STAGE,
            currentStatus: 'Chưa bắt đầu',
            currentDifficulties: '',
            lastReportedAt: null,
            latestReportId: '',
            progressStalledCount: 0,
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    await batch.commit();
    return report;
  } catch (error) {
    throw toAppError(error, 'Không thể xóa báo cáo lúc này.');
  }
}
