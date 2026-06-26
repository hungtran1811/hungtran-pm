import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  computeScoreTone,
  computeUnderstandingDotClass,
  computeUnderstandingTone,
  DEFAULT_SCORING,
} from '../lib/scoringThresholds.js';
import {
  readSoundMuted,
  readSoundVolume,
  writeSoundMuted,
  writeSoundVolume,
} from '../lib/soundPrefs.js';

const SettingsContext = createContext({
  muted: false,
  volume: 0.85,
  setMuted: () => {},
  setVolume: () => {},
  toggleMuted: () => {},
  scoreTone: () => 'slate',
  understandingTone: () => 'slate',
  understandingDotClass: () => 'bg-slate-200 dark:bg-slate-700',
});

export function SettingsProvider({ children }) {
  const [muted, setMutedState] = useState(readSoundMuted);
  const [volume, setVolumeState] = useState(readSoundVolume);

  const setMuted = useCallback((value) => {
    setMutedState(value);
    writeSoundMuted(value);
  }, []);

  const setVolume = useCallback((value) => {
    const v = Math.max(0, Math.min(1, value));
    setVolumeState(v);
    writeSoundVolume(v);
  }, []);

  const toggleMuted = useCallback(() => {
    setMutedState((prev) => {
      const next = !prev;
      writeSoundMuted(next);
      return next;
    });
  }, []);

  const scoreTone = useCallback((percent) => computeScoreTone(percent, DEFAULT_SCORING), []);
  const understandingTone = useCallback(
    (level) => computeUnderstandingTone(level, DEFAULT_SCORING),
    [],
  );
  const understandingDotClass = useCallback(
    (n, level) => computeUnderstandingDotClass(n, level, DEFAULT_SCORING),
    [],
  );

  const value = useMemo(
    () => ({
      muted,
      volume,
      setMuted,
      setVolume,
      toggleMuted,
      scoreTone,
      understandingTone,
      understandingDotClass,
    }),
    [
      muted,
      volume,
      setMuted,
      setVolume,
      toggleMuted,
      scoreTone,
      understandingTone,
      understandingDotClass,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
