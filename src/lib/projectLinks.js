const MAX_URL_LEN = 500;
const CANVA_HOSTS = ['canva.com', 'canva.link'];
const SLIDES_HOSTS = ['docs.google.com'];

function hostnameMatchesAny(hostname, hosts) {
  const host = hostname.toLowerCase();
  return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

export function normalizeProjectLink(
  raw,
  { hostIncludes, hostIncludesAny, pathnameStartsWith } = {},
) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return { value: '' };
  if (trimmed.length > MAX_URL_LEN) {
    return { error: `Link tối đa ${MAX_URL_LEN} ký tự.` };
  }

  let href = trimmed;
  if (!/^https?:\/\//i.test(href)) href = `https://${href}`;

  try {
    const url = new URL(href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { error: 'Link phải dùng http hoặc https.' };
    }
    if (hostIncludes && !url.hostname.toLowerCase().includes(hostIncludes)) {
      return { error: `Link phải thuộc trang ${hostIncludes}` };
    }
    if (hostIncludesAny?.length && !hostnameMatchesAny(url.hostname, hostIncludesAny)) {
      return { error: `Link phải thuộc ${hostIncludesAny.join(' hoặc ')}.` };
    }
    if (pathnameStartsWith) {
      const path = url.pathname || '';
      if (!path.startsWith(pathnameStartsWith)) {
        return { error: `Link phải là Google Slides (docs.google.com/presentation/...).` };
      }
    }
    return { value: url.href };
  } catch {
    return { error: 'Link không hợp lệ.' };
  }
}

function asHttps(value) {
  return String(value || '').replace(/^http:\/\//i, 'https://');
}

export function validateProjectLinks({ githubUrl, canvaUrl, slidesUrl, otherUrl } = {}) {
  const gh = normalizeProjectLink(githubUrl, { hostIncludes: 'github.com' });
  if (gh.error) return { error: `GitHub: ${gh.error}` };

  const cv = normalizeProjectLink(canvaUrl, { hostIncludesAny: CANVA_HOSTS });
  if (cv.error) return { error: `Canva: ${cv.error}` };

  const sl = normalizeProjectLink(slidesUrl, {
    hostIncludesAny: SLIDES_HOSTS,
    pathnameStartsWith: '/presentation/',
  });
  if (sl.error) return { error: `Google Slides: ${sl.error}` };

  const other = normalizeProjectLink(otherUrl);
  if (other.error) return { error: `Link khác: ${other.error}` };

  return {
    githubUrl: gh.value,
    canvaUrl: cv.value,
    slidesUrl: sl.value,
    otherUrl: asHttps(other.value),
  };
}
