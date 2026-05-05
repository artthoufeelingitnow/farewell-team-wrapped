import type {
  Slide,
  SlideType,
  Colleague,
  AppData,
  BgConfig,
  GradientBg,
  FragmentConfig,
  FragmentType,
  SlideBg,
  MediaItem,
  SpiritAnimalSlide,
  SoundtrackSlide,
} from '../types';
import {
  SLIDE_TYPES,
  DEFAULT_SLIDE_DURATION,
  DEFAULT_FRAGMENT_PATTERN_BY_TYPE,
  PRESET_BG_GRADIENTS,
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

/** Convert a legacy preset name to an editable gradient using the matching colors. */
export function gradientFromPreset(preset: SlideBg): GradientBg {
  const g = PRESET_BG_GRADIENTS[preset] ?? PRESET_BG_GRADIENTS['bg-dark'];
  return {
    kind: 'gradient',
    from: g.from,
    to: g.to,
    angle: 135,
    shape: 'linear',
    textColor: g.textColor,
  };
}

export function makeDefaultSlide(type: SlideType, name: string): Slide {
  const t = SLIDE_TYPES[type];
  const bg: BgConfig = { kind: 'preset', preset: t.bg };
  switch (type) {
    case 'intro':
      return { type, bg, eyebrow: 'For ' + (name || ''), title: 'A wrapped, just for you', sub: '' };
    case 'stat':
      return { type, bg, eyebrow: 'Together we...', bigNumber: '', label: '', sub: '' };
    case 'photo':
      return { type, bg, eyebrow: 'A moment', caption: '', sub: '' };
    case 'quote':
      return { type, bg, eyebrow: '', body: '', attrib: '' };
    case 'podium':
      return {
        type,
        bg,
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
      return { type, bg, greeting: (name || 'Friend') + ',', body: '', signoff: '— Michael' };
    case 'mosaic':
      return { type, bg, eyebrow: 'Memories', title: '', sub: '', media: [] };
    case 'spirit-animal':
      return { type, bg };
    case 'soundtrack':
      return { type, bg };
    case 'signoff':
      return { type, bg, eyebrow: 'Until next time', title: 'Thank you', sub: '' };
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
  // The keepsake slides need a longer default so the user has time to tap
  // "Save" before auto-advance.
  if (slide?.type === 'spirit-animal' || slide?.type === 'soundtrack') {
    return slide.songDuration ?? 30000;
  }
  return slide?.songDuration ?? DEFAULT_SLIDE_DURATION;
}

// ============================================================
// Migration — coerce older data shapes (string bg, old fragments) into the
// current discriminated unions. Idempotent: applies cleanly whether data is
// old, new, or partially-shaped.
// ============================================================

const VALID_FRAGMENT_TYPES = new Set<FragmentType>([
  'leaves',
  'bubbles',
  'snow',
  'sparkles',
  'confetti',
  'petals',
  'stars',
]);

const VALID_BG_KINDS = new Set(['preset', 'gradient', 'lava']);

function migrateBg(bg: unknown): BgConfig {
  // Legacy: bare string preset name
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

/** Per-slide field migrations (bg, fragments, mosaic photos, photo photoData).
 *  Does NOT change the slide's `type` field — type-level migrations (e.g.
 *  splitting wrapped-finale into spirit-animal + soundtrack) live in
 *  `migrateColleague` because they're one-to-many. */
function migrateSlideFields(slide: unknown): Record<string, unknown> {
  const raw = slide as Record<string, unknown>;
  const migrated: Record<string, unknown> = {
    ...raw,
    bg: migrateBg(raw.bg),
  };
  const f = migrateFragments(raw.fragments);
  if (f) migrated.fragments = f;
  else delete migrated.fragments;

  // Mosaic legacy: photos: string[] → media: { kind: 'image', src }[]
  if (raw.type === 'mosaic') {
    const existingMedia = Array.isArray(raw.media) ? (raw.media as unknown[]) : null;
    const legacyPhotos = Array.isArray(raw.photos) ? (raw.photos as string[]) : null;
    if (!existingMedia && legacyPhotos) {
      migrated.media = legacyPhotos
        .filter((s) => typeof s === 'string')
        .map((src) => ({ kind: 'image', src }));
    }
    delete migrated.photos;
  }

  // Photo legacy: photoData: string → media: { kind: 'image', src }
  if (raw.type === 'photo') {
    const existingMedia = raw.media;
    const legacyPhotoData = raw.photoData;
    if (!existingMedia && typeof legacyPhotoData === 'string' && legacyPhotoData) {
      migrated.media = { kind: 'image', src: legacyPhotoData };
    }
    delete migrated.photoData;
  }

  // Drop the obsolete orb config blob — both orb-finale and wrapped-finale
  // slides will get fully reshaped in migrateColleague.
  if (raw.type === 'orb-finale' || raw.type === 'wrapped-finale') {
    delete migrated.orb;
  }

  // Soundtrack slides used to have a single `title` field that rendered as the
  // small-caps eyebrow. Promote it to `eyebrow` so the new `title` slot can be
  // used for the optional display-font title below.
  if (raw.type === 'soundtrack') {
    if (typeof raw.title === 'string' && raw.eyebrow === undefined) {
      migrated.eyebrow = raw.title;
      delete migrated.title;
    }
  }

  // Spirit-animal slides used to have a `name` field per section (rendered
  // above the media). The schema dropped it — the slide-level `title` now
  // carries the spirit-animal name. If the slide has no custom title yet,
  // promote the first non-empty section name (left preferred) into title.
  // Then strip `name` from each section regardless.
  if (raw.type === 'spirit-animal') {
    const left = raw.left as Record<string, unknown> | undefined;
    const right = raw.right as Record<string, unknown> | undefined;
    const promoted =
      (typeof left?.name === 'string' && left.name) ||
      (typeof right?.name === 'string' && right.name) ||
      '';
    if (promoted && (typeof migrated.title !== 'string' || !migrated.title)) {
      migrated.title = promoted;
    }
    if (left && 'name' in left) {
      const cleaned: Record<string, unknown> = { ...left };
      delete cleaned.name;
      migrated.left = cleaned;
    }
    if (right && 'name' in right) {
      const cleaned: Record<string, unknown> = { ...right };
      delete cleaned.name;
      migrated.right = cleaned;
    }
  }

  return migrated;
}

const SONG_FIELD_KEYS = ['songUrl', 'songName', 'songArtist', 'songArt', 'songStart', 'songDuration'];

export function migrateAppData(data: AppData | undefined | null): AppData {
  const safe = (data ?? {}) as Partial<AppData>;
  return {
    meta: safe.meta ?? { title: 'For You', subtitle: '', farewellNote: '' },
    colleagues: (safe.colleagues ?? []).map((c) => migrateColleague(c)),
  };
}

/** Migrates one colleague + their slides. Handles two slide-type-level
 *  migrations that produce more slides than they take in:
 *  - `orb-finale` (legacy 3D orb)        → `[spirit-animal, soundtrack]`
 *  - `wrapped-finale` (single keepsake)  → `[spirit-animal, soundtrack]`
 *  Legacy colleague-level spirit animal fields (`spiritAnimalMedia/Name/...`)
 *  are lifted onto the LEFT section of the FIRST migrated spirit-animal
 *  slide for the colleague, then the colleague-level fields are stripped. */
function migrateColleague(c: Colleague): Colleague {
  const raw = c as unknown as Record<string, unknown>;

  // Pull legacy colleague-level spirit animal data (any vintage of it).
  let legacyMedia: MediaItem | undefined;
  if (raw.spiritAnimalMedia && typeof raw.spiritAnimalMedia === 'object') {
    legacyMedia = raw.spiritAnimalMedia as MediaItem;
  } else if (typeof raw.spiritAnimalImage === 'string' && raw.spiritAnimalImage) {
    legacyMedia = { kind: 'image', src: raw.spiritAnimalImage };
  }
  const legacyName = typeof raw.spiritAnimalName === 'string' ? raw.spiritAnimalName : undefined;
  const legacyTagline = typeof raw.spiritAnimalTagline === 'string' ? raw.spiritAnimalTagline : undefined;
  const legacyPosition =
    raw.spiritAnimalPosition && typeof raw.spiritAnimalPosition === 'object'
      ? (raw.spiritAnimalPosition as { x: number; y: number })
      : undefined;
  let consumedLegacyAnimal = false;

  const outSlides: Slide[] = [];
  for (const s of c.slides ?? []) {
    const m = migrateSlideFields(s);
    const t = m.type as string;

    if (t === 'orb-finale' || t === 'wrapped-finale') {
      // First half: spirit-animal slide. Inherits bg + fragments + song
      // fields from the source. Picks up legacy colleague-level spirit
      // animal data on the LEFT section (first wrapped slide only).
      const sa: SpiritAnimalSlide = {
        type: 'spirit-animal',
        bg: m.bg as BgConfig,
      };
      if (m.fragments) sa.fragments = m.fragments as FragmentConfig;
      for (const k of SONG_FIELD_KEYS) {
        if (m[k] !== undefined) (sa as unknown as Record<string, unknown>)[k] = m[k];
      }
      if (!consumedLegacyAnimal) {
        const left: NonNullable<SpiritAnimalSlide['left']> = {};
        if (legacyMedia) left.media = legacyMedia;
        if (legacyPosition) left.mediaPosition = legacyPosition;
        if (Object.keys(left).length > 0) sa.left = left;
        // Legacy colleague-level spirit-animal name (e.g. "The Otter") now
        // lives on the slide as the title, since per-section names are gone.
        if (legacyName) sa.title = legacyName;
        if (legacyTagline) sa.tagline = legacyTagline;
        consumedLegacyAnimal = true;
      }

      // Second half: soundtrack slide. Just bg + featuredTrackKeys.
      const sound: SoundtrackSlide = {
        type: 'soundtrack',
        bg: m.bg as BgConfig,
      };
      if (Array.isArray(m.featuredTrackKeys)) {
        sound.featuredTrackKeys = m.featuredTrackKeys as string[];
      }

      outSlides.push(sa, sound);
    } else {
      outSlides.push(m as unknown as Slide);
    }
  }

  return {
    id: c.id,
    name: c.name,
    passwordHash: c.passwordHash,
    slides: outSlides,
  };
}
