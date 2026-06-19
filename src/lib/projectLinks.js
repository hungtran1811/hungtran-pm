const MAX_URL_LEN = 500;

export function normalizeProjectLink(raw, { hostIncludes } = {}) {
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
    return { value: url.href };
  } catch {
    return { error: 'Link không hợp lệ.' };
  }
}

export function validateProjectLinks({ githubUrl, canvaUrl }) {
  const gh = normalizeProjectLink(githubUrl, { hostIncludes: 'github.com' });
  if (gh.error) return { error: `GitHub: ${gh.error}` };

  const cv = normalizeProjectLink(canvaUrl, { hostIncludes: 'canva.com' });
  if (cv.error) return { error: `Canva: ${cv.error}` };

  return { githubUrl: gh.value, canvaUrl: cv.value };
}
