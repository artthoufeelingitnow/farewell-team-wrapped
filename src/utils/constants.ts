import type { SlideBg, SlideType } from '../types';

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
  signoff: { label: 'Sign off', emoji: '🫶', bg: 'bg-blue' },
};
