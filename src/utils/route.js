export const DEFAULT_HASH_ROUTE = '#/student/report';

function normalizeHash(hash) {
  if (!hash) {
    return '';
  }

  if (hash.startsWith('#/')) {
    return hash;
  }

  return `#/${hash.replace(/^#+/, '')}`;
}

export function normalizeAppRoute(pathname = '/', hash = '', search = '') {
  const normalizedHash = normalizeHash(hash);

  if (normalizedHash) {
    return `/${search}${normalizedHash}`;
  }

  const normalizedPath = pathname && pathname !== '/' ? pathname : '/student/report';
  return `/${search}#${normalizedPath}`;
}

export function ensureHashRouteLocation(win = window) {
  const current = `${win.location.pathname}${win.location.search}${win.location.hash}`;
  const normalized = normalizeAppRoute(win.location.pathname, win.location.hash, win.location.search);

  if (current === normalized) {
    return false;
  }

  win.history.replaceState({}, '', normalized);
  return true;
}
