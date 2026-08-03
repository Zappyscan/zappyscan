import { useEffect, useRef, useCallback } from "react";

/**
 * Play a restaurant-style 3-rising-tone notification using Web Audio API.
 * No external file needed — tones are generated programmatically.
 */
function playAlarmBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Resume suspended context (happens after user interaction rules kick in)
    if (ctx.state === "suspended") ctx.resume();

    // 3 ascending tones: E5 → A5 → C#6
    const tones = [659, 880, 1109];
    tones.forEach((freq, i) => {
      const delay = i * 0.2;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.value = freq;

      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.45, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.start(t);
      osc.stop(t + 0.22);
    });

    // Release context after tones finish
    setTimeout(() => ctx.close().catch(() => {}), 2500);
  } catch {
    // AudioContext not supported — silently skip
  }
}

/**
 * Rings an alarm while pendingCount > 0.
 *
 * - Plays immediately when pendingCount first becomes > 0
 * - Re-rings every 5 s while still > 0
 * - Auto-resets mute when a NEW order arrives (count increases)
 * - Returns `mute()` so the UI can silence it without requiring accept/reject
 */
export function useOrderAlarm(pendingCount: number) {
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const mutedRef     = useRef(false);
  const prevCountRef = useRef(0);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startInterval = useCallback(() => {
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        if (!mutedRef.current) playAlarmBeep();
      }, 5000);
    }
  }, []);

  useEffect(() => {
    if (pendingCount > 0) {
      // New order arrived → reset mute so alarm plays
      if (pendingCount > prevCountRef.current) {
        mutedRef.current = false;
      }

      if (!mutedRef.current) {
        playAlarmBeep();
        startInterval();
      }
    } else {
      // No more pending orders — stop alarm entirely
      mutedRef.current = false;
      stopInterval();
    }

    prevCountRef.current = pendingCount;
  }, [pendingCount, startInterval, stopInterval]);

  // Cleanup on unmount
  useEffect(() => () => stopInterval(), [stopInterval]);

  /** Silence the alarm (keeps playing again if a NEW order arrives) */
  const mute = useCallback(() => {
    mutedRef.current = true;
    stopInterval();
  }, [stopInterval]);

  return { mute };
}
