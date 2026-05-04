import { useMemo } from 'react';

/** Deterministic 32-bit hash of a string. Same input always produces the same
 *  number, so an orb's randomized parameters stay stable across renders. */
function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export interface OrbSeed {
  /** Raw integer hash. */
  raw: number;
  /** 0..1 deterministic value derived from the hash. */
  norm: number;
  /** Hue offset in degrees (0..360) for color tweaking. */
  hueOffset: number;
  /** A second 0..1 value for any other randomized property (e.g. rotation start). */
  norm2: number;
  /** Initial Y rotation phase (0..2π). */
  rotationStart: number;
}

/**
 * Hashes a colleague's name into a stable bag of derived values used to
 * parameterize the orb. Same name → same orb.
 */
export function useOrbSeed(name: string): OrbSeed {
  return useMemo(() => {
    const raw = hashName(name || 'guest');
    const norm = (raw % 10000) / 10000;
    const norm2 = ((raw >> 8) % 10000) / 10000;
    return {
      raw,
      norm,
      norm2,
      hueOffset: raw % 360,
      rotationStart: norm * Math.PI * 2,
    };
  }, [name]);
}
