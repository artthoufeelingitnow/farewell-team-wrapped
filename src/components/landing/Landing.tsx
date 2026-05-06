import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { usePlayerStore } from '../../store/playerStore';
import type { Colleague } from '../../types';
import { PasswordModal } from './PasswordModal';
import { preloadColleagueAssets } from '../../utils/preload';

export function Landing() {
  const data = useAppStore((s) => s.data);
  const openPlayer = usePlayerStore((s) => s.openPlayer);
  const markUnlocked = usePlayerStore((s) => s.markUnlocked);
  const unlockedIds = usePlayerStore((s) => s.unlockedColleagueIds);

  const [pwTarget, setPwTarget] = useState<Colleague | null>(null);

  const visibleColleagues = data.colleagues.filter((c) => c.slides && c.slides.length > 0);

  const handleBubbleClick = (c: Colleague) => {
    // Start fetching this deck's songs + videos as soon as intent is shown.
    // The few seconds of password entry give the browser a head start so the
    // first slide's audio is in cache by the time the player opens.
    preloadColleagueAssets(c);
    if (!c.passwordHash) {
      openPlayer(c.id);
      return;
    }
    if (unlockedIds.has(c.id)) {
      openPlayer(c.id);
      return;
    }
    setPwTarget(c);
  };

  const handleUnlock = () => {
    if (!pwTarget) return;
    markUnlocked(pwTarget.id);
    openPlayer(pwTarget.id);
    setPwTarget(null);
  };

  return (
    <>
      <div className="landing">
        <div className="landing-header">
          <h1>{data.meta.title || 'For You'}</h1>
          <p>
            {data.meta.subtitle ||
              'A little something I made for each of you. Find your name, enter the password I sent you.'}
          </p>
        </div>

        {visibleColleagues.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', margin: '40px 0' }}>
            <p>Nothing here yet.</p>
            <p style={{ fontSize: '13px', marginTop: '8px' }}>
              If this is your site, head to <a href="#admin" style={{ color: '#FFC75F' }}>admin</a>.
            </p>
          </div>
        ) : (
          <div className="bubble-stage">
            {visibleColleagues.map((c) => (
              <button key={c.id} className="name-bubble" onClick={() => handleBubbleClick(c)}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="landing-footer">made with care · for the team</div>
        <a href="#admin" className="admin-link">admin</a>
      </div>

      {pwTarget && (
        <PasswordModal
          colleague={pwTarget}
          onUnlock={handleUnlock}
          onCancel={() => setPwTarget(null)}
        />
      )}
    </>
  );
}
