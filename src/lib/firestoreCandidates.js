import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase.js';

/** Trả về snapshot đầu tiên tồn tại trong danh sách doc ID. */
export async function getFirstExistingDoc(collectionName, docIds = []) {
  for (const id of docIds) {
    const snapshot = await getDoc(doc(db, collectionName, id));
    if (snapshot.exists()) return snapshot;
  }
  return null;
}
