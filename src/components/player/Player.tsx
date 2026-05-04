import { useEffect, useRef } from 'react';
import { useAppStore } from '../../store/appStore';
import { usePlayerStore } from '../../store/playerStore';
import { useAudioEngine } from '../../hooks/useAudioEngine';
import { SlideRenderer } from '../slides/SlideRenderer';
import { getSlideDuration } from '../../utils';

export function Player() {
  const colleagues = useAppStore((s) => s.data.colleagues);
  const currentColleagueId = usePlayerStore((s) => s.currentColleagueId);
  const slideIndex = usePlayerStore((s) => s.slideIndex);
  const audioEnabled = usePlayerStore((s) => s.audioEnabled);
  const paused = usePlayerStore((s) => s.paused);
  const setSlideIndex = usePlayerStore((s) => s.setSlideIndex);
  const nextSlideAction = usePlayerStore((s) => s.nextSlide);
  const prevSlideAction = usePlayerStore((s) => s.prevSlide);
  const closePlayer = usePlayerStore((s) => s.closePlayer);
  const toggleAudio = usePlayerStore((s) => s.toggleAudio);

  const colleague = colleagues.find((c) => c.id === currentColleagueId);
  const slide = colleague?.slides[slideIndex];
  const nextSlide = colleague?.slides[slideIndex + 1];

  useAudioEngine({
    active: !!colleague && !!slide,
    slide,
    nextSlide,
    audioEnabled,
  });

  const fillRef = useRef<HTMLDivElement>(null);
  const isLast = colleague ? slideIndex === colleague.slides.length - 1 : false;

  // Progress bar + auto-advance
  useEffect(() => {
    if (!colleague || !slide) return;
    if (paused) return;
    if (isLast) {
      if (fillRef.current) fillRef.current.style.width = '100%';
      return;
    }
    const duration = getSlideDuration(slide);
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      if (fillRef.current) fillRef.current.style.width = `${pct}%`;
      if (elapsed >= duration) {
        clearInterval(timer);
        nextSlideAction(colleague.slides.length);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [slideIndex, slide, colleague, isLast, nextSlideAction, paused]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!colleague) return;
    const onKey = (e: KeyboardEvent) => {
      if (paused) return;
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
  }, [colleague, nextSlideAction, prevSlideAction, closePlayer, toggleAudio, paused]);

  if (!colleague || !slide) {
    // Either nothing to play or colleague disappeared — close.
    if (currentColleagueId) closePlayer();
    return null;
  }

  return (
    <div className="player">
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
          if (!paused) prevSlideAction();
        }}
      />
      <div
        className="nav-zone right"
        onClick={() => {
          if (!paused) nextSlideAction(colleague.slides.length);
        }}
      />

      <SlideRenderer
        slide={slide}
        colleague={colleague}
        onReplay={() => setSlideIndex(0)}
        onClose={closePlayer}
      />

      {slide.songUrl && slide.songName && (
        <div className="now-playing">
          {slide.songArt && <img src={slide.songArt} alt="" />}
          <div className="np-text">
            <div className="np-title">{slide.songName}</div>
            <div className="np-artist">{slide.songArtist || ''}</div>
          </div>
        </div>
      )}

    </div>
  );
}
