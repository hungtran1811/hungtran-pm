const SHORTCUT_KEY = 'a';
const REQUIRED_TAP_COUNT = 5;
const TAP_WINDOW_MS = 4000;

function isKeyboardShortcut(event) {
  if (!event) {
    return false;
  }

  const key = String(event.key ?? '').toLowerCase();
  const modifierPressed = event.ctrlKey || event.metaKey;

  return modifierPressed && event.shiftKey && key === SHORTCUT_KEY;
}

export function attachHiddenAdminShortcut({
  brandElement,
  onTrigger,
  tapCount = REQUIRED_TAP_COUNT,
  tapWindowMs = TAP_WINDOW_MS,
}) {
  let tapTimestamps = [];

  function triggerShortcut() {
    tapTimestamps = [];
    onTrigger?.();
  }

  function handleKeydown(event) {
    if (!isKeyboardShortcut(event)) {
      return;
    }

    event.preventDefault();
    triggerShortcut();
  }

  function handleBrandTap() {
    const now = Date.now();
    tapTimestamps = [...tapTimestamps.filter((timestamp) => now - timestamp <= tapWindowMs), now];

    if (tapTimestamps.length >= tapCount) {
      triggerShortcut();
    }
  }

  document.addEventListener('keydown', handleKeydown);
  brandElement?.addEventListener('click', handleBrandTap);

  return () => {
    document.removeEventListener('keydown', handleKeydown);
    brandElement?.removeEventListener('click', handleBrandTap);
    tapTimestamps = [];
  };
}
