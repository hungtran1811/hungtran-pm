export const PRODUCTION_ORIGIN = 'https://hungtranpm.com';

export function getPublicBaseUrl() {
  const configured = String(import.meta.env?.VITE_PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  if (import.meta.env.PROD) return PRODUCTION_ORIGIN;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return PRODUCTION_ORIGIN;
}
