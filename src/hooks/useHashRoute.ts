import { useEffect, useState } from 'react';

export type Route = 'landing' | 'admin' | 'trainer' | 'yfa';

function readRoute(): Route {
  if (typeof window === 'undefined') return 'landing';
  const h = window.location.hash.slice(1);
  if (h === 'admin' || h === 'trainer' || h === 'yfa') return h;
  return 'landing';
}

export function useHashRoute(): [Route, (next: Route) => void] {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (next: Route) => {
    window.location.hash = next === 'landing' ? '' : next;
  };

  return [route, navigate];
}
