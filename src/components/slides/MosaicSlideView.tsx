import { useEffect, useRef, useState } from 'react';
import type { MosaicSlide } from '../../types';
import { usePlayerStore } from '../../store/playerStore';

const SWIPE_DISMISS_PX = 100;
const TAP_THRESHOLD_PX = 6;

export function MosaicSlideView({ slide }: { slide: MosaicSlide }) {
  const photos = (slide.photos || []).filter(Boolean);
  const setPaused = usePlayerStore((s) => s.setPaused);
  const [expandedSrc, setExpandedSrc] = useState<string | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);

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

  const closeLightbox = () => {
    setDragY(0);
    setDragging(false);
    setExpandedSrc(null);
  };

  const onLightboxPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startYRef.current = e.clientY;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onLightboxPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dy = e.clientY - startYRef.current;
    setDragY(Math.max(0, dy)); // clamp upward drag — only downward dismisses
  };

  const onLightboxPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (dragY >= SWIPE_DISMISS_PX || dragY < TAP_THRESHOLD_PX) {
      // Either a successful swipe-down OR a tap (effectively no drag) — both close.
      closeLightbox();
    } else {
      // Partial swipe — snap back.
      setDragY(0);
    }
  };

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
          role="dialog"
          aria-modal="true"
          onPointerDown={onLightboxPointerDown}
          onPointerMove={onLightboxPointerMove}
          onPointerUp={onLightboxPointerUp}
          onPointerCancel={onLightboxPointerUp}
          style={{
            backgroundColor: dragY > 0
              ? `rgba(0, 0, 0, ${Math.max(0.4, 0.92 - dragY / 400)})`
              : undefined,
          }}
        >
          <div
            className="photo-lightbox-content"
            style={{
              transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
              opacity: dragY > 0 ? Math.max(0.5, 1 - dragY / 300) : 1,
              transition: dragging ? 'none' : 'transform 0.2s ease, opacity 0.2s ease',
            }}
          >
            <img src={expandedSrc} alt="" draggable={false} />
            <div className="photo-lightbox-hint">Swipe down</div>
          </div>
        </div>
      )}
    </>
  );
}
