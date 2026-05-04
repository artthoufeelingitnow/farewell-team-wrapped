import type {
  SlideBg,
  SlideType,
  FragmentType,
  FragmentDensity,
  FragmentPattern,
  LavaBg,
} from '../types';

export const STORAGE_KEY = 'goodbye_wrapped_data_v1';
export const DEFAULT_SLIDE_DURATION = 7000;
export const ITUNES_API = 'https://itunes.apple.com/search';
export const FADE_MS = 600;

export interface SlideTypeMeta {
  label: string;
  emoji: string;
  bg: SlideBg;
}

export const SLIDE_TYPES: Record<SlideType, SlideTypeMeta> = {
  intro: { label: 'Intro', emoji: '✨', bg: 'bg-pink' },
  stat: { label: 'Big stat', emoji: '📊', bg: 'bg-orange' },
  photo: { label: 'Photo', emoji: '📷', bg: 'bg-dark' },
  quote: { label: 'Quote', emoji: '💭', bg: 'bg-purple' },
  podium: { label: 'Top 3', emoji: '🏆', bg: 'bg-yellow' },
  letter: { label: 'Letter', emoji: '💌', bg: 'bg-cream' },
  mosaic: { label: 'Photos', emoji: '🧩', bg: 'bg-teal' },
  'orb-finale': { label: 'Orb', emoji: '🔮', bg: 'bg-dark' },
  signoff: { label: 'Sign off', emoji: '🫶', bg: 'bg-blue' },
};

/** Ordered list of background presets for the swatch picker. */
export const SLIDE_BG_OPTIONS: SlideBg[] = [
  'bg-pink',
  'bg-orange',
  'bg-yellow',
  'bg-green',
  'bg-teal',
  'bg-blue',
  'bg-purple',
  'bg-cream',
  'bg-dark',
];

export interface FragmentPreset {
  label: string;
  emoji: string;
}

export const FRAGMENT_PRESETS: Record<FragmentType, FragmentPreset> = {
  leaves: { label: 'Leaves', emoji: '🍂' },
  bubbles: { label: 'Bubbles', emoji: '🫧' },
  snow: { label: 'Snow', emoji: '❄️' },
  sparkles: { label: 'Sparkles', emoji: '✨' },
  confetti: { label: 'Confetti', emoji: '🎉' },
  petals: { label: 'Petals', emoji: '🌸' },
  stars: { label: 'Stars', emoji: '⭐' },
};

export const FRAGMENT_TYPE_ORDER: FragmentType[] = [
  'leaves',
  'petals',
  'snow',
  'bubbles',
  'sparkles',
  'stars',
  'confetti',
];

export const FRAGMENT_DENSITY_COUNTS: Record<FragmentDensity, number> = {
  sparse: 8,
  medium: 18,
  dense: 36,
};

/** Default movement pattern for each fragment preset (the visual that "fits" each emoji). */
export const DEFAULT_FRAGMENT_PATTERN_BY_TYPE: Record<FragmentType, FragmentPattern> = {
  leaves: 'fall',
  petals: 'fall-slow',
  snow: 'fall-slow',
  bubbles: 'rise',
  sparkles: 'twinkle',
  stars: 'twinkle',
  confetti: 'flip-fall',
};

export interface FragmentPatternMeta {
  label: string;
  hint: string;
}

export const FRAGMENT_PATTERNS: Record<FragmentPattern, FragmentPatternMeta> = {
  fall: { label: 'Fall', hint: 'Top → bottom, gentle drift' },
  'fall-slow': { label: 'Drift down', hint: 'Slower fall, more sway' },
  'flip-fall': { label: 'Confetti', hint: 'Falling + flipping' },
  rise: { label: 'Rise', hint: 'Bottom → top' },
  twinkle: { label: 'Twinkle', hint: 'Pulse in place' },
  drift: { label: 'Drift', hint: 'Wander across the screen' },
};

export const FRAGMENT_PATTERN_ORDER: FragmentPattern[] = [
  'fall',
  'fall-slow',
  'flip-fall',
  'rise',
  'twinkle',
  'drift',
];

/** Default Lava bg used when the user first switches to the Lava tab. */
export const DEFAULT_LAVA_BG: LavaBg = {
  kind: 'lava',
  baseColor: '#1a0a2e',
  blobs: [
    { color: '#FF6B9D' },
    { color: '#4ECDC4' },
    { color: '#FFC75F' },
  ],
  speed: 'medium',
  blur: 80,
  textColor: 'light',
};

export const LAVA_SPEED_DURATION_S: Record<'slow' | 'medium' | 'fast', number> = {
  slow: 30,
  medium: 18,
  fast: 10,
};

/** Approx hex → CSS gradient strings for each preset bg. Kept in sync with .bg-* classes
 *  in global.css so the renderer can produce inline styles without relying on classes. */
export const PRESET_BG_GRADIENTS: Record<SlideBg, { from: string; to: string; textColor: 'light' | 'dark' }> = {
  'bg-pink':   { from: '#FF6B9D', to: '#C9184A', textColor: 'light' },
  'bg-orange': { from: '#FF8C42', to: '#D32F2F', textColor: 'light' },
  'bg-teal':   { from: '#4ECDC4', to: '#1A535C', textColor: 'light' },
  'bg-purple': { from: '#B57EDC', to: '#5E2A8C', textColor: 'light' },
  'bg-yellow': { from: '#FFC75F', to: '#F39C12', textColor: 'dark' },
  'bg-green':  { from: '#06D6A0', to: '#115E47', textColor: 'light' },
  'bg-blue':   { from: '#4FC3F7', to: '#1E3A8A', textColor: 'light' },
  'bg-dark':   { from: '#1a1a1a', to: '#000000', textColor: 'light' },
  'bg-cream':  { from: '#FFF8E7', to: '#F5DEB3', textColor: 'dark' },
};
