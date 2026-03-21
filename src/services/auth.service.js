import { getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { getFirebaseServices } from '../config/firebase.js';
import { toAppError } from '../utils/firebase-error.js';

export async function signInWithGoogle() {
  const { auth, googleProvider } = getFirebaseServices();

  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    throw toAppError(error, 'Không thể đăng nhập bằng Google lúc này.');
  }
}

export async function signInWithGoogleRedirect() {
  const { auth, googleProvider } = getFirebaseServices();

  try {
    await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    throw toAppError(error, 'Không thể chuyển sang đăng nhập bằng Google lúc này.');
  }
}

export async function resolveGoogleRedirectResult() {
  const { auth } = getFirebaseServices();

  try {
    return await getRedirectResult(auth);
  } catch (error) {
    throw toAppError(error, 'Không thể hoàn tất đăng nhập chuyển hướng bằng Google.');
  }
}

export async function signOutUser() {
  const { auth } = getFirebaseServices();

  try {
    return await signOut(auth);
  } catch (error) {
    throw toAppError(error, 'Không thể đăng xuất lúc này.');
  }
}

export function observeAuthState(callback) {
  const { auth } = getFirebaseServices();
  return onAuthStateChanged(auth, callback);
}
