import { useEffect, useState } from 'react';
import { getPaletteSync } from 'colorthief';
import type { Colleague } from '../../types';
import { PRESET_BG_GRADIENTS } from '../../utils/constants';

type RGB = [number, number, number];

/** Default palette used when no photos are available. Pulled from on-brand
 *  preset gradient endpoints to feel cohesive with the rest of the deck. */
const FALLBACK_HEX: string[] = [
  PRESET_BG_GRADIENTS['bg-pink'].from,
  PRESET_BG_GRADIENTS['bg-purple'].from,
  PRESET_BG_GRADIENTS['bg-blue'].to,
];

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

/** Slightly desaturate a raw photo color so the orb feels harmonious rather
 *  than dumping bright photo colors onto a 3D surface. Pulls each channel
 *  ~15% toward the mean. */
function harmonize(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const mean = (r + g + b) / 3;
  const blend = 0.15;
  return rgbToHex([
    Math.round(r * (1 - blend) + mean * blend),
    Math.round(g * (1 - blend) + mean * blend),
    Math.round(b * (1 - blend) + mean * blend),
  ]);
}

/** Pull every image source out of a colleague's slides — photoData on photo
 *  slides, image-kind media on mosaic + podium. Videos are skipped (we'd
 *  need to capture a frame; not worth the Phase 1 complexity). */
function collectPhotos(colleague: Colleague): string[] {
  const out: string[] = [];
  for (const slide of colleague.slides) {
    if (slide.type === 'photo' && slide.photoData) out.push(slide.photoData);
    else if (slide.type === 'mosaic' && slide.media) {
      for (const m of slide.media) if (m.kind === 'image') out.push(m.src);
    } else if (slide.type === 'podium' && slide.items) {
      for (const item of slide.items) {
        if (item.media?.kind === 'image') out.push(item.media.src);
      }
    }
  }
  return out;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export interface OrbPalette {
  /** 3-5 hex strings, dominant first. */
  hex: string[];
  /** True until images have finished loading and palette is extracted. */
  loading: boolean;
}

/**
 * Extract a small color palette from a colleague's photos using ColorThief
 * (sync browser API), then harmonize the swatches so they don't clash with
 * the orb's matte/metallic shading. Falls back to a brand-tinted palette
 * when no photos exist.
 */
export function usePalette(colleague: Colleague): OrbPalette {
  const [palette, setPalette] = useState<OrbPalette>({ hex: [], loading: true });

  useEffect(() => {
    let cancelled = false;
    const photos = collectPhotos(colleague);

    if (photos.length === 0) {
      setPalette({ hex: FALLBACK_HEX.map(harmonize), loading: false });
      return;
    }

    Promise.all(photos.slice(0, 6).map((src) => loadImage(src).catch(() => null)))
      .then((images) => {
        if (cancelled) return;
        const all: string[] = [];
        for (const img of images) {
          if (!img) continue;
          try {
            const swatches = getPaletteSync(img, { colorCount: 4, quality: 10 });
            if (swatches) {
              for (const c of swatches) all.push(c.hex());
            }
          } catch {
            // ColorThief throws on tiny / single-color images — skip.
          }
        }
        if (all.length === 0) {
          setPalette({ hex: FALLBACK_HEX.map(harmonize), loading: false });
          return;
        }
        // Up to 5 swatches, harmonized.
        setPalette({ hex: all.slice(0, 5).map(harmonize), loading: false });
      })
      .catch(() => {
        if (cancelled) return;
        setPalette({ hex: FALLBACK_HEX.map(harmonize), loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, [colleague]);

  return palette;
}
