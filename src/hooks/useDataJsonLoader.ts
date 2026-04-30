import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import type { AppData } from '../types';

/**
 * On mount, attempt to fetch /data.json (relative). If present and valid, replace store data.
 * This is how exported deployments deliver content: the user drops dist/ + data.json onto Netlify,
 * and the static app pulls its content from the JSON file at runtime.
 *
 * In dev (no data.json in public/), this 404s silently and localStorage data is used.
 */
export function useDataJsonLoader() {
  const loadFromExport = useAppStore((s) => s.loadFromExport);

  useEffect(() => {
    let cancelled = false;
    // Use Vite's BASE_URL so this resolves correctly under GitHub Pages' subpath
    // (/farewell-team-wrapped/) regardless of whether the user lands with or without
    // the trailing slash.
    fetch(`${import.meta.env.BASE_URL}data.json`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<AppData>;
      })
      .then((data) => {
        if (cancelled) return;
        if (data && Array.isArray(data.colleagues)) {
          loadFromExport(data);
        }
      })
      .catch(() => {
        // Expected in dev or when no exported data exists; silent.
      });
    return () => {
      cancelled = true;
    };
  }, [loadFromExport]);
}
