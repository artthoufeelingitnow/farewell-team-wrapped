import type { Colleague, Slide, MediaItem } from '../types';

/** URLs we've already kicked off a preload for — one fetch per asset per session. */
const preloaded = new Set<string>();

/** Hold strong refs to the in-flight Audio/Video elements so the browser keeps
 *  the network request alive. Without this, GC could drop the element + abort
 *  the fetch. We never read these — just retain them. */
const retained: HTMLMediaElement[] = [];

function collectMediaUrls(media: MediaItem | undefined): string[] {
  if (!media || !media.src) return [];
  // Skip base64 (already in memory) — only network URLs benefit from preloading.
  if (media.src.startsWith('data:')) return [];
  return [media.src];
}

function collectVideoUrls(slide: Slide): string[] {
  const out: string[] = [];
  switch (slide.type) {
    case 'mosaic':
      for (const m of slide.media ?? []) {
        if (m && m.kind === 'video') out.push(...collectMediaUrls(m));
      }
      break;
    case 'podium':
      for (const it of slide.items ?? []) {
        if (it.media?.kind === 'video') out.push(...collectMediaUrls(it.media));
      }
      break;
    case 'photo':
      if (slide.media?.kind === 'video') out.push(...collectMediaUrls(slide.media));
      break;
    case 'spirit-animal':
      if (slide.left?.media?.kind === 'video') out.push(...collectMediaUrls(slide.left.media));
      if (slide.right?.media?.kind === 'video') out.push(...collectMediaUrls(slide.right.media));
      break;
  }
  return out;
}

/** Kick off the network fetch for every song + remote video used by this
 *  colleague's deck so the player has near-zero wait when slides advance.
 *  Idempotent across calls — already-warmed URLs are skipped. */
export function preloadColleagueAssets(colleague: Colleague | undefined): void {
  if (!colleague) return;
  for (const slide of colleague.slides ?? []) {
    if (slide.songUrl && !preloaded.has(slide.songUrl)) {
      preloaded.add(slide.songUrl);
      const a = new Audio();
      a.preload = 'auto';
      a.crossOrigin = 'anonymous';
      a.src = slide.songUrl;
      // No play() — we just want the file in cache.
      retained.push(a);
    }
    for (const url of collectVideoUrls(slide)) {
      if (preloaded.has(url)) continue;
      preloaded.add(url);
      const v = document.createElement('video');
      v.preload = 'auto';
      v.muted = true;
      v.playsInline = true;
      v.src = url;
      retained.push(v);
    }
  }
}
