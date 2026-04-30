export const DEFAULT_HASH_ROUTE = '#/student/report';
const LIBRARY_TABS = new Set(['overview', 'images', 'links']);

function normalizeClassCode(value) {
  return decodeURIComponent(String(value ?? '').trim()).toUpperCase();
}

function normalizeLessonId(value) {
  return decodeURIComponent(String(value ?? '').trim());
}

function normalizeLibraryTab(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return LIBRARY_TABS.has(normalized) ? normalized : 'overview';
}

export function getPublicReportPathMatch(pathname = '/') {
  return pathname.match(/^\/report\/([^/]+)\/?$/i);
}

export function getPublicLibraryPathMatch(pathname = '/') {
  return pathname.match(/^\/library\/([^/]+)\/?$/i);
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

function splitHashRoute(hash = '') {
  const normalizedHash = normalizeHash(hash);

  if (!normalizedHash) {
    return {
      path: '',
      search: '',
    };
  }

  const rawRoute = normalizedHash.slice(1);
  const questionMarkIndex = rawRoute.indexOf('?');

  if (questionMarkIndex === -1) {
    return {
      path: rawRoute,
      search: '',
    };
  }

  return {
    path: rawRoute.slice(0, questionMarkIndex),
    search: rawRoute.slice(questionMarkIndex),
  };
}

export function getHashRouteState(hash = window.location.hash) {
  const { path, search } = splitHashRoute(hash);
  const reportPathMatch = path.match(/^\/student\/report\/([^/?#]+)\/?$/i);
  const libraryPathMatch = path.match(/^\/student\/library\/([^/?#]+)\/?$/i);
  const params = new URLSearchParams(search);

  if (reportPathMatch) {
    return {
      path: '/student/report',
      classCode: normalizeClassCode(reportPathMatch[1]),
      lessonId: normalizeLessonId(params.get('lesson')),
      tab: normalizeLibraryTab(params.get('tab')),
    };
  }

  if (libraryPathMatch) {
    return {
      path: '/student/library',
      classCode: normalizeClassCode(libraryPathMatch[1]),
      lessonId: normalizeLessonId(params.get('lesson')),
      tab: normalizeLibraryTab(params.get('tab')),
    };
  }

  return {
    path,
    classCode: normalizeClassCode(params.get('classCode')),
    lessonId: normalizeLessonId(params.get('lesson')),
    tab: normalizeLibraryTab(params.get('tab')),
  };
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
  const publicLibraryMatch = getPublicLibraryPathMatch(pathname);

  if (publicReportMatch) {
    return `${pathname}${search}`;
  }

  if (publicLibraryMatch) {
    return `${pathname}${search}`;
  }

  const normalizedPath = pathname && pathname !== '/' ? pathname : '/student/report';
  return `/${search}#${normalizedPath}`;
}

export function getLockedReportClassCode(search = window.location.search, pathname = window.location.pathname) {
  const publicReportMatch = getPublicReportPathMatch(pathname);

  if (publicReportMatch) {
    return normalizeClassCode(publicReportMatch[1]);
  }

  const hashRouteState = getHashRouteState();

  if (hashRouteState.classCode) {
    return hashRouteState.classCode;
  }

  const params = new URLSearchParams(search);
  return normalizeClassCode(params.get('classCode'));
}

export function getLockedLibraryClassCode(search = window.location.search, pathname = window.location.pathname) {
  const publicLibraryMatch = getPublicLibraryPathMatch(pathname);

  if (publicLibraryMatch) {
    return normalizeClassCode(publicLibraryMatch[1]);
  }

  const hashRouteState = getHashRouteState();

  if (hashRouteState.path === '/student/library' && hashRouteState.classCode) {
    return hashRouteState.classCode;
  }

  const params = new URLSearchParams(search);
  return normalizeClassCode(params.get('classCode'));
}

export function getStudentLibraryRouteState(
  search = window.location.search,
  pathname = window.location.pathname,
  hash = window.location.hash,
) {
  const publicLibraryMatch = getPublicLibraryPathMatch(pathname);

  if (publicLibraryMatch) {
    const params = new URLSearchParams(search);

    return {
      classCode: normalizeClassCode(publicLibraryMatch[1]),
      lessonId: normalizeLessonId(params.get('lesson')),
      tab: normalizeLibraryTab(params.get('tab')),
    };
  }

  const hashState = getHashRouteState(hash);

  return {
    classCode: hashState.path === '/student/library' ? hashState.classCode : '',
    lessonId: hashState.lessonId || '',
    tab: normalizeLibraryTab(hashState.tab),
  };
}

export function buildPublicReportPath(classCode = '') {
  return `/report/${encodeURIComponent(normalizeClassCode(classCode))}`;
}

export function buildPublicLibraryPath(classCode = '', options = {}) {
  const params = new URLSearchParams();
  const lessonId = normalizeLessonId(options.lessonId);

  if (lessonId) {
    params.set('lesson', lessonId);
  }

  const serialized = params.toString();
  return `/library/${encodeURIComponent(normalizeClassCode(classCode))}${serialized ? `?${serialized}` : ''}`;
}

export function ensureHashRouteLocation(win = window) {
  if (getPublicReportPathMatch(win.location.pathname) || getPublicLibraryPathMatch(win.location.pathname)) {
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
