import { useHashRoute } from './hooks/useHashRoute';
import { useDataJsonLoader } from './hooks/useDataJsonLoader';
import { usePlayerStore } from './store/playerStore';
import { Landing } from './components/landing/Landing';
import { Admin } from './components/admin/Admin';
import { Player } from './components/player/Player';
import { Toast } from './components/Toast';

export function App() {
  const [route] = useHashRoute();
  const inPlayer = usePlayerStore((s) => s.currentColleagueId !== null);

  useDataJsonLoader();

  return (
    <>
      {inPlayer ? <Player /> : route === 'admin' ? <Admin /> : <Landing />}
      <Toast />
    </>
  );
}
