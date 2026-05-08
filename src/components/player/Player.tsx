import { useEffect, useRef } from 'react';
import { useAppStore } from '../../store/appStore';
import { usePlayerStore } from '../../store/playerStore';
import { useAudioEngine } from '../../hooks/useAudioEngine';
import { SlideRenderer } from '../slides/SlideRenderer';
import { getSlideDuration } from '../../utils';
import { preloadColleagueAssets } from '../../utils/preload';

/** How long the user must hold before auto-advance pauses. Short enough to
 *  feel responsive (Instagram is ~150-200ms), long enough that a normal tap
 *  on the nav-zone still navigates instead of pausing. */
const HOLD_PAUSE_MS = 220;

/** If the pointer travels more than this between down and the timer firing,
 *  it's a swipe/scroll, not a hold — cancel the pause. */
const HOLD_MOVE_THRESHOLD_PX = 8;

export function Player() {
  const colleagues = useAppStore((s) => s.data.colleagues);
  const currentColleagueId = usePlayerStore((s) => s.currentColleagueId);
  const slideIndex = usePlayerStore((s) => s.slideIndex);
  const audioEnabled = usePlayerStore((s) => s.audioEnabled);
  const paused = usePlayerStore((s) => s.paused);
  const previewingMedia = usePlayerStore((s) => s.previewingMedia);
  const pausedByVisibility = usePlayerStore((s) => s.pausedByVisibility);
  const setSlideIndex = usePlayerStore((s) => s.setSlideIndex);
  const nextSlideAction = usePlayerStore((s) => s.nextSlide);
  const prevSlideAction = usePlayerStore((s) => s.prevSlide);
  const closePlayer = usePlayerStore((s) => s.closePlayer);
  const toggleAudio = usePlayerStore((s) => s.toggleAudio);
  const setPaused = usePlayerStore((s) => s.setPaused);
  const setPausedByVisibility = usePlayerStore((s) => s.setPausedByVisibility);

  const colleague = colleagues.find((c) => c.id === currentColleagueId);
  const slide = colleague?.slides[slideIndex];
  const nextSlide = colleague?.slides[slideIndex + 1];

  // `pausedByVisibility` and `paused` produce identical playback behavior
  // (halt audio + auto-advance) — they're tracked separately so visibility
  // returns don't clobber an in-flight hold-to-pause.
  const halted = paused || pausedByVisibility;

  const { autoplayBlocked, unblockAutoplay } = useAudioEngine({
    active: !!colleague && !!slide,
    slide,
    nextSlide,
    audioEnabled,
    paused: halted,
  });

  // Pause everything when the tab/app goes hidden (background, lock screen,
  // tab switch). Resume on return — except a stuck `paused` from hold-to-
  // pause stays as-is (hold-pause is its own state).
  useEffect(() => {
    const sync = () => setPausedByVisibility(document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      // Make sure we don't leave the flag stuck after Player unmounts.
      setPausedByVisibility(false);
    };
  }, [setPausedByVisibility]);

  // Safety net: even if the user came in via a deep-link (e.g., dev preview)
  // that skipped Landing, make sure we kick off asset preloading.
  useEffect(() => {
    preloadColleagueAssets(colleague);
  }, [colleague]);

  const fillRef = useRef<HTMLDivElement>(null);
  const isLast = colleague ? slideIndex === colleague.slides.length - 1 : false;

  // How much of the current slide's duration has already elapsed. Persisted
  // across pause→resume cycles so unpausing resumes the timer mid-slide instead
  // of restarting it. Reset to 0 only when the active slide actually changes.
  const elapsedRef = useRef(0);

  useEffect(() => {
    elapsedRef.current = 0;
  }, [slideIndex, currentColleagueId]);

  // Progress bar + auto-advance. Halts on any of the three flags — `paused`
  // is hold-to-pause, `pausedByVisibility` is tab/app hidden, `previewingMedia`
  // is the mosaic lightbox. Audio also halts on the first two (only previewing
  // lets audio keep going); see useAudioEngine.
  useEffect(() => {
    if (!colleague || !slide) return;
    if (halted || previewingMedia) return;
    if (isLast) {
      if (fillRef.current) fillRef.current.style.width = '100%';
      return;
    }
    const duration = getSlideDuration(slide);
    // Anchor the start so `Date.now() - startedAt === elapsedRef.current` at
    // tick zero — i.e. resume where the last interval left off.
    const startedAt = Date.now() - elapsedRef.current;
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      elapsedRef.current = elapsed;
      const pct = Math.min(100, (elapsed / duration) * 100);
      if (fillRef.current) fillRef.current.style.width = `${pct}%`;
      if (elapsed >= duration) {
        clearInterval(timer);
        nextSlideAction(colleague.slides.length);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [slideIndex, slide, colleague, isLast, nextSlideAction, halted, previewingMedia]);

  // Keyboard shortcuts. Disabled while halted OR while a mosaic preview is
  // open — the lightbox owns Escape (capture-phase listener inside it) and
  // arrow keys would otherwise navigate the deck out from under the user.
  useEffect(() => {
    if (!colleague) return;
    const onKey = (e: KeyboardEvent) => {
      if (halted || previewingMedia) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlideAction(colleague.slides.length);
      } else if (e.key === 'ArrowLeft') {
        prevSlideAction();
      } else if (e.key === 'Escape') {
        closePlayer();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleAudio();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [colleague, nextSlideAction, prevSlideAction, closePlayer, toggleAudio, halted, previewingMedia]);

  // -------- Hold-to-pause (Instagram-style) --------
  // Pointer events on the player root. A press that lasts HOLD_PAUSE_MS without
  // moving > HOLD_MOVE_THRESHOLD_PX flips paused=true. On release we flip back
  // and suppress the trailing click so nav-zones don't navigate.
  const holdTimerRef = useRef<number | null>(null);
  const wasHoldRef = useRef(false);
  const downPosRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  const cancelHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button / touch / pen.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    wasHoldRef.current = false;
    downPosRef.current = { x: e.clientX, y: e.clientY };
    cancelHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      wasHoldRef.current = true;
      setPaused(true);
    }, HOLD_PAUSE_MS);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!downPosRef.current || wasHoldRef.current) return;
    const dx = e.clientX - downPosRef.current.x;
    const dy = e.clientY - downPosRef.current.y;
    if (Math.hypot(dx, dy) > HOLD_MOVE_THRESHOLD_PX) {
      // Movement = scroll/swipe, not hold. Cancel pending pause.
      cancelHoldTimer();
    }
  };

  const finishPointer = () => {
    cancelHoldTimer();
    downPosRef.current = null;
    if (wasHoldRef.current) {
      setPaused(false);
      // The click that follows pointerup should not navigate. Reset on the
      // next tick once the click handler has had a chance to read the flag.
      suppressClickRef.current = true;
      setTimeout(() => {
        suppressClickRef.current = false;
        wasHoldRef.current = false;
      }, 0);
    }
  };

  if (!colleague || !slide) {
    // Either nothing to play or colleague disappeared — close.
    if (currentColleagueId) closePlayer();
    return null;
  }

  return (
    <div
      className={`player${paused ? ' player-paused' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="progress-bar">
        {colleague.slides.map((_, i) => (
          <div key={i} className="progress-segment">
            <div
              ref={i === slideIndex ? fillRef : undefined}
              className="fill"
              style={{ width: i < slideIndex ? '100%' : i > slideIndex ? '0%' : undefined }}
            />
          </div>
        ))}
      </div>

      <button className="player-mute" onClick={toggleAudio} title="Mute/unmute">
        {audioEnabled ? '🔊' : '🔇'}
      </button>
      <button className="player-close" onClick={closePlayer} title="Exit">
        ×
      </button>

      <div
        className="nav-zone left"
        onClick={() => {
          if (suppressClickRef.current || paused) return;
          prevSlideAction();
        }}
      />
      <div
        className="nav-zone right"
        onClick={() => {
          if (suppressClickRef.current || paused) return;
          nextSlideAction(colleague.slides.length);
        }}
      />

      <SlideRenderer
        slide={slide}
        colleague={colleague}
        onReplay={() => setSlideIndex(0)}
        onClose={closePlayer}
      />

      {/* The keepsake slides have their own track list / spirit animal hero,
          so the now-playing bubble would just clutter the captured PNG and the
          live view. Audio still plays — that's wired to slide.songUrl in the
          audio engine, independent of this UI. */}
      {slide.songUrl &&
        slide.songName &&
        slide.type !== 'spirit-animal' &&
        slide.type !== 'soundtrack' && (
          <div className="now-playing">
            {slide.songArt && <img src={slide.songArt} alt="" />}
            <div className="np-text">
              <div className="np-title">{slide.songName}</div>
              <div className="np-artist">{slide.songArtist || ''}</div>
            </div>
          </div>
        )}

      {/* Autoplay-blocked fallback. Most browsers permit playback after the
          unlock click, but iOS Low Power mode and a few corporate browsers
          still block it — this gives the user one tap to start the music. */}
      {autoplayBlocked && audioEnabled && (
        <div
          id="unmute-overlay"
          onPointerDown={(e) => {
            // Don't let this tap also trigger hold-to-pause on the player root.
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            unblockAutoplay();
          }}
        >
          <div className="unmute-inner">
            <div className="unmute-icon">🔊</div>
            <div className="unmute-text">Tap for sound</div>
          </div>
        </div>
      )}
    </div>
  );
}
