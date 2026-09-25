export function functionErrorCode(error) {
  if (error?.code) return String(error.code);
  const message = String(error?.message || '');
  if (message.includes('Missing')) return 'CONFIG_MISSING';
  return 'UPSTREAM_FAILED';
}

export function logFunctionError(fn, code, error) {
  const message = String(error?.message || error || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
  console.error(`[${fn}] ${code} ${message}`);
}
