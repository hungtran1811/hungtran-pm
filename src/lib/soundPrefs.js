export const SOUND_MUTED_KEY = 'hungtran-pm-game-sound-muted';
export const SOUND_VOLUME_KEY = 'hungtran-pm-game-sound-volume';
export const DEFAULT_SOUND_VOLUME = 0.85;

export function readSoundMuted() {
  try {
    return localStorage.getItem(SOUND_MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function readSoundVolume() {
  try {
    const v = Number(localStorage.getItem(SOUND_VOLUME_KEY));
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : DEFAULT_SOUND_VOLUME;
  } catch {
    return DEFAULT_SOUND_VOLUME;
  }
}

export function writeSoundMuted(value) {
  try {
    localStorage.setItem(SOUND_MUTED_KEY, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function writeSoundVolume(value) {
  try {
    localStorage.setItem(SOUND_VOLUME_KEY, String(value));
  } catch {
    /* ignore */
  }
}
