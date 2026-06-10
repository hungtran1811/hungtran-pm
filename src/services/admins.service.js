import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase.js';

// Mirrors firestore.rules: admin identity is the lowercased email document id
// in the `admins` collection, and must have active === true.
export async function fetchAdminProfile(email) {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  const snapshot = await getDoc(doc(db, 'admins', normalized));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() || {};
  const active = data.active === true || data.active === 'true';
  return {
    email: normalized,
    active,
    role: data.role ?? 'admin',
    displayName: data.displayName ?? '',
  };
}
