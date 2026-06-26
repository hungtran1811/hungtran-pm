import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '../state/settings.store.jsx';

/** Optional MP3 paths — falls back to Web Audio synthesis if load fails. */
export const GAME_SOUND_FILES = {
  tap: '/sounds/games/tap.mp3',
  tick: '/sounds/games/tick.mp3',
  stop: '/sounds/games/stop.mp3',
  reveal: '/sounds/games/reveal.mp3',
  win: '/sounds/games/win.mp3',
  cheer: '/sounds/games/cheer.mp3',
  buzz: '/sounds/games/buzz.mp3',
  spin: '/sounds/games/spin.mp3',
  'spin-stop': '/sounds/games/spin-stop.mp3',
};

function synthTone(ctx, dest, { freq = 440, duration = 0.08, type = 'sine', gain = 0.35, when = 0 }) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0001), when + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(g);
  g.connect(dest);
  osc.start(when);
  osc.stop(when + duration + 0.05);
}

function synthBuzz(ctx, dest, when = 0, gain = 0.28) {
  synthTone(ctx, dest, { freq: 120, duration: 0.35, type: 'sawtooth', gain, when });
  synthTone(ctx, dest, { freq: 80, duration: 0.28, type: 'square', gain: gain * 0.7, when: when + 0.06 });
}

function synthWin(ctx, dest, when = 0, gain = 0.32) {
  [523, 659, 784, 1047].forEach((freq, i) => {
    synthTone(ctx, dest, { freq, duration: 0.22, type: 'triangle', gain, when: when + i * 0.08 });
  });
}

function synthReveal(ctx, dest, when = 0, gain = 0.3) {
  synthTone(ctx, dest, { freq: 280, duration: 0.15, type: 'sine', gain, when });
  synthTone(ctx, dest, { freq: 420, duration: 0.18, type: 'sine', gain, when: when + 0.1 });
  synthTone(ctx, dest, { freq: 660, duration: 0.22, type: 'sine', gain, when: when + 0.2 });
}

function synthSuspense(ctx, dest, when = 0, gain = 0.15) {
  synthTone(ctx, dest, { freq: 180, duration: 0.4, type: 'triangle', gain, when });
  synthTone(ctx, dest, { freq: 240, duration: 0.35, type: 'sine', gain: gain * 0.8, when: when + 0.25 });
}

function synthSpin(ctx, dest, when = 0, duration = 0.35, gain = 0.18) {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const g = ctx.createGain();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, when);
  filter.frequency.exponentialRampToValueAtTime(2400, when + duration);
  g.gain.setValueAtTime(gain, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  src.buffer = buffer;
  src.connect(filter);
  filter.connect(g);
  g.connect(dest);
  src.start(when);
  src.stop(when + duration);
}

const SYNTH_LEVEL = 0.55;

const SYNTH_MAP = {
  tap: (ctx, dest, t) => synthTone(ctx, dest, { freq: 660, duration: 0.08, gain: SYNTH_LEVEL, when: t }),
  tick: (ctx, dest, t) => synthTone(ctx, dest, { freq: 920, duration: 0.05, type: 'triangle', gain: SYNTH_LEVEL * 0.7, when: t }),
  stop: (ctx, dest, t) => synthTone(ctx, dest, { freq: 220, duration: 0.22, type: 'triangle', gain: SYNTH_LEVEL, when: t }),
  reveal: (ctx, dest, t) => synthReveal(ctx, dest, t, SYNTH_LEVEL),
  win: (ctx, dest, t) => synthWin(ctx, dest, t, SYNTH_LEVEL),
  cheer: (ctx, dest, t) => synthWin(ctx, dest, t, SYNTH_LEVEL * 1.2),
  buzz: (ctx, dest, t) => synthBuzz(ctx, dest, t, SYNTH_LEVEL),
  spin: (ctx, dest, t) => synthSpin(ctx, dest, t, 0.5, SYNTH_LEVEL * 0.8),
  suspense: (ctx, dest, t) => synthSuspense(ctx, dest, t, SYNTH_LEVEL * 0.85),
  'spin-stop': (ctx, dest, t) => {
    synthTone(ctx, dest, { freq: 988, duration: 0.28, type: 'triangle', gain: SYNTH_LEVEL, when: t });
    synthTone(ctx, dest, { freq: 1319, duration: 0.32, type: 'sine', gain: SYNTH_LEVEL * 0.95, when: t + 0.08 });
  },
};

export function useGameSound() {
  const { muted, volume, setMuted, setVolume, toggleMuted } = useSettings();
  const ctxRef = useRef(null);
  const masterGainRef = useRef(null);
  const buffersRef = useRef({});
  const loopsRef = useRef({});
  const [ready, setReady] = useState(false);
  const unlockedRef = useRef(false);

  const ensureContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctxRef.current = new Ctx();
      masterGainRef.current = ctxRef.current.createGain();
      masterGainRef.current.connect(ctxRef.current.destination);
    }
    return ctxRef.current;
  }, []);

  const syncMasterGain = useCallback(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = muted ? 0 : volume;
    }
  }, [muted, volume]);

  useEffect(() => {
    syncMasterGain();
  }, [syncMasterGain]);

  const unlock = useCallback(async () => {
    const ctx = ensureContext();
    if (!ctx) return false;
    unlockedRef.current = true;
    syncMasterGain();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    const ok = ctx.state === 'running';
    if (ok) setReady(true);
    return ok;
  }, [ensureContext, syncMasterGain]);

  useEffect(() => {
    const ctx = ensureContext();
    if (!ctx) return undefined;

    Object.entries(GAME_SOUND_FILES).forEach(([id, src]) => {
      fetch(src)
        .then((res) => {
          if (!res.ok) throw new Error('missing');
          return res.arrayBuffer();
        })
        .then((buf) => ctx.decodeAudioData(buf))
        .then((decoded) => {
          buffersRef.current[id] = decoded;
        })
        .catch(() => {});
    });

    return () => {
      Object.values(loopsRef.current).forEach((entry) => {
        if (entry.interval) clearInterval(entry.interval);
        if (entry.source) {
          try {
            entry.source.stop();
          } catch {
            /* ignore */
          }
        }
      });
      loopsRef.current = {};
    };
  }, [ensureContext]);

  const stop = useCallback((id) => {
    const entry = loopsRef.current[id];
    if (!entry) return;
    if (entry.interval) clearInterval(entry.interval);
    if (entry.source) {
      try {
        entry.source.stop();
      } catch {
        /* ignore */
      }
    }
    delete loopsRef.current[id];
  }, []);

  useEffect(() => {
    if (!muted) return;
    Object.keys(loopsRef.current).forEach((sid) => stop(sid));
  }, [muted, stop]);

  const playBuffer = useCallback(
    (id, { loop = false } = {}) => {
      if (muted) return;
      const ctx = ensureContext();
      const dest = masterGainRef.current;
      if (!ctx || !dest) return;

      const buffer = buffersRef.current[id];
      if (buffer) {
        if (loop) {
          stop(id);
          const source = ctx.createBufferSource();
          const gain = ctx.createGain();
          source.buffer = buffer;
          source.loop = true;
          gain.gain.value = 1;
          source.connect(gain);
          gain.connect(dest);
          source.start();
          loopsRef.current[id] = { source, gain };
          return;
        }
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = buffer;
        gain.gain.value = 1;
        source.connect(gain);
        gain.connect(dest);
        source.start();
        return;
      }

      const synth = SYNTH_MAP[id];
      if (synth) {
        if (loop) {
          stop(id);
          const interval = setInterval(() => {
            if (muted) return;
            synth(ctx, dest, ctx.currentTime);
          }, 480);
          loopsRef.current[id] = { interval };
          synth(ctx, dest, ctx.currentTime);
          return;
        }
        synth(ctx, dest, ctx.currentTime);
      }
    },
    [ensureContext, muted, stop],
  );

  const play = useCallback(
    async (id) => {
      if (muted) return;
      if (!unlockedRef.current) {
        await unlock();
      }
      playBuffer(id, { loop: false });
    },
    [muted, unlock, playBuffer],
  );

  const playLoop = useCallback(
    async (id) => {
      if (muted) return;
      if (!unlockedRef.current) {
        await unlock();
      }
      playBuffer(id, { loop: true });
    },
    [muted, unlock, playBuffer],
  );

  const enableSound = useCallback(async () => {
    if (muted) setMuted(false);
    const ok = await unlock();
    if (ok) {
      playBuffer('tap');
    }
    return ok;
  }, [muted, unlock, setMuted, playBuffer]);

  return {
    muted,
    volume,
    ready,
    unlock,
    enableSound,
    play,
    playLoop,
    stop,
    setMuted,
    setVolume,
    toggleMuted,
  };
}
