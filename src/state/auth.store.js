import { getAdminProfileByEmail } from '../services/admins.service.js';
import { observeAuthState } from '../services/auth.service.js';

const listeners = new Set();

const state = {
  ready: false,
  user: null,
  adminProfile: null,
  isAdmin: false,
};

let initializePromise;

function notify() {
  listeners.forEach((listener) => listener({ ...state }));
}

export function getAuthState() {
  return { ...state };
}

export function subscribeAuthState(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function initializeAuthStore() {
  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = new Promise((resolve) => {
    let resolved = false;

    observeAuthState(async (user) => {
      state.user = user ?? null;
      state.adminProfile = null;
      state.isAdmin = false;

      if (user?.email) {
        const adminProfile = await getAdminProfileByEmail(user.email);
        state.adminProfile = adminProfile;
        state.isAdmin = Boolean(adminProfile?.active);
      }

      state.ready = true;
      notify();

      if (!resolved) {
        resolved = true;
        resolve(getAuthState());
      }
    });
  });

  return initializePromise;
}

export async function ensureAdmin() {
  await initializeAuthStore();
  return state.isAdmin;
}
