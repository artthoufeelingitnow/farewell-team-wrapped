import type { Slide, SlideType, Colleague } from '../types';
import { SLIDE_TYPES, DEFAULT_SLIDE_DURATION } from './constants';

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
      return { type, bg: t.bg, eyebrow: 'For ' + (name || ''), title: 'A wrapped, just for you', sub: '' };
    case 'stat':
      return { type, bg: t.bg, eyebrow: 'Together we...', bigNumber: '', label: '', sub: '' };
    case 'photo':
      return { type, bg: t.bg, eyebrow: 'A moment', caption: '', sub: '', photoData: '' };
    case 'quote':
      return { type, bg: t.bg, eyebrow: '', body: '', attrib: '' };
    case 'podium':
      return {
        type,
        bg: t.bg,
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
      return { type, bg: t.bg, greeting: (name || 'Friend') + ',', body: '', signoff: '— Michael' };
    case 'mosaic':
      return { type, bg: t.bg, eyebrow: 'Memories', title: '', sub: '', photos: [] };
    case 'signoff':
      return { type, bg: t.bg, eyebrow: 'Until next time', title: 'Thank you', sub: '' };
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
