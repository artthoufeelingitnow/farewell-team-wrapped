/**
 * Plays a brief, pleasant chime via Web Audio when a save completes — three
 * sine voices in an A-major chord shape (A5 + E6 + A6) layered slightly so
 * they shimmer rather than pulse. No audio asset required.
 *
 * Audio is non-essential: any failure (AudioContext blocked, suspended, etc.)
 * is swallowed silently — the save itself still works.
 */
export function playSaveChime(): void {
  try {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    const playNote = (freq: number, startOffset: number, gainPeak: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = now + startOffset;
      // Quick attack, slow exponential decay — bell-like envelope.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
      osc.start(start);
      osc.stop(start + 0.75);
    };

    playNote(880, 0, 0.18); // A5
    playNote(1318.5, 0.01, 0.12); // E6
    playNote(1760, 0.02, 0.08); // A6

    // Close the context after the notes have decayed so it doesn't leak.
    window.setTimeout(() => {
      void ctx.close();
    }, 1000);
  } catch {
    /* swallow — the chime is decorative */
  }
}
