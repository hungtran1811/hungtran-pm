/**
 * Optional production error reporting. Enabled when VITE_SENTRY_DSN is set.
 */

let sentryPromise = null;

function loadSentry() {
  if (!sentryPromise) {
    sentryPromise = import('@sentry/react').catch(() => null);
  }
  return sentryPromise;
}

export async function initErrorReporting() {
  const dsn = import.meta.env?.VITE_SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await loadSentry();
  if (!Sentry?.init) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || 'local-dev',
    tracesSampleRate: 0,
  });
}

export async function captureError(error, context = {}) {
  if (import.meta.env.DEV) {
    console.error('[errorReporting]', error, context);
  }

  const dsn = import.meta.env?.VITE_SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await loadSentry();
  if (!Sentry?.captureException) return;

  Sentry.captureException(error, { extra: context });
}

export function reportUnhandledRejection(event) {
  const reason = event?.reason;
  if (reason instanceof Error) {
    // Không await — bắt rejection của chính captureError để tránh vòng lặp unhandledrejection.
    captureError(reason, { source: 'unhandledrejection' }).catch(() => {});
  }
}
