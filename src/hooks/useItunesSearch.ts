import { useEffect, useRef, useState } from 'react';
import type { ItunesResult } from '../types';
import { ITUNES_API } from '../utils/constants';
import { showToast } from '../store/toastStore';

interface State {
  results: ItunesResult[];
  searching: boolean;
}

export function useItunesSearch(query: string): State {
  const [state, setState] = useState<State>({ results: [], searching: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (abortRef.current) abortRef.current.abort();

    const q = query.trim();
    if (!q) {
      setState({ results: [], searching: false });
      return;
    }

    setState((s) => ({ ...s, searching: true }));

    timer.current = setTimeout(async () => {
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const url = `${ITUNES_API}?term=${encodeURIComponent(q)}&media=music&entity=song&limit=10`;
        const res = await fetch(url, { signal: ac.signal });
        const data = (await res.json()) as { results?: ItunesResult[] };
        const filtered = (data.results || []).filter((r) => r.previewUrl);
        setState({ results: filtered, searching: false });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setState({ results: [], searching: false });
        showToast('Search failed — check your connection');
      }
    }, 350);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  return state;
}
