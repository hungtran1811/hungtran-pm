import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseServices } from '../config/firebase.js';

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export async function getAdminProfileByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const { db } = getFirebaseServices();
  const adminSnap = await getDoc(doc(db, 'admins', normalizedEmail));

  if (!adminSnap.exists()) {
    return null;
  }

  return {
    id: adminSnap.id,
    ...adminSnap.data(),
  };
}
