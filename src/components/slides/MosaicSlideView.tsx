import { useEffect, useState } from 'react';
import type { MosaicSlide } from '../../types';
import { usePlayerStore } from '../../store/playerStore';

export function MosaicSlideView({ slide }: { slide: MosaicSlide }) {
  const photos = (slide.photos || []).filter(Boolean);
  const setPaused = usePlayerStore((s) => s.setPaused);
  const [expandedSrc, setExpandedSrc] = useState<string | null>(null);

  // Pause auto-advance while a photo is expanded; ensure unpause on unmount.
  useEffect(() => {
    setPaused(!!expandedSrc);
    return () => setPaused(false);
  }, [expandedSrc, setPaused]);

  // Escape closes the lightbox before bubbling to the player's Escape (close player).
  useEffect(() => {
    if (!expandedSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setExpandedSrc(null);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [expandedSrc]);

  if (photos.length === 0) {
    return (
      <>
        <div className="slide-eyebrow">{slide.eyebrow || 'Memories'}</div>
        <h2>{slide.title || ''}</h2>
        <p style={{ opacity: 0.6 }}>[add photos]</p>
      </>
    );
  }

  // Pad up to 9 by repeating
  const padded = [...photos];
  while (padded.length < 9) padded.push(photos[padded.length % photos.length]);

  return (
    <>
      <div className="slide-eyebrow">{slide.eyebrow || 'Memories'}</div>
      <h2>{slide.title || ''}</h2>
      <div className="photo-mosaic">
        {padded.slice(0, 9).map((p, i) => (
          <img
            key={i}
            src={p}
            alt=""
            onClick={(e) => {
              e.stopPropagation();
              setExpandedSrc(p);
            }}
          />
        ))}
      </div>
      {slide.sub && <p>{slide.sub}</p>}

      {expandedSrc && (
        <div
          className="photo-lightbox"
          onClick={() => setExpandedSrc(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="photo-lightbox-close"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedSrc(null);
            }}
            aria-label="Close"
          >
            ×
          </button>
          <img src={expandedSrc} alt="" />
          <div className="photo-lightbox-hint">Tap anywhere or press Esc to close</div>
        </div>
      )}
    </>
  );
}
