import { toPng } from 'html-to-image';
import type { Colleague } from '../types';

/** Spotify Wrapped tops out at 5 — match that for visual rhythm and to keep
 *  the keepsake card from overflowing on a 9:16 frame. */
export const MAX_FEATURED_TRACKS = 5;

export interface SoundtrackTrack {
  name: string;
  artist: string;
  art: string;
  /** Stable dedupe + selection key. `name|artist`. */
  key: string;
}

/** Every slide with a song, deduped by name+artist. Same song on two slides
 *  collapses to one entry — the keepsake list reads as the *songs* on the
 *  deck, not the slide order. */
export function getSoundtrack(colleague: Colleague): SoundtrackTrack[] {
  const seen = new Set<string>();
  const out: SoundtrackTrack[] = [];
  for (const s of colleague.slides ?? []) {
    if (!s.songUrl || !s.songName) continue;
    const name = s.songName;
    const artist = s.songArtist ?? '';
    const key = `${name}|${artist}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, artist, art: s.songArt ?? '', key });
  }
  return out;
}

/** Apply the wrapped-finale's curation to the full soundtrack list:
 *  - `featuredKeys === undefined` → auto-pick first MAX_FEATURED_TRACKS
 *  - `featuredKeys === []` → user explicitly emptied the list (returns [])
 *  - non-empty → keep only those keys, capped at MAX_FEATURED_TRACKS,
 *    in the deck's natural order
 */
export function getFeaturedSoundtrack(
  colleague: Colleague,
  featuredKeys: string[] | undefined,
): SoundtrackTrack[] {
  const all = getSoundtrack(colleague);
  if (featuredKeys === undefined) {
    return all.slice(0, MAX_FEATURED_TRACKS);
  }
  const set = new Set(featuredKeys);
  return all.filter((t) => set.has(t.key)).slice(0, MAX_FEATURED_TRACKS);
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'wrapped';
}

/** Capture the card node as a PNG and trigger a download.
 *
 *  Fonts must be fully loaded before capture or the export silently falls back
 *  to system fonts (most likely thing to break — test on cold cache). */
export async function saveWrappedAsPng(card: HTMLElement, colleagueName: string): Promise<void> {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
  const dataUrl = await toPng(card, {
    pixelRatio: 3,
    backgroundColor: '#0a0a0a',
    cacheBust: true,
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return true;
      return !node.hasAttribute('data-html-to-image-ignore');
    },
  });
  const link = document.createElement('a');
  link.download = `wrapped-${slugify(colleagueName)}.png`;
  link.href = dataUrl;
  link.click();
}
