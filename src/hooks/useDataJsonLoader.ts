import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import type { AppDataIndex } from '../types';
import { useHashRoute } from './useHashRoute';

/**
 * Route-aware data source.
 *
 * On viewer routes (landing / deck): fetches `${BASE_URL}data/index.json`, which
 * contains ONLY `meta` — no names, no ids, no roster of any kind. Its arrival is
 * also what flips `isExportedFile: true`, which is how the unlock screen knows
 * to take the fetch-and-decrypt path rather than the admin-draft path.
 *
 * The colleague themselves is fetched + decrypted lazily by the unlock screen
 * using the id from their private `#/d/<id>` link.
 *
 * On the admin route: re-reads the admin's source-of-truth from IndexedDB, so a
 * previous viewer-flow `loadIndex()` doesn't leave the store in viewer shape
 * when the user navigates back to admin.
 *
 * In dev (no data/ tree served), the fetch 404s silently and the admin's local
 * draft is used.
 */
export function useDataJsonLoader() {
  const loadIndex = useAppStore((s) => s.loadIndex);
  const reloadFromStorage = useAppStore((s) => s.reloadFromStorage);
  const [route] = useHashRoute();
  const isAdmin = route.kind === 'admin';

  useEffect(() => {
    if (isAdmin) {
      void reloadFromStorage();
      return;
    }
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/index.json`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<AppDataIndex>;
      })
      .then((index) => {
        if (cancelled) return;
        if (index && index.meta) loadIndex(index);
      })
      .catch(() => {
        // Expected in dev or when no exported data exists; silent.
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, loadIndex, reloadFromStorage]);
}
