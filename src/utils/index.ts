import type {
  Slide,
  SlideType,
  Colleague,
  AppData,
  BgConfig,
  FragmentConfig,
  FragmentType,
  SlideBg,
} from '../types';
import {
  SLIDE_TYPES,
  DEFAULT_SLIDE_DURATION,
  DEFAULT_FRAGMENT_PATTERN_BY_TYPE,
} from './constants';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (e) => resolve(e.target?.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function compressImage(dataUrl: string, maxDim = 900): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width *= ratio;
        height *= ratio;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function makeDefaultSlide(type: SlideType, name: string): Slide {
  const t = SLIDE_TYPES[type];
  switch (type) {
    case 'intro':
      return { type, bg: { kind: 'preset', preset: t.bg }, eyebrow: 'For ' + (name || ''), title: 'A wrapped, just for you', sub: '' };
    case 'stat':
      return { type, bg: { kind: 'preset', preset: t.bg }, eyebrow: 'Together we...', bigNumber: '', label: '', sub: '' };
    case 'photo':
      return { type, bg: { kind: 'preset', preset: t.bg }, eyebrow: 'A moment', caption: '', sub: '', photoData: '' };
    case 'quote':
      return { type, bg: { kind: 'preset', preset: t.bg }, eyebrow: '', body: '', attrib: '' };
    case 'podium':
      return {
        type,
        bg: { kind: 'preset', preset: t.bg },
        eyebrow: '',
        title: '',
        items: [
          { name: '', count: '' },
          { name: '', count: '' },
          { name: '', count: '' },
        ],
        sub: '',
      };
    case 'letter':
      return { type, bg: { kind: 'preset', preset: t.bg }, greeting: (name || 'Friend') + ',', body: '', signoff: '— Michael' };
    case 'mosaic':
      return { type, bg: { kind: 'preset', preset: t.bg }, eyebrow: 'Memories', title: '', sub: '', photos: [] };
    case 'signoff':
      return { type, bg: { kind: 'preset', preset: t.bg }, eyebrow: 'Until next time', title: 'Thank you', sub: '' };
  }
}

const TRANSIENT_FIELDS: (keyof Slide)[] = [
  'showSongPicker',
  'songSearchQuery',
  'songSearchResults',
  'songSearching',
];

export function stripTransientFields(slide: Slide): Slide {
  const cleaned = { ...slide };
  for (const f of TRANSIENT_FIELDS) {
    delete (cleaned as Record<string, unknown>)[f];
  }
  return cleaned;
}

export function cleanColleagueForExport(c: Colleague): Colleague {
  return {
    id: c.id,
    name: c.name,
    passwordHash: c.passwordHash,
    slides: (c.slides || []).map(stripTransientFields),
  };
}

export function getSlideDuration(slide: Slide | undefined): number {
  return slide?.songDuration ?? DEFAULT_SLIDE_DURATION;
}

// ============================================================
// Migration — coerce older data shapes (string bg, old fragments) into the
// current discriminated unions. Idempotent: applies cleanly whether data is
// old, new, or partially-shaped.
// ============================================================

const VALID_BG_KINDS = new Set(['preset', 'gradient', 'lava']);
const VALID_FRAGMENT_TYPES = new Set<FragmentType>([
  'leaves',
  'bubbles',
  'snow',
  'sparkles',
  'confetti',
  'petals',
  'stars',
]);

function migrateBg(bg: unknown): BgConfig {
  if (typeof bg === 'string') {
    return { kind: 'preset', preset: bg as SlideBg };
  }
  if (bg && typeof bg === 'object') {
    const obj = bg as Record<string, unknown>;
    if (typeof obj.kind === 'string' && VALID_BG_KINDS.has(obj.kind)) {
      return obj as unknown as BgConfig;
    }
  }
  return { kind: 'preset', preset: 'bg-dark' };
}

function migrateFragments(fragments: unknown): FragmentConfig | undefined {
  if (!fragments || typeof fragments !== 'object') return undefined;
  const f = fragments as Record<string, unknown>;

  // Already migrated — has a `source` discriminator. Also coerce single image
  // shape (`dataUrl: string`) to the array shape.
  if (f.source && typeof f.source === 'object') {
    const src = f.source as Record<string, unknown>;
    if (src.kind === 'image' && typeof src.dataUrl === 'string' && !Array.isArray(src.dataUrls)) {
      return {
        ...(f as unknown as FragmentConfig),
        source: { kind: 'image', dataUrls: [src.dataUrl] },
      };
    }
    return f as unknown as FragmentConfig;
  }

  // Old shape: `{ type, density }` — wrap into the new discriminated source.
  if (typeof f.type === 'string' && VALID_FRAGMENT_TYPES.has(f.type as FragmentType)) {
    const type = f.type as FragmentType;
    return {
      source: { kind: 'preset', type },
      pattern: DEFAULT_FRAGMENT_PATTERN_BY_TYPE[type],
      density: (f.density as FragmentConfig['density']) ?? 'medium',
    };
  }

  return undefined;
}

export function migrateSlide(slide: unknown): Slide {
  const raw = slide as Record<string, unknown>;
  const migrated: Record<string, unknown> = {
    ...raw,
    bg: migrateBg(raw.bg),
  };
  const f = migrateFragments(raw.fragments);
  if (f) migrated.fragments = f;
  else delete migrated.fragments;
  return migrated as unknown as Slide;
}

export function migrateAppData(data: AppData | undefined | null): AppData {
  const safe = (data ?? {}) as Partial<AppData>;
  return {
    meta: safe.meta ?? { title: 'For You', subtitle: '', farewellNote: '' },
    colleagues: (safe.colleagues ?? []).map((c) => ({
      ...c,
      slides: (c.slides ?? []).map(migrateSlide),
    })),
  };
}
