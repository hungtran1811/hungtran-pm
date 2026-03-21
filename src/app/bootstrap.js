import { initializeFirebase } from '../config/firebase.js';
import { signOutUser } from '../services/auth.service.js';
import { initializeAuthStore, subscribeAuthState } from '../state/auth.store.js';
import { ensureHashRouteLocation } from '../utils/route.js';
import { createRouter } from './router.js';

export async function bootstrapApp() {
  ensureHashRouteLocation();

  const appElement = document.getElementById('app');
  initializeFirebase();
  await initializeAuthStore();

  const router = createRouter(appElement);
  await router.start();

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action="logout"]');

    if (!button) {
      return;
    }

    button.disabled = true;

    try {
      await signOutUser();
      window.location.hash = '#/admin/login';
    } finally {
      button.disabled = false;
    }
  });

  subscribeAuthState(() => {
    router.refresh();
  });
}
