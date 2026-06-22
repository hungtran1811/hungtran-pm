const MAX_URL_LEN = 500;
const CANVA_HOSTS = ['canva.com', 'canva.link'];

function hostnameMatchesAny(hostname, hosts) {
  const host = hostname.toLowerCase();
  return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

export function normalizeProjectLink(raw, { hostIncludes, hostIncludesAny } = {}) {
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
    return { value: url.href };
  } catch {
    return { error: 'Link không hợp lệ.' };
  }
}

export function validateProjectLinks({ githubUrl, canvaUrl }) {
  const gh = normalizeProjectLink(githubUrl, { hostIncludes: 'github.com' });
  if (gh.error) return { error: `GitHub: ${gh.error}` };

  const cv = normalizeProjectLink(canvaUrl, { hostIncludesAny: CANVA_HOSTS });
  if (cv.error) return { error: `Canva: ${cv.error}` };

  return { githubUrl: gh.value, canvaUrl: cv.value };
}
