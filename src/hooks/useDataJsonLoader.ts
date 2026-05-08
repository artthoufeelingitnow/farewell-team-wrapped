import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import type { AppDataIndex } from '../types';
import { useHashRoute } from './useHashRoute';

/**
 * Route-aware data source.
 *
 * On viewer routes (landing / trainer / yfa): fetches `${BASE_URL}data/index.json`
 * and replaces the store with meta + colleague shells (no slides). Per-colleague
 * slides are fetched + decrypted lazily by PasswordModal when the user enters
 * their password.
 *
 * On the admin route: re-reads the admin's source-of-truth from localStorage,
 * so a previous viewer-flow `loadIndex()` doesn't leave the store in viewer
 * shape (no slides, no passwords) when the user navigates back to admin.
 *
 * In dev (no index file in public/), the fetch 404s silently and the admin's
 * localStorage data is used.
 */
export function useDataJsonLoader() {
  const loadIndex = useAppStore((s) => s.loadIndex);
  const reloadFromStorage = useAppStore((s) => s.reloadFromStorage);
  const [route] = useHashRoute();

  useEffect(() => {
    if (route === 'admin') {
      reloadFromStorage();
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
  }, [route, loadIndex, reloadFromStorage]);
}
