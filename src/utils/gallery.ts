import type { Colleague, GalleryEntry, SpiritAnimalSlide } from '../types';

/**
 * The polaroid wall — shared plumbing.
 *
 * The wall never renders a deck. It renders one spirit-animal card per
 * featured person, lifted out of their deck (or off the single slide a
 * gallery-only person carries). That's what makes "the ones I already built
 * just show up" work: there is no second copy of the cat to maintain, and
 * editing someone's spirit-animal slide updates their polaroid on the next
 * export.
 *
 * The wall ships as an index plus one blob per person, NOT as a single file:
 * covers are small, but the other half of a card is routinely a multi-MB GIF,
 * and bundling all of them made the first paint a 107 MB download (and blew
 * past GitHub's 100 MB file limit). `buildWallPeople` is the single ordered
 * list both halves derive from, so an index entry and a card blob can't fall
 * out of step.
 *
 * These builders run in two places and MUST agree with the mirrored copies in
 * scripts/encrypt-data.mjs:
 *   - here, for admin's live preview off the local IndexedDB draft
 *   - there, for what actually gets encrypted and shipped
 * If they diverge, the wall you preview stops matching the wall you send.
 */

/** Fields stripped from a spirit-animal slide on its way to the wall.
 *
 *  Songs: the wall has no audio engine — a card is a still object there, and
 *  shipping the URLs would only bloat the blob. Fragments: they're a
 *  slide-background effect with nothing to sit on outside the player.
 *  Transient: admin-only UI state that must never leave the browser (same
 *  list as TRANSIENT_FIELDS in ./index.ts). */
const DROPPED_CARD_FIELDS = [
  'songUrl',
  'songName',
  'songArtist',
  'songArt',
  'songStart',
  'songDuration',
  'fragments',
  'showSongPicker',
  'songSearchQuery',
  'songSearchResults',
  'songSearching',
];

/** Trim a spirit-animal slide down to what the wall actually paints. */
export function galleryCardFromSlide(slide: SpiritAnimalSlide): SpiritAnimalSlide {
  const out = { ...slide } as Record<string, unknown>;
  for (const f of DROPPED_CARD_FIELDS) delete out[f];
  return out as unknown as SpiritAnimalSlide;
}

/** Their first spirit-animal slide — the one the wall shows. A deck can hold
 *  more than one; the first is the canonical "this is you if you were a cat"
 *  beat, and picking deterministically beats making you configure which. */
export function findSpiritAnimalSlide(c: Colleague): SpiritAnimalSlide | undefined {
  return (c.slides ?? []).find((s): s is SpiritAnimalSlide => s.type === 'spirit-animal');
}

/** Is this person publishable to the wall? Opt-in, needs a name, and needs a
 *  spirit-animal slide to show. Note `hidden` is NOT consulted: pausing
 *  someone's deck link shouldn't pull their cat off the wall. */
export function isWallReady(c: Colleague): boolean {
  return !!c.inGallery && !!c.name?.trim() && !!findSpiritAnimalSlide(c);
}

/** Everyone publishable to the wall, in admin order. The ORDER is the
 *  contract: a person's position here is the `<i>` their card blob is named
 *  after, and the index into the rendered wall. */
export function buildWallPeople(
  colleagues: Colleague[],
): { name: string; slide: SpiritAnimalSlide; cover: 'left' | 'right' }[] {
  const out: { name: string; slide: SpiritAnimalSlide; cover: 'left' | 'right' }[] = [];
  for (const c of colleagues) {
    const slide = findSpiritAnimalSlide(c);
    if (!c.inGallery || !c.name?.trim() || !slide) continue;
    out.push({
      name: c.name,
      slide: galleryCardFromSlide(slide),
      cover: c.galleryCover === 'right' ? 'right' : 'left',
    });
    // No id — see the GalleryEntry doc comment. The wall goes to a group, and
    // an id in it would leak which of them also has a private deck.
  }
  return out;
}

/** The lightweight half: names + cover images only. */
export function buildGalleryEntries(colleagues: Colleague[]): GalleryEntry[] {
  return buildWallPeople(colleagues).map(({ name, slide, cover }) => {
    const section = cover === 'right' ? slide.right : slide.left;
    const entry: GalleryEntry = { name };
    if (section?.media) entry.cover = section.media;
    if (section?.mediaPosition) entry.coverPosition = section.mediaPosition;
    return entry;
  });
}

/** Stable 32-bit hash. Same string always gives the same number, so a
 *  polaroid's tilt and hang are fixed per person rather than reshuffling on
 *  every render (which would look like the wall was twitching). */
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Degrees of tilt for one polaroid, −4°..+4°, derived from the name. Nothing
 *  pinned to a string hangs straight, but it also shouldn't move between
 *  visits. */
export function polaroidTilt(name: string, index: number): number {
  const h = hashString(`${name}#${index}`);
  return ((h % 81) - 40) / 10;
}
