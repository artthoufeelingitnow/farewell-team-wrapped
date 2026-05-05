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
  | 'wrapped-finale'
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
  media?: MediaItem;
  /** @deprecated Migrated to `media`. Kept on the type only so legacy data parses. */
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

/** Curated finale slide. Reads from the colleague's `spiritAnimal*` fields and
 *  derives the soundtrack list from the rest of their slides at render time. */
export interface WrappedFinaleSlide extends SlideBase {
  type: 'wrapped-finale';
  /** Curated subset of soundtrack tracks to feature on the keepsake card.
   *  Each entry is a `name|artist` key matching the dedupe key used by
   *  `getSoundtrack()`. Capped at 5. When `undefined`, the view auto-picks
   *  the first 5 songs from the deck (preserves zero-config behavior). */
  featuredTrackKeys?: string[];
}

export type Slide =
  | IntroSlide
  | StatSlide
  | PhotoSlide
  | QuoteSlide
  | PodiumSlide
  | LetterSlide
  | MosaicSlide
  | WrappedFinaleSlide
  | SignoffSlide;

export interface Colleague {
  id: string;
  name: string;
  passwordHash: string;
  slides: Slide[];
  /** Curated by Michael per colleague — drives the wrapped-finale slide.
   *  All three should be set together; missing data triggers a placeholder.
   *  Media supports image (incl. animated GIF as base64) or video (URL,
   *  same `public/videos/` pattern as mosaic/podium media). */
  spiritAnimalMedia?: MediaItem;
  spiritAnimalName?: string;
  spiritAnimalTagline?: string;
  /** Crop position within the circular slot, expressed as `object-position`
   *  percentages on each axis (0–100). Default 50/50 = centered.
   *  Resets to default whenever the media changes. */
  spiritAnimalPosition?: { x: number; y: number };
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
