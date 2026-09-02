import { useEffect, useState } from 'react';
import { isValidDeckId, isValidGalleryToken } from '../utils/links';

/**
 * Four destinations:
 *   ''             → landing  (no deck id — "you need your personal link")
 *   '#admin'       → admin
 *   '#/d/<id>'     → deck     (the private per-colleague link)
 *   '#/w/<token>'  → gallery  (the shared polaroid wall; the token is the key)
 *
 * A malformed or non-matching id falls back to `landing` rather than throwing,
 * so a mangled link degrades into the "check your link" screen instead of a
 * blank page.
 */
export type Route =
  | { kind: 'landing' }
  | { kind: 'admin' }
  | { kind: 'deck'; id: string }
  | { kind: 'gallery'; token: string };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '');
  if (h === 'admin') return { kind: 'admin' };
  const deck = /^\/?d\/([^/?#]+)$/.exec(h);
  if (deck && isValidDeckId(deck[1])) return { kind: 'deck', id: deck[1] };
  // Same validate-before-it-can-reach-a-URL rule as deck ids: the token is
  // hashed into a filename, so `#/w/../../x` must never get that far.
  const wall = /^\/?w\/([^/?#]+)$/.exec(h);
  if (wall && isValidGalleryToken(wall[1])) return { kind: 'gallery', token: wall[1] };
  return { kind: 'landing' };
}

export function routeToHash(route: Route): string {
  switch (route.kind) {
    case 'admin':
      return '#admin';
    case 'deck':
      return `#/d/${route.id}`;
    case 'gallery':
      return `#/w/${route.token}`;
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
