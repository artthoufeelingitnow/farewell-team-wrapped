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

/** 3D generative finale orb. Visual is fully derived from the colleague's
 *  name (deterministic seed) + their photos (extracted color palette), so
 *  no per-slide editable content fields are needed. */
export interface OrbFinaleSlide extends SlideBase {
  type: 'orb-finale';
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
