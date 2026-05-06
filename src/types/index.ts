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
  | 'spirit-animal'
  | 'soundtrack'
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

/** A single section within a SpiritAnimalSlide — left or right column.
 *  Each holds its own media, crop position, and caption. The slide-level
 *  `title` carries the spirit animal name (which used to live per-section). */
export interface SpiritAnimalSection {
  media?: MediaItem;
  /** `object-position` percentages 0–100. Default 50/50. Resets when media changes. */
  mediaPosition?: { x: number; y: number };
  caption?: string;
}

/** Font choice for keepsake card titles. 'display' = Jua (default), 'spotify' =
 *  Montserrat 900 lowercase, Spotify-Wrapped style. */
export type TitleFontKind = 'display' | 'spotify';

/** Two-column keepsake card: side-by-side media slots with optional captions,
 *  plus a slide-level eyebrow + title and a tagline + optional caption at the
 *  bottom. Saveable as a PNG via the html-to-image flow. */
export interface SpiritAnimalSlide extends SlideBase {
  type: 'spirit-animal';
  /** Small-caps eyebrow rendered above the title.
   *  Default: "this is you if you were a cat...". */
  eyebrow?: string;
  /** Display-font title at the top of the card. Empty = no title rendered. */
  title?: string;
  /** Font style for the title. */
  titleFont?: TitleFontKind;
  left?: SpiritAnimalSection;
  right?: SpiritAnimalSection;
  tagline?: string;
  /** Optional small caption rendered under the tagline. */
  caption?: string;
}

/** Soundtrack keepsake card: user-customizable title + the deck's track list. */
export interface SoundtrackSlide extends SlideBase {
  type: 'soundtrack';
  /** Small-caps eyebrow at the top of the card. Default "your soundtrack". */
  eyebrow?: string;
  /** Optional display-font title rendered just below the eyebrow.
   *  Empty string / undefined = no title rendered. */
  title?: string;
  /** Font style for the title. */
  titleFont?: TitleFontKind;
  /** Curated subset of soundtrack tracks. Each entry is a `name|artist` key
   *  matching `getSoundtrack()`'s dedupe. Capped at 5. `undefined` = auto-pick. */
  featuredTrackKeys?: string[];
  /** Optional italic tagline rendered at the bottom of the card. */
  tagline?: string;
}

export type Slide =
  | IntroSlide
  | StatSlide
  | PhotoSlide
  | QuoteSlide
  | PodiumSlide
  | LetterSlide
  | MosaicSlide
  | SpiritAnimalSlide
  | SoundtrackSlide
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
