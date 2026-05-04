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

import type { OrbGeometryPreset } from '../../types';

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
  /** Default noise frequency (small = big lobes). Admin can override. */
  noiseScale: number;
  /** Default noise amplitude (vertex push). Admin can override. */
  noiseAmplitude: number;
  /** Auto-picked geometry preset for this colleague. The admin slide config
   *  can override this with any preset (incl. ones the auto-pick won't use). */
  geometryPreset: OrbGeometryPreset;
}

/**
 * Hashes a colleague's name into a stable bag of derived values used to
 * parameterize the orb. Same name → same orb.
 */
/** The auto-picker only uses the three "natural" presets (classic/gem/rose) so
 *  every colleague gets a coherent orb out of the box. The exotic presets
 *  (diamond/crystal/smooth) require an admin opt-in via OrbConfig.geometry. */
const AUTO_PRESETS: OrbGeometryPreset[] = ['classic', 'gem', 'rose'];

export function useOrbSeed(name: string): OrbSeed {
  return useMemo(() => {
    const raw = hashName(name || 'guest');
    const norm = (raw % 10000) / 10000;
    const norm2 = ((raw >> 8) % 10000) / 10000;
    const norm3 = ((raw >> 16) % 10000) / 10000;
    return {
      raw,
      norm,
      norm2,
      hueOffset: raw % 360,
      rotationStart: norm * Math.PI * 2,
      noiseScale: 0.8 + norm3 * 0.8,
      noiseAmplitude: 0.04 + norm2 * 0.05,
      geometryPreset: AUTO_PRESETS[raw % AUTO_PRESETS.length]!,
    };
  }, [name]);
}
