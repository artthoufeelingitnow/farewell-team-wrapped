import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import type { AppDataIndex } from '../types';

/**
 * On mount, fetch /data/index.json (relative). If present and valid, replace
 * store data with the index (meta + colleague shells without slides). The
 * per-colleague slides are fetched + decrypted lazily by PasswordModal when
 * the user enters their password.
 *
 * In dev (no index file in public/), this 404s silently and the admin's
 * localStorage data is used.
 */
export function useDataJsonLoader() {
  const loadIndex = useAppStore((s) => s.loadIndex);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/index.json`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<AppDataIndex>;
      })
      .then((index) => {
        if (cancelled) return;
        if (index && Array.isArray(index.colleagues)) {
          loadIndex(index);
        }
      })
      .catch(() => {
        // Expected in dev or when no exported data exists; silent.
      });
    return () => {
      cancelled = true;
    };
  }, [loadIndex]);
}
