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
