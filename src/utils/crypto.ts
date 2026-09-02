/**
 * Per-colleague AES-GCM encryption.
 *
 * Format (JSON file shipped to /data/colleagues/<id>.json.enc):
 *   { v: 1, salt: <base64>, iv: <base64>, ciphertext: <base64> }
 *
 * Key derivation: PBKDF2-SHA256, 600_000 iterations, 16-byte salt → 32-byte AES-GCM key.
 * Cipher: AES-GCM-256 with 12-byte IV. The auth tag is appended to the ciphertext
 * by WebCrypto (standard).
 *
 * Shared between browser (this file) and the Node-side encrypt script — both run
 * the WebCrypto API (Node ≥ 19 exposes it as `globalThis.crypto`).
 */

export interface EncryptedBlob {
  v: 1;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64 (includes GCM auth tag)
}

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

/** Fixed salt for the password → deck-id lookup. It has to be fixed (not per
 *  colleague) because the whole point is finding the deck when we don't yet
 *  know whose it is — there's no roster to look a per-user salt up in.
 *
 *  Trade-off: a fixed salt means one PBKDF2 run tests a candidate password
 *  against every deck at once, instead of one run per deck. With a handful of
 *  decks that's a small constant factor, and the 600k iterations still make
 *  each guess as expensive as attacking a blob directly. Must stay byte-identical
 *  to LOOKUP_SALT in scripts/encrypt-data.mjs. */
const LOOKUP_SALT = new TextEncoder().encode('goodbye-wrapped/lookup/v1');

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const pwBytes = new TextEncoder().encode(password);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    pwBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Allocate-then-fill so the resulting view is typed against a concrete
 *  ArrayBuffer (not ArrayBufferLike) — required by TS's narrowed BufferSource. */
function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

export async function encryptJson(plaintext: unknown, password: string): Promise<EncryptedBlob> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
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

/** Hex digest identifying which deck a password belongs to, without publishing
 *  any roster. `encrypt-data` writes `data/lookup/<digest>.json` containing just
 *  that colleague's id; the page derives the same digest from what's typed and
 *  fetches it. A miss is a 404, which is indistinguishable from a wrong password.
 *
 *  This is a *locator*, not the key — the deck itself is still AES-GCM sealed
 *  under the same password with its own random salt. */
export async function deriveLookupDigest(password: string): Promise<string> {
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
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Domain-separation prefix for the polaroid wall's filename digest. Must stay
 *  byte-identical to GALLERY_PREFIX in scripts/encrypt-data.mjs. */
const GALLERY_PREFIX = 'goodbye-wrapped/gallery/v1:';

/** Hex digest naming the wall's blob: `data/gallery/<digest>.json.enc`.
 *
 *  A plain SHA-256, NOT the 600k-iteration PBKDF2 used for deck passwords —
 *  and that difference is deliberate, not an oversight. PBKDF2's iteration
 *  count exists to make guessing a *low-entropy human password* expensive.
 *  The wall's token is 128 bits from `makeGalleryToken()`, so guessing the
 *  filename means guessing 128 bits; slowing each guess by 600k iterations
 *  changes an already-impossible search into a differently-impossible one,
 *  while costing every visitor a second of page load.
 *
 *  The blob's AES key still comes from the ordinary `deriveKey` path, so the
 *  on-disk format stays identical to a colleague's deck. */
export async function deriveGalleryDigest(token: string): Promise<string> {
  const bits = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(GALLERY_PREFIX + token),
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class WrongPasswordError extends Error {
  constructor() {
    super('wrong-password');
    this.name = 'WrongPasswordError';
  }
}

export async function decryptJson<T = unknown>(
  blob: EncryptedBlob,
  password: string,
): Promise<T> {
  if (blob.v !== 1) throw new Error(`Unsupported blob version: ${blob.v}`);
  const salt = base64ToBytes(blob.salt);
  const iv = base64ToBytes(blob.iv);
  const ct = base64ToBytes(blob.ciphertext);
  const key = await deriveKey(password, salt);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  } catch {
    // AES-GCM throws on auth-tag mismatch — that's exactly the wrong-password case.
    throw new WrongPasswordError();
  }
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
