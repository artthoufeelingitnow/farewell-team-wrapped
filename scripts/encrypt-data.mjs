#!/usr/bin/env node
/**
 * Reads the gitignored `data.json` (admin's source-of-truth, with plaintext
 * passwords on each colleague) and writes the deploy artifacts:
 *
 *   data/index.json                 — public, no slides, no passwords
 *   data/colleagues/<id>.json.enc   — AES-GCM, key = colleague.password via PBKDF2
 *
 * Format must stay in sync with src/utils/crypto.ts. Both sides use WebCrypto
 * (Node ≥ 19 exposes globalThis.crypto).
 *
 * Cleans the existing data/colleagues/ directory before writing so deletions
 * propagate (a colleague removed from data.json gets their .json.enc removed).
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SRC_FILE = join(REPO_ROOT, 'data.json');
const OUT_DIR = join(REPO_ROOT, 'data');
const OUT_INDEX = join(OUT_DIR, 'index.json');
const OUT_COLLEAGUES = join(OUT_DIR, 'colleagues');

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

  const indexEntries = [];
  let encryptedCount = 0;
  let skippedCount = 0;

  return Promise.all(
    data.colleagues.map(async (c) => {
      if (!c.id || !c.name) {
        console.warn(`Skipping colleague with missing id/name: ${JSON.stringify(c).slice(0, 80)}`);
        skippedCount++;
        return;
      }
      const slides = Array.isArray(c.slides) ? c.slides.map(stripTransient) : [];
      // Only include colleagues with a fully-formed, encryptable deck in the
      // public index. Anything without a password or without slides would
      // render as a bubble that 404s on click — better to omit them entirely
      // until the admin finishes setting them up.
      if (!c.password || slides.length === 0) {
        console.warn(
          `⚠ ${c.name} (${c.id}) — ${!c.password ? 'no password' : 'no slides'}, omitting from index.`,
        );
        skippedCount++;
        return;
      }
      indexEntries.push({
        id: c.id,
        name: c.name,
        ...(c.category ? { category: c.category } : {}),
        ...(c.hidden ? { hidden: true } : {}),
      });
      const blob = await encryptJson(slides, c.password);
      writeFileSync(join(OUT_COLLEAGUES, `${c.id}.json.enc`), JSON.stringify(blob));
      encryptedCount++;
    }),
  ).then(() => {
    writeFileSync(
      OUT_INDEX,
      JSON.stringify({ meta: data.meta ?? {}, colleagues: indexEntries }, null, 2),
    );
    console.log(
      `✓ Wrote data/index.json (${indexEntries.length} colleagues) + ${encryptedCount} encrypted decks. Skipped: ${skippedCount}.`,
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
