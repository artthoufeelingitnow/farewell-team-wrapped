/**
 * Private deck links.
 *
 * There is no public roster any more — nobody can browse to a name. The only
 * way into a deck is a link that carries that colleague's opaque id, plus the
 * password. Both are sent privately, per person.
 */

/** Deck ids are `uid()` output: 8 chars of base36. We validate before an id
 *  ever reaches a fetch URL so a crafted hash (`#/d/../../secrets`) can't
 *  path-traverse out of `data/colleagues/`. */
export const DECK_ID_RE = /^[a-z0-9]{1,32}$/i;

export function isValidDeckId(id: string): boolean {
  return DECK_ID_RE.test(id);
}

/** Hash fragment for one colleague's deck. */
export function deckHash(id: string): string {
  return `#/d/${id}`;
}

/** Canonical production origin + base path. Hardcoded (rather than read from
 *  `window.location`) so links copied out of admin on localhost are still the
 *  real, sendable ones. Mirrors `base` in vite.config.ts and SITE_URL in
 *  scripts/encrypt-data.mjs — change all three together. */
export const SITE_URL = 'https://artthoufeelingitnow.github.io/farewell-team-wrapped/';

/** The full link to paste into a DM. */
export function deckUrl(id: string): string {
  return `${SITE_URL}${deckHash(id)}`;
}

// ============================================================
// The polaroid wall — one link, shared with a group.
// ============================================================

/** Wall tokens are 26 chars of base36 (~134 bits). Validated before the
 *  derived digest reaches a fetch URL, same as `DECK_ID_RE`. The range is
 *  loose at the bottom so a hand-typed test token still works in dev. */
export const GALLERY_TOKEN_RE = /^[a-z0-9]{8,64}$/i;

export function isValidGalleryToken(token: string): boolean {
  return GALLERY_TOKEN_RE.test(token);
}

/** Generate a fresh wall token. Unlike a deck, the wall has no password — the
 *  link IS the credential, so this has to be long enough that it can't be
 *  guessed or enumerated. 26 base36 chars ≈ 134 bits, drawn from the CSPRNG
 *  (never `Math.random`, which `uid()` uses for ids that aren't secrets).
 *
 *  Bytes ≥ 252 are discarded rather than folded in: 252 is 7×36, so keeping
 *  them would make the first four letters of the alphabet fractionally more
 *  likely than the rest. It costs ~1.6% of draws and keeps the 134 bits
 *  honest. */
export function makeGalleryToken(): string {
  const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const LENGTH = 26;
  let out = '';
  while (out.length < LENGTH) {
    const bytes = new Uint8Array(LENGTH);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < 252 && out.length < LENGTH) out += ALPHABET[b % 36];
    }
  }
  return out;
}

export function galleryHash(token: string): string {
  return `#/w/${token}`;
}

export function galleryUrl(token: string): string {
  return `${SITE_URL}${galleryHash(token)}`;
}
