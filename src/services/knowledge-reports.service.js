import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { getFirebaseServices } from '../config/firebase.js';
import { toKnowledgeReportModel } from '../models/knowledge-report.model.js';

export function subscribeKnowledgeReports(onData, onError, limitSize = 500) {
  const { db } = getFirebaseServices();
  const reportsQuery = query(
    collection(db, 'knowledgeReports'),
    orderBy('submittedAt', 'desc'),
    limit(limitSize),
  );

  return onSnapshot(
    reportsQuery,
    (snapshot) => {
      onData(snapshot.docs.map(toKnowledgeReportModel));
    },
    onError,
  );
}
