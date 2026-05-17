import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { usePlayerStore } from '../../store/playerStore';
import type { Colleague } from '../../types';
import { PasswordModal } from './PasswordModal';
import { preloadColleagueAssets } from '../../utils/preload';
import { useHashRoute } from '../../hooks/useHashRoute';

/** Sequence to type from the landing page to jump to admin. Buffer is per-
 *  keystroke; idle for >ADMIN_BUFFER_RESET_MS resets it. Visitors won't trip
 *  it incidentally — five specific keys in a row is a deliberate act. */
const ADMIN_SECRET = 'admin';
const ADMIN_BUFFER_RESET_MS = 1500;

export function Landing() {
  const data = useAppStore((s) => s.data);
  const isExportedFile = useAppStore((s) => s.isExportedFile);
  const openPlayer = usePlayerStore((s) => s.openPlayer);
  const markUnlocked = usePlayerStore((s) => s.markUnlocked);
  const unlockedIds = usePlayerStore((s) => s.unlockedColleagueIds);
  const [route, navigate] = useHashRoute();

  const [pwTarget, setPwTarget] = useState<Colleague | null>(null);

  // Hidden admin entry: type "admin" on the landing page. Buffer accumulates
  // matching characters in order; any mismatch resets it, and idle >1.5s
  // resets it too. Skips when an input/textarea is focused so it doesn't fire
  // while someone's typing a password in the modal.
  const adminBufferRef = useRef('');
  const adminIdleTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const resetBuffer = () => {
      adminBufferRef.current = '';
      if (adminIdleTimerRef.current !== null) {
        window.clearTimeout(adminIdleTimerRef.current);
        adminIdleTimerRef.current = null;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      // Don't intercept keystrokes meant for a focused input.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      // Only single-character keys; ignore modifiers, arrows, etc.
      if (e.key.length !== 1) return;
      const expectedChar = ADMIN_SECRET[adminBufferRef.current.length];
      if (e.key.toLowerCase() === expectedChar) {
        adminBufferRef.current += expectedChar;
        if (adminBufferRef.current === ADMIN_SECRET) {
          resetBuffer();
          window.location.hash = '#admin';
          return;
        }
        if (adminIdleTimerRef.current !== null) window.clearTimeout(adminIdleTimerRef.current);
        adminIdleTimerRef.current = window.setTimeout(resetBuffer, ADMIN_BUFFER_RESET_MS);
      } else {
        // Wrong char — but if it's the FIRST char of the secret, start fresh
        // from this keystroke (so "aadmin" still works after the false start).
        adminBufferRef.current = e.key.toLowerCase() === ADMIN_SECRET[0] ? ADMIN_SECRET[0] : '';
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      resetBuffer();
    };
  }, []);

  // In production, the index file populates colleague shells with empty
  // slide arrays — slides arrive lazily after decrypt. So filtering by
  // `slides.length > 0` would hide everyone. In admin/dev, we DO want
  // that filter so empty draft colleagues don't appear on the landing.
  const visibleColleagues = isExportedFile
    ? data.colleagues
    : data.colleagues.filter((c) => c.slides && c.slides.length > 0);
  const trainers = visibleColleagues.filter((c) => (c.category ?? 'trainer') === 'trainer');
  const yfas = visibleColleagues.filter((c) => c.category === 'yfa');

  const showingCategory = route === 'trainer' || route === 'yfa';
  const activeList = route === 'yfa' ? yfas : route === 'trainer' ? trainers : [];
  const activeLabel = route === 'yfa' ? 'YFA' : 'Trainers';

  const handleBubbleClick = (c: Colleague) => {
    if (c.hidden) return;
    // Already unlocked this session? The slides are in-memory, just open.
    if (unlockedIds.has(c.id) && c.slides.length > 0) {
      preloadColleagueAssets(c);
      openPlayer(c.id);
      return;
    }
    // Otherwise: prompt for password. Slides aren't loaded yet, so preload
    // has nothing to chew on; it kicks off in `handleUnlock` once we have them.
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
    // After unlock, the colleague's slides are populated in the store. Re-read
    // the latest version so preload sees them, then mark + open.
    const latest = useAppStore.getState().data.colleagues.find((c) => c.id === pwTarget.id);
    if (latest) preloadColleagueAssets(latest);
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
