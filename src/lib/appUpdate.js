export function shouldReloadForVersion(runningVersion, remoteVersion) {
  const running = String(runningVersion || '');
  const remote = String(remoteVersion || '');
  if (!running || !remote || running === 'dev' || remote === 'dev') return false;
  return running !== remote;
}

export function isUserEditing(activeElement = typeof document === 'undefined' ? null : document.activeElement) {
  if (!activeElement) return false;
  if (typeof document !== 'undefined' && activeElement === document.body) return false;
  const tag = activeElement.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || activeElement.isContentEditable;
}

export function watchForAppUpdate({
  runningVersion = import.meta.env.VITE_APP_VERSION,
  reload = () => window.location.reload(),
  intervalMs = 2 * 60 * 1000,
} = {}) {
  if (import.meta.env.DEV || !runningVersion || runningVersion === 'dev') return () => {};

  let checking = false;
  const check = async () => {
    if (checking || isUserEditing()) return;
    checking = true;
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      if (shouldReloadForVersion(runningVersion, payload?.version)) reload();
    } catch {
      // Mạng lỗi thì giữ trang hiện tại.
    } finally {
      checking = false;
    }
  };

  const onVisible = () => {
    if (document.visibilityState === 'visible') check();
  };

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', check);
  const timer = window.setInterval(check, intervalMs);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', check);
    window.clearInterval(timer);
  };
}
