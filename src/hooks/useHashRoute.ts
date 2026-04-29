import { useEffect, useState } from 'react';

export type Route = 'landing' | 'admin';

function readRoute(): Route {
  if (typeof window === 'undefined') return 'landing';
  return window.location.hash.slice(1) === 'admin' ? 'admin' : 'landing';
}

export function useHashRoute(): [Route, (next: Route) => void] {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (next: Route) => {
    window.location.hash = next === 'admin' ? 'admin' : '';
  };

  return [route, navigate];
}
