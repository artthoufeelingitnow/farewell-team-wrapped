import { useEffect, useState } from 'react';
import { isValidDeckId } from '../utils/links';

/**
 * Three destinations:
 *   ''          → landing  (no deck id — "you need your personal link")
 *   '#admin'    → admin
 *   '#/d/<id>'  → deck     (the private per-colleague link)
 *
 * A malformed or non-matching id falls back to `landing` rather than throwing,
 * so a mangled link degrades into the "check your link" screen instead of a
 * blank page.
 */
export type Route =
  | { kind: 'landing' }
  | { kind: 'admin' }
  | { kind: 'deck'; id: string };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '');
  if (h === 'admin') return { kind: 'admin' };
  const deck = /^\/?d\/([^/?#]+)$/.exec(h);
  if (deck && isValidDeckId(deck[1])) return { kind: 'deck', id: deck[1] };
  return { kind: 'landing' };
}

export function routeToHash(route: Route): string {
  switch (route.kind) {
    case 'admin':
      return '#admin';
    case 'deck':
      return `#/d/${route.id}`;
    case 'landing':
      return '';
  }
}

function readRoute(): Route {
  if (typeof window === 'undefined') return { kind: 'landing' };
  return parseHash(window.location.hash);
}

export function useHashRoute(): [Route, (next: Route) => void] {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (next: Route) => {
    window.location.hash = routeToHash(next);
  };

  return [route, navigate];
}
