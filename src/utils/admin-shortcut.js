const SHORTCUT_KEY = 'a';
const REQUIRED_TAP_COUNT = 5;
const TAP_WINDOW_MS = 4000;
const HOLD_DURATION_MS = 900;

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
  holdDurationMs = HOLD_DURATION_MS,
}) {
  let tapTimestamps = [];
  let holdTimer = null;

  function triggerShortcut() {
    tapTimestamps = [];
    if (holdTimer) {
      window.clearTimeout(holdTimer);
      holdTimer = null;
    }
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

  function clearHoldTimer() {
    if (holdTimer) {
      window.clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    clearHoldTimer();
    holdTimer = window.setTimeout(() => {
      triggerShortcut();
    }, holdDurationMs);
  }

  function handlePointerUp() {
    clearHoldTimer();
  }

  document.addEventListener('keydown', handleKeydown);
  brandElement?.addEventListener('click', handleBrandTap);
  brandElement?.addEventListener('pointerdown', handlePointerDown);
  brandElement?.addEventListener('pointerup', handlePointerUp);
  brandElement?.addEventListener('pointerleave', handlePointerUp);
  brandElement?.addEventListener('pointercancel', handlePointerUp);

  return () => {
    document.removeEventListener('keydown', handleKeydown);
    brandElement?.removeEventListener('click', handleBrandTap);
    brandElement?.removeEventListener('pointerdown', handlePointerDown);
    brandElement?.removeEventListener('pointerup', handlePointerUp);
    brandElement?.removeEventListener('pointerleave', handlePointerUp);
    brandElement?.removeEventListener('pointercancel', handlePointerUp);
    clearHoldTimer();
    tapTimestamps = [];
  };
}
