import { useHashRoute } from './hooks/useHashRoute';
import { useDataJsonLoader } from './hooks/useDataJsonLoader';
import { usePlayerStore } from './store/playerStore';
import { Unlock } from './components/landing/Unlock';
import { Admin } from './components/admin/Admin';
import { Player } from './components/player/Player';
import { GalleryWall } from './components/gallery/GalleryWall';
import { Toast } from './components/Toast';

export function App() {
  const [route] = useHashRoute();
  const inPlayer = usePlayerStore((s) => s.currentColleagueId !== null);

  useDataJsonLoader();

  return (
    <>
      {inPlayer ? (
        <Player />
      ) : route.kind === 'admin' ? (
        <Admin />
      ) : route.kind === 'gallery' ? (
        <GalleryWall token={route.token} />
      ) : (
        <Unlock deckId={route.kind === 'deck' ? route.id : null} />
      )}
      <Toast />
    </>
  );
}
