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
 *  - `featuredKeys === undefined` → auto-pick first MAX_FEATURED_TRACKS in deck order
 *  - `featuredKeys === []` → user explicitly emptied the list (returns [])
 *  - non-empty → render in the order specified by `featuredKeys`, capped at
 *    MAX_FEATURED_TRACKS. Orphan keys (songs renamed/removed elsewhere) are
 *    silently skipped so the slide stays in sync with the live song list.
 */
export function getFeaturedSoundtrack(
  colleague: Colleague,
  featuredKeys: string[] | undefined,
): SoundtrackTrack[] {
  const all = getSoundtrack(colleague);
  if (featuredKeys === undefined) {
    return all.slice(0, MAX_FEATURED_TRACKS);
  }
  const byKey = new Map(all.map((t) => [t.key, t]));
  const out: SoundtrackTrack[] = [];
  for (const k of featuredKeys) {
    const t = byKey.get(k);
    if (t) out.push(t);
    if (out.length >= MAX_FEATURED_TRACKS) break;
  }
  return out;
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'wrapped';
}

/** Capture the card node as a PNG. On mobile, hand the PNG to the OS share
 *  sheet so the user gets "Save to Photos" / "Save to Gallery" options. On
 *  desktop (no Web Share for files), fall back to a download link.
 *
 *  `kind` becomes the filename prefix (e.g. "spirit-animal", "soundtrack").
 *
 *  Fonts must be fully loaded before capture or the export silently falls back
 *  to system fonts (most likely thing to break — test on cold cache). */
export async function saveCardAsPng(
  card: HTMLElement,
  colleagueName: string,
  kind: string,
): Promise<void> {
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

  const filename = `${slugify(kind)}-${slugify(colleagueName)}.png`;

  // Prefer native share sheet on mobile — gives users "Save Image" /
  // "Save to Photos" / "Save to Gallery" directly into their camera roll
  // instead of the browser's downloads folder.
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], filename, { type: 'image/png' });

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData & { files?: File[] }) => boolean;
    share?: (data: ShareData & { files?: File[] }) => Promise<void>;
  };
  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (err) {
      // User cancelled the share sheet — that's not a failure.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Otherwise (rare: SecurityError without user gesture, etc.) fall through
      // to the download path so the user still gets *something*.
    }
  }

  // Desktop / Web-Share-unavailable fallback.
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Fetch a hosted video and hand it to the OS share sheet so iOS / Android
 *  users can "Save Video" / "Save to Gallery" into their camera roll. Desktop
 *  (no Web Share with files) falls back to a download link. Same shape as
 *  saveCardAsPng but skips the html-to-image canvas pipeline since the video
 *  file is already a shareable asset.
 *
 *  Reasonable file sizes only — the whole video is pulled into memory as a
 *  blob. Meme clips at <10 MB are fine; multi-hundred-MB files would OOM
 *  on lower-end phones. */
export async function saveVideoToGallery(
  videoUrl: string,
  colleagueName: string,
  kind: string,
): Promise<void> {
  const response = await fetch(videoUrl);
  if (!response.ok) throw new Error(`Failed to fetch video (${response.status})`);
  const blob = await response.blob();
  // Default to mp4 — that's the only format the hosting flow produces, and
  // some servers don't set a useful Content-Type.
  const mimeType = blob.type || 'video/mp4';
  const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
  const filename = `${slugify(kind)}-${slugify(colleagueName)}.${ext}`;
  const file = new File([blob], filename, { type: mimeType });

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData & { files?: File[] }) => boolean;
    share?: (data: ShareData & { files?: File[] }) => Promise<void>;
  };
  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (err) {
      // User cancelled the share sheet — that's not a failure.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Otherwise fall through to the download path so the user still gets the file.
    }
  }

  const objUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = objUrl;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
}
