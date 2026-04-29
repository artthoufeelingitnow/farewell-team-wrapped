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
  | 'signoff';

export interface PodiumItem {
  name: string;
  count: string;
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

interface SlideBase extends SongFields, AdminTransientFields {
  bg: SlideBg;
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

export interface MosaicSlide extends SlideBase {
  type: 'mosaic';
  eyebrow?: string;
  title?: string;
  sub?: string;
  photos?: string[];
}

export interface SignoffSlide extends SlideBase {
  type: 'signoff';
  eyebrow?: string;
  title?: string;
  sub?: string;
}

export type Slide =
  | IntroSlide
  | StatSlide
  | PhotoSlide
  | QuoteSlide
  | PodiumSlide
  | LetterSlide
  | MosaicSlide
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
