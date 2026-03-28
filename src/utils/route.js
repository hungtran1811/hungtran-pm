export const DEFAULT_HASH_ROUTE = '#/student/report';

function normalizeClassCode(value) {
  return decodeURIComponent(String(value ?? '').trim()).toUpperCase();
}

export function getPublicReportPathMatch(pathname = '/') {
  return pathname.match(/^\/report\/([^/]+)\/?$/i);
}

function normalizeHash(hash) {
  if (!hash) {
    return '';
  }

  if (hash.startsWith('#/')) {
    return hash;
  }

  return `#/${hash.replace(/^#+/, '')}`;
}

function buildSearchWithClassCode(search = '', classCode = '') {
  const params = new URLSearchParams(search);

  if (classCode) {
    params.set('classCode', normalizeClassCode(classCode));
  } else {
    params.delete('classCode');
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export function normalizeAppRoute(pathname = '/', hash = '', search = '') {
  const normalizedHash = normalizeHash(hash);

  if (normalizedHash) {
    return `/${search}${normalizedHash}`;
  }

  const publicReportMatch = getPublicReportPathMatch(pathname);

  if (publicReportMatch) {
    return pathname;
  }

  const normalizedPath = pathname && pathname !== '/' ? pathname : '/student/report';
  return `/${search}#${normalizedPath}`;
}

export function getLockedReportClassCode(search = window.location.search, pathname = window.location.pathname) {
  const publicReportMatch = getPublicReportPathMatch(pathname);

  if (publicReportMatch) {
    return normalizeClassCode(publicReportMatch[1]);
  }

  const params = new URLSearchParams(search);
  return normalizeClassCode(params.get('classCode'));
}

export function ensureHashRouteLocation(win = window) {
  if (getPublicReportPathMatch(win.location.pathname)) {
    return false;
  }

  const current = `${win.location.pathname}${win.location.search}${win.location.hash}`;
  const normalized = normalizeAppRoute(win.location.pathname, win.location.hash, win.location.search);

  if (current === normalized) {
    return false;
  }

  win.history.replaceState({}, '', normalized);
  return true;
}
