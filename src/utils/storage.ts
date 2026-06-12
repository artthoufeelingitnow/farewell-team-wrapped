import type { AppData, Colleague } from '../types';
import { STORAGE_KEY } from './constants';

/**
 * IndexedDB persistence layer for the admin's source-of-truth.
 *
 * Why not localStorage: the full draft (23 colleagues × ~1MB of base64 photos)
 * runs to ~14MB on disk, which exceeds every browser's per-origin localStorage
 * quota (~5-10MB). IndexedDB has disk-based quotas (gigabytes), so this stops
 * being a concern at any realistic deck size.
 *
 * Schema: a single `kv` object store keyed by string.
 *   - `'meta'` → { meta: AppData['meta'], colleagueIds: string[] }  (preserves order)
 *   - `'colleague:<id>'` → Colleague
 *
 * Mutations write only the touched record (meta OR a single colleague), so
 * even a one-character edit no longer re-serializes the entire deck.
 *
 * Migration: on first `loadAll()` call, if no `meta` record exists but the
 * legacy localStorage key (`goodbye_wrapped_data_v1`) does, we parse it, split
 * it into IndexedDB records, then delete the localStorage key. One-shot;
 * idempotent.
 */

const DB_NAME = 'goodbye_wrapped_admin';
const DB_VERSION = 1;
const STORE = 'kv';
const META_KEY = 'meta';
const COLLEAGUE_PREFIX = 'colleague:';

interface MetaRecord {
  meta: AppData['meta'];
  colleagueIds: string[];
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function runTx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | void> {
  return openDb().then(
    (db) =>
      new Promise<T | void>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        let result: T | undefined;
        const req = fn(store);
        if (req) {
          req.onsuccess = () => {
            result = req.result;
          };
          req.onerror = () => reject(req.error);
        }
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

function colleagueKey(id: string): string {
  return `${COLLEAGUE_PREFIX}${id}`;
}

/** Read every record and re-assemble the AppData. Order preserved via meta.colleagueIds. */
export async function loadAll(): Promise<AppData | null> {
  const db = await openDb();
  return new Promise<AppData | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const metaReq = store.get(META_KEY);
    metaReq.onerror = () => reject(metaReq.error);
    metaReq.onsuccess = () => {
      const metaRec = metaReq.result as MetaRecord | undefined;
      if (!metaRec) {
        resolve(null);
        return;
      }
      const colleagues: Colleague[] = [];
      let remaining = metaRec.colleagueIds.length;
      if (remaining === 0) {
        resolve({ meta: metaRec.meta, colleagues: [] });
        return;
      }
      metaRec.colleagueIds.forEach((id, i) => {
        const req = store.get(colleagueKey(id));
        req.onsuccess = () => {
          if (req.result) colleagues[i] = req.result as Colleague;
          if (--remaining === 0) {
            resolve({ meta: metaRec.meta, colleagues: colleagues.filter(Boolean) });
          }
        };
        req.onerror = () => reject(req.error);
      });
    };
  });
}

export function saveMeta(meta: AppData['meta'], colleagueIds: string[]): Promise<void> {
  return runTx<void>('readwrite', (store) => {
    store.put({ meta, colleagueIds } satisfies MetaRecord, META_KEY);
  }) as Promise<void>;
}

export function saveColleague(c: Colleague): Promise<void> {
  return runTx<void>('readwrite', (store) => {
    store.put(c, colleagueKey(c.id));
  }) as Promise<void>;
}

export function deleteColleagueRecord(id: string): Promise<void> {
  return runTx<void>('readwrite', (store) => {
    store.delete(colleagueKey(id));
  }) as Promise<void>;
}

/** Atomic: write meta + every colleague + drop any stale colleague records. */
export async function saveAll(data: AppData): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const ids = data.colleagues.map((c) => c.id);
    const keepKeys = new Set<string>([META_KEY, ...ids.map(colleagueKey)]);
    const keysReq = store.getAllKeys();
    keysReq.onsuccess = () => {
      for (const k of keysReq.result) {
        if (typeof k === 'string' && !keepKeys.has(k)) store.delete(k);
      }
      store.put({ meta: data.meta, colleagueIds: ids } satisfies MetaRecord, META_KEY);
      for (const c of data.colleagues) store.put(c, colleagueKey(c.id));
    };
    keysReq.onerror = () => reject(keysReq.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function clearAll(): Promise<void> {
  await runTx<void>('readwrite', (store) => {
    store.clear();
  });
}

/**
 * One-shot migration: read the legacy monolithic localStorage value, write it
 * into IndexedDB records, then drop the localStorage key. Returns the migrated
 * data so the caller can use it immediately. Returns null if there's nothing
 * to migrate.
 */
export async function migrateFromLocalStorage(): Promise<AppData | null> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: AppData;
  try {
    parsed = JSON.parse(raw) as AppData;
  } catch {
    return null;
  }
  if (!parsed || !Array.isArray(parsed.colleagues)) return null;
  await saveAll(parsed);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort; not critical
  }
  return parsed;
}
