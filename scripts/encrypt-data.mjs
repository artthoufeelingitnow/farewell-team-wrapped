#!/usr/bin/env node
/**
 * Reads the gitignored `data.json` (admin's source-of-truth, with plaintext
 * passwords on each colleague) and writes the deploy artifacts:
 *
 *   data/index.json                 — public: meta ONLY. No names, no ids.
 *   data/colleagues/<id>.json.enc   — AES-GCM, key = colleague.password via PBKDF2.
 *                                     Payload is { name, category, slides } —
 *                                     the name lives inside the ciphertext so
 *                                     the roster is never published.
 *   data/lookup/<digest>.json       — { id }. Filename is a 600k-iteration hash
 *                                     of the password, so someone with only
 *                                     their password (no link) can still find
 *                                     their deck. Contains no name.
 *   data/gallery/<digest>/          — the shared polaroid wall. AES-GCM, key =
 *     index.json.enc                    gallery.token. Directory name is a
 *     <i>.json.enc                      plain SHA-256 of that token (it's 134
 *                                       bits, so a slow KDF buys nothing).
 *                                     index.json.enc holds names + cover
 *                                     images only; <i>.json.enc is one
 *                                     person's full card, fetched on tap.
 *                                     Split because a single blob was 107 MB —
 *                                     over GitHub's file limit, and an absurd
 *                                     first paint. NO colleague ids anywhere
 *                                     in here, so the wall can't be used to
 *                                     work out which of the featured people
 *                                     also has a private deck; <i> is a
 *                                     position on the wall, nothing more.
 *
 * There is no public list of colleagues anywhere. Two ways in, both requiring
 * the password: the private `#/d/<id>` link (printed below), or the password
 * alone via the lookup digest.
 *
 * Format must stay in sync with src/utils/crypto.ts. Both sides use WebCrypto
 * (Node ≥ 19 exposes globalThis.crypto).
 *
 * Cleans the existing data/colleagues/ directory before writing so deletions
 * propagate (a colleague removed from data.json gets their .json.enc removed).
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

/** Must stay byte-identical to LOOKUP_SALT in src/utils/crypto.ts — see the
 *  comment there for why this one is fixed rather than per colleague. */
const LOOKUP_SALT = new TextEncoder().encode('goodbye-wrapped/lookup/v1');

/** Must stay byte-identical to GALLERY_PREFIX in src/utils/crypto.ts. */
const GALLERY_PREFIX = 'goodbye-wrapped/gallery/v1:';

/** Mirrors SITE_URL in src/utils/links.ts and `base` in vite.config.ts —
 *  change all three together if the deploy target ever moves. */
const SITE_URL = 'https://artthoufeelingitnow.github.io/farewell-team-wrapped/';
const deckUrl = (id) => `${SITE_URL}#/d/${id}`;
const galleryUrl = (token) => `${SITE_URL}#/w/${token}`;

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SRC_FILE = join(REPO_ROOT, 'data.json');
const OUT_DIR = join(REPO_ROOT, 'data');
const OUT_INDEX = join(OUT_DIR, 'index.json');
const OUT_COLLEAGUES = join(OUT_DIR, 'colleagues');
const OUT_LOOKUP = join(OUT_DIR, 'lookup');
const OUT_GALLERY = join(OUT_DIR, 'gallery');

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

async function deriveKey(password, salt) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
}

async function encryptJson(plaintext, password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt);
  const data = new TextEncoder().encode(JSON.stringify(plaintext));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return {
    v: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ct)),
  };
}

/** Names the polaroid wall's blob. Mirrors deriveGalleryDigest() in
 *  src/utils/crypto.ts — see there for why this one is a plain SHA-256 while
 *  the password lookup above is 600k PBKDF2 iterations. */
async function deriveGalleryDigest(token) {
  const bits = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(GALLERY_PREFIX + token),
  );
  return Buffer.from(new Uint8Array(bits)).toString('hex');
}

/** Hex digest that maps a password back to its deck id, so someone who only has
 *  the password (no private link) can still get in. Mirrors deriveLookupDigest()
 *  in src/utils/crypto.ts — both must agree or the lookup silently 404s. */
async function deriveLookupDigest(password) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: LOOKUP_SALT, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    256,
  );
  return Buffer.from(new Uint8Array(bits)).toString('hex');
}

const TRANSIENT_SLIDE_FIELDS = [
  'showSongPicker',
  'songSearchQuery',
  'songSearchResults',
  'songSearching',
];

function stripTransient(slide) {
  const out = { ...slide };
  for (const f of TRANSIENT_SLIDE_FIELDS) delete out[f];
  return out;
}

/** Fields dropped from a spirit-animal card on its way to the wall. Mirrors
 *  DROPPED_CARD_FIELDS in src/utils/gallery.ts — if these two lists diverge,
 *  the wall you previewed in admin stops matching the wall you shipped. */
const DROPPED_CARD_FIELDS = [
  'songUrl',
  'songName',
  'songArtist',
  'songArt',
  'songStart',
  'songDuration',
  'fragments',
  ...TRANSIENT_SLIDE_FIELDS,
];

function galleryCardFromSlide(slide) {
  const out = { ...slide };
  for (const f of DROPPED_CARD_FIELDS) delete out[f];
  return out;
}

/** Build + write the shared wall. Returns the token if one was published.
 *
 *  Writes an index (names + covers) plus one blob per person, rather than one
 *  file with everything: covers are small but the other half of a card is
 *  routinely a multi-MB GIF, and bundling them made a 107 MB file that GitHub
 *  refuses outright.
 *
 *  Note what does NOT go in: colleague ids. The wall goes to a whole group, so
 *  an id in it would hand every recipient the deck ids of the people featured —
 *  enough to probe data/colleagues/ and learn which of their colleagues also
 *  got a private wrapped. Names, covers and cards only. */
async function writeGallery(data) {
  const config = data.gallery ?? {};
  const featured = data.colleagues.filter((c) => c.inGallery);
  if (featured.length === 0) return null;

  if (!config.token) {
    console.warn(
      `\u26a0 ${featured.length} person(s) marked for the polaroid wall, but no wall link has ` +
        `been generated — the wall is NOT published. Generate one in admin under "Polaroid wall".`,
    );
    return null;
  }

  // One ordered list both halves derive from, so an index entry and its card
  // blob can never fall out of step. Mirrors buildWallPeople in utils/gallery.
  const people = [];
  for (const c of featured) {
    const slide = (c.slides ?? []).find((s) => s.type === 'spirit-animal');
    if (!c.name || !slide) {
      console.warn(
        `\u26a0 ${c.name || c.id} is marked for the wall but has ` +
          `${!c.name ? 'no name' : 'no spirit-animal slide'} — skipped.`,
      );
      continue;
    }
    people.push({
      name: c.name,
      cover: c.galleryCover === 'right' ? 'right' : 'left',
      slide: galleryCardFromSlide(stripTransient(slide)),
    });
  }

  if (people.length === 0) {
    console.warn('\u26a0 Nobody on the wall had a usable card — wall NOT published.');
    return null;
  }

  const digest = await deriveGalleryDigest(config.token);
  const dir = join(OUT_GALLERY, digest);
  mkdirSync(dir, { recursive: true });

  // Index: names + covers only. This is what everyone downloads on open.
  const entries = people.map(({ name, slide, cover }) => {
    const section = cover === 'right' ? slide.right : slide.left;
    const entry = { name };
    if (section?.media) entry.cover = section.media;
    if (section?.mediaPosition) entry.coverPosition = section.mediaPosition;
    return entry;
  });
  const indexPayload = {
    ...(config.title ? { title: config.title } : {}),
    ...(config.note ? { note: config.note } : {}),
    entries,
  };
  writeFileSync(
    join(dir, 'index.json.enc'),
    JSON.stringify(await encryptJson(indexPayload, config.token)),
  );

  // One blob per person, named by wall position.
  let biggest = 0;
  for (let i = 0; i < people.length; i++) {
    const blob = await encryptJson({ slide: people[i].slide }, config.token);
    const json = JSON.stringify(blob);
    writeFileSync(join(dir, `${i}.json.enc`), json);
    if (json.length > biggest) biggest = json.length;
  }

  const indexBytes = statSync(join(dir, 'index.json.enc')).size;
  const mb = (b) => (b / 1048576).toFixed(1);
  console.log(
    `\nWall: index is ${mb(indexBytes)} MB (what everyone downloads on open); ` +
      `largest single card is ${mb(biggest)} MB (loads only when tapped).`,
  );
  // GitHub hard-rejects any file over 100 MB, which is what a single combined
  // blob hit. Warn well before that so it's caught here, not at push time.
  if (biggest > 90 * 1048576 || indexBytes > 90 * 1048576) {
    console.warn(
      '\u26a0 A wall file is near GitHub\'s 100 MB limit. Shrink that person\'s media.',
    );
  }

  return { token: config.token, count: people.length };
}

function main() {
  if (!existsSync(SRC_FILE)) {
    console.error(`Missing ${SRC_FILE}. Export from admin first.`);
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(SRC_FILE, 'utf8'));
  if (!data || !Array.isArray(data.colleagues)) {
    console.error('data.json malformed: missing `colleagues` array.');
    process.exit(1);
  }

  // Wipe and recreate the output tree so removed colleagues don't leave stale
  // .json.enc files behind.
  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_COLLEAGUES, { recursive: true });
  mkdirSync(OUT_LOOKUP, { recursive: true });

  const published = [];
  let skippedCount = 0;

  return Promise.all(
    data.colleagues.map(async (c) => {
      if (!c.id || !c.name) {
        console.warn(`Skipping colleague with missing id/name: ${JSON.stringify(c).slice(0, 80)}`);
        skippedCount++;
        return;
      }
      const slides = Array.isArray(c.slides) ? c.slides.map(stripTransient) : [];
      // Only publish a fully-formed, encryptable deck. Anything missing a
      // password or slides — or explicitly paused via `hidden` — gets no blob,
      // so its link 404s until you finish setting it up.
      // Wall-only people have no deck by design, so they're skipped silently —
      // warning about them every single export would train you to ignore the
      // warning that actually matters (a real deck missing its password).
      if (c.galleryOnly) return;
      const reason = !c.password
        ? 'no password'
        : slides.length === 0
          ? 'no slides'
          : c.hidden
            ? 'link status is Paused'
            : null;
      if (reason) {
        console.warn(`⚠ ${c.name} (${c.id}) — ${reason}, NOT published. Their link will 404.`);
        skippedCount++;
        return;
      }
      // The name rides inside the ciphertext: it's what greets them after
      // unlock, and it must not appear in any public file.
      const payload = {
        name: c.name,
        ...(c.category ? { category: c.category } : {}),
        slides,
      };
      const blob = await encryptJson(payload, c.password);
      writeFileSync(join(OUT_COLLEAGUES, `${c.id}.json.enc`), JSON.stringify(blob));
      // Password-only entry point, for anyone who has their password but not
      // their link. The filename is a slow hash of the password; the contents
      // are just the deck id. Nothing here names anybody.
      const digest = await deriveLookupDigest(c.password);
      const lookupPath = join(OUT_LOOKUP, `${digest}.json`);
      if (existsSync(lookupPath)) {
        console.warn(
          `\u26a0 ${c.name} (${c.id}) shares a password with another colleague — ` +
            `password-only entry will land on whichever was written first. Give them distinct passwords.`,
        );
      }
      writeFileSync(lookupPath, JSON.stringify({ id: c.id }));
      published.push(c);
    }),
  ).then(async () => {
    // Meta only — deliberately no colleague list. See src/types AppDataIndex.
    // The wall's token isn't in here either: it's a credential.
    writeFileSync(OUT_INDEX, JSON.stringify({ meta: data.meta ?? {} }, null, 2));

    const wall = await writeGallery(data);

    if (published.length > 0) {
      console.log('\nPrivate links — send each person theirs, with their password:\n');
      const pad = Math.max(...published.map((c) => c.name.length));
      for (const c of published) {
        console.log(`  ${c.name.padEnd(pad)}  ${deckUrl(c.id)}`);
      }
      console.log('\n(Passwords are in data.json — never commit or paste that file.)\n');
    }

    if (wall) {
      console.log(`Polaroid wall — one link for everyone (${wall.count} on it):\n`);
      console.log(`  ${galleryUrl(wall.token)}\n`);
      console.log('(No password on this one — the link IS the key. Treat it like one.)\n');
    }

    console.log(
      `✓ Wrote data/index.json (meta only, no roster) + ${published.length} encrypted decks` +
        ` + ${published.length} password lookups` +
        (wall ? ` + 1 polaroid wall (${wall.count} people)` : '') +
        `. Skipped: ${skippedCount}.`,
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
