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
