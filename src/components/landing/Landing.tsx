import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { usePlayerStore } from '../../store/playerStore';
import type { Colleague } from '../../types';
import { PasswordModal } from './PasswordModal';
import { preloadColleagueAssets } from '../../utils/preload';
import { useHashRoute } from '../../hooks/useHashRoute';

export function Landing() {
  const data = useAppStore((s) => s.data);
  const openPlayer = usePlayerStore((s) => s.openPlayer);
  const markUnlocked = usePlayerStore((s) => s.markUnlocked);
  const unlockedIds = usePlayerStore((s) => s.unlockedColleagueIds);
  const [route, navigate] = useHashRoute();

  const [pwTarget, setPwTarget] = useState<Colleague | null>(null);

  const visibleColleagues = data.colleagues.filter((c) => c.slides && c.slides.length > 0);
  const trainers = visibleColleagues.filter((c) => (c.category ?? 'trainer') === 'trainer');
  const yfas = visibleColleagues.filter((c) => c.category === 'yfa');

  const showingCategory = route === 'trainer' || route === 'yfa';
  const activeList = route === 'yfa' ? yfas : route === 'trainer' ? trainers : [];
  const activeLabel = route === 'yfa' ? 'YFA' : 'Trainers';

  const handleBubbleClick = (c: Colleague) => {
    if (c.hidden) return;
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

  const renderBubble = (c: Colleague) => (
    <button
      key={c.id}
      className={`name-bubble${c.hidden ? ' name-bubble-hidden' : ''}`}
      disabled={c.hidden}
      aria-disabled={c.hidden ? true : undefined}
      onClick={() => handleBubbleClick(c)}
    >
      {c.name}
    </button>
  );

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
        ) : showingCategory ? (
          <div className="bubble-group">
            <button className="back-link" onClick={() => navigate('landing')}>
              ← back
            </button>
            <h2 className="bubble-group-heading">{activeLabel}</h2>
            {activeList.length > 0 ? (
              <div className="bubble-stage">{activeList.map(renderBubble)}</div>
            ) : (
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                Nobody here yet.
              </p>
            )}
          </div>
        ) : (
          <div className="category-stage">
            <button
              className="category-bubble"
              disabled={trainers.length === 0}
              onClick={() => navigate('trainer')}
            >
              <span className="category-bubble-label">Trainer</span>
              <span className="category-bubble-count">
                {trainers.length} {trainers.length === 1 ? 'person' : 'people'}
              </span>
            </button>
            <button
              className="category-bubble"
              disabled={yfas.length === 0}
              onClick={() => navigate('yfa')}
            >
              <span className="category-bubble-label">YFA</span>
              <span className="category-bubble-count">
                {yfas.length} {yfas.length === 1 ? 'person' : 'people'}
              </span>
            </button>
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
