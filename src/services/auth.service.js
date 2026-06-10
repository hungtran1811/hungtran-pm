import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from '../config/firebase.js';

const googleProvider = new GoogleAuthProvider();

// Errors that mean the popup flow is unavailable (e.g. Cursor's embedded
// browser). We surface guidance instead of redirecting, which dead-ends there.
export const POPUP_UNAVAILABLE_CODES = new Set([
  'auth/popup-blocked',
  'auth/cancelled-popup-request',
  'auth/popup-closed-by-user',
  'auth/operation-not-supported-in-this-environment',
]);

export function isPopupUnavailable(error) {
  return POPUP_UNAVAILABLE_CODES.has(error?.code);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export function loginWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email.trim());
}

// Kept for safety: resolves any sign-in that completed via redirect previously.
export function getGoogleRedirectResult() {
  return getRedirectResult(auth);
}

export function logout() {
  return signOut(auth);
}
