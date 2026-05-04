export type SlideBg =
  | 'bg-pink'
  | 'bg-orange'
  | 'bg-teal'
  | 'bg-purple'
  | 'bg-yellow'
  | 'bg-green'
  | 'bg-blue'
  | 'bg-dark'
  | 'bg-cream';

export type SlideType =
  | 'intro'
  | 'stat'
  | 'photo'
  | 'quote'
  | 'podium'
  | 'letter'
  | 'mosaic'
  | 'orb-finale'
  | 'signoff';

export interface PodiumItem {
  name: string;
  count: string;
  /** Optional photo or video for this rank — see MediaItem below for shape. */
  media?: MediaItem;
}

export interface ItunesResult {
  trackName: string;
  artistName: string;
  previewUrl: string;
  artworkUrl60?: string;
  artworkUrl100?: string;
}

export interface SongFields {
  songUrl?: string;
  songName?: string;
  songArtist?: string;
  songArt?: string;
  songStart?: number;
  songDuration?: number;
}

export interface AdminTransientFields {
  showSongPicker?: boolean;
  songSearchQuery?: string;
  songSearchResults?: ItunesResult[];
  songSearching?: boolean;
}

export type FragmentType =
  | 'leaves'
  | 'bubbles'
  | 'snow'
  | 'sparkles'
  | 'confetti'
  | 'petals'
  | 'stars';

export type FragmentDensity = 'sparse' | 'medium' | 'dense';

export type FragmentPattern =
  | 'fall'
  | 'fall-slow'
  | 'flip-fall'
  | 'rise'
  | 'twinkle'
  | 'drift';

export type FragmentSource =
  | { kind: 'preset'; type: FragmentType }
  | { kind: 'image'; dataUrls: string[] };

export interface FragmentConfig {
  source: FragmentSource;
  pattern: FragmentPattern;
  density: FragmentDensity;
}

export type TextColor = 'light' | 'dark';

export type GradientShape = 'linear' | 'radial';

export interface PresetBg {
  kind: 'preset';
  preset: SlideBg;
}

export interface GradientBg {
  kind: 'gradient';
  from: string; // hex
  to: string; // hex
  angle: number; // 0-360
  shape: GradientShape;
  textColor: TextColor;
}

export interface LavaBlob {
  color: string; // hex
}

export type LavaSpeed = 'slow' | 'medium' | 'fast';

export interface LavaBg {
  kind: 'lava';
  baseColor: string; // hex
  blobs: LavaBlob[]; // 2-6
  speed: LavaSpeed;
  blur: number; // px, ~30-150
  textColor: TextColor;
}

export type BgConfig = PresetBg | GradientBg | LavaBg;

interface SlideBase extends SongFields, AdminTransientFields {
  bg: BgConfig;
  fragments?: FragmentConfig;
}

export interface IntroSlide extends SlideBase {
  type: 'intro';
  eyebrow?: string;
  title?: string;
  sub?: string;
}

export interface StatSlide extends SlideBase {
  type: 'stat';
  eyebrow?: string;
  bigNumber?: string;
  label?: string;
  sub?: string;
}

export interface PhotoSlide extends SlideBase {
  type: 'photo';
  eyebrow?: string;
  caption?: string;
  sub?: string;
  photoData?: string;
}

export interface QuoteSlide extends SlideBase {
  type: 'quote';
  eyebrow?: string;
  body?: string;
  attrib?: string;
}

export interface PodiumSlide extends SlideBase {
  type: 'podium';
  eyebrow?: string;
  title?: string;
  items?: PodiumItem[];
  sub?: string;
}

export interface LetterSlide extends SlideBase {
  type: 'letter';
  greeting?: string;
  body?: string;
  signoff?: string;
}

export type MediaItem =
  | { kind: 'image'; src: string }
  | { kind: 'video'; src: string };

export interface MosaicSlide extends SlideBase {
  type: 'mosaic';
  eyebrow?: string;
  title?: string;
  sub?: string;
  media?: MediaItem[];
  /** @deprecated Migrated to `media`. Kept on the type only so legacy data parses. */
  photos?: string[];
}

export interface SignoffSlide extends SlideBase {
  type: 'signoff';
  eyebrow?: string;
  title?: string;
  sub?: string;
}

/** Curated set of orb "looks" the admin can pick from. Each preset bundles a
 *  base polyhedron + subdivision level + a noise-amplitude multiplier so a
 *  single dropdown choice gives a coherent aesthetic, while sliders below let
 *  you fine-tune within that preset. Leaving `geometry` undefined in OrbConfig
 *  means "use the seed-derived auto pick" (one of classic/gem/rose). */
export type OrbGeometryPreset =
  | 'classic'   // soft icosahedron — closest to a perfect sphere with light noise
  | 'gem'       // octahedron — sharper N/S poles, gem-like
  | 'rose'      // dodecahedron — pentagonal, rounded crystal
  | 'diamond'   // low-detail octahedron with NO noise — sharp gemstone
  | 'crystal'   // low-detail icosahedron with strong noise — chunky lobes
  | 'smooth';   // high-detail icosahedron with very low noise — almost glassy

/** Per-slide overrides for the finale orb. Every field is optional — undefined
 *  means "fall back to the seed-derived default". This lets each colleague's
 *  orb stay deterministic out of the box, while letting Michael hand-tune the
 *  visual for any colleague who needs something specific. */
export interface OrbConfig {
  geometry?: OrbGeometryPreset;
  /** 0..0.20 — vertex displacement amount. 0 = perfectly geometric. */
  noiseAmplitude?: number;
  /** 0.5..3.0 — frequency of the displacement noise. Smaller = bigger lobes. */
  noiseScale?: number;
  /** -1..1 — vertical offset in 3D world units. Positive = orb sits higher. */
  orbY?: number;
  /** 2.5..7.0 — camera distance. Smaller = bigger orb in frame. */
  cameraZ?: number;
  /** 0..5000 — number of ambient particles around the orb. 0 disables. */
  particleCount?: number;
}

/** 3D generative finale orb. The visual is derived from the colleague's name
 *  (deterministic seed) + their photos (palette), with optional admin overrides
 *  in `orb` for fine-tuning per colleague. */
export interface OrbFinaleSlide extends SlideBase {
  type: 'orb-finale';
  orb?: OrbConfig;
}

export type Slide =
  | IntroSlide
  | StatSlide
  | PhotoSlide
  | QuoteSlide
  | PodiumSlide
  | LetterSlide
  | MosaicSlide
  | OrbFinaleSlide
  | SignoffSlide;

export interface Colleague {
  id: string;
  name: string;
  passwordHash: string;
  slides: Slide[];
}

export interface AppMeta {
  title: string;
  subtitle: string;
  farewellNote: string;
}

export interface AppData {
  meta: AppMeta;
  colleagues: Colleague[];
}
