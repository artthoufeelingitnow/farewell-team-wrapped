import { useEffect, useRef, useState } from 'react';
import type { MosaicSlide, MediaItem } from '../../types';
import { usePlayerStore } from '../../store/playerStore';

const SWIPE_DISMISS_PX = 100;
const TAP_THRESHOLD_PX = 6;

export function MosaicSlideView({ slide }: { slide: MosaicSlide }) {
  // Source of truth is `media`. Migration converts old `photos` to media on load.
  const media = (slide.media || []).filter((m) => m && m.src);
  const setPreviewingMedia = usePlayerStore((s) => s.setPreviewingMedia);
  const [expandedItem, setExpandedItem] = useState<MediaItem | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);

  // Halt auto-advance while a media item is expanded — but NOT audio. The
  // soundtrack is the emotional underscore for the memory the user is
  // lingering on; cutting it mid-bar to zoom on a photo breaks the moment.
  // (Distinct from `paused`, which is hold-to-pause and stops both.)
  useEffect(() => {
    setPreviewingMedia(!!expandedItem);
    return () => setPreviewingMedia(false);
  }, [expandedItem, setPreviewingMedia]);

  // Escape closes the lightbox before bubbling to the player's Escape (close player).
  useEffect(() => {
    if (!expandedItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setExpandedItem(null);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [expandedItem]);

  const closeLightbox = () => {
    setDragY(0);
    setDragging(false);
    setExpandedItem(null);
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
      closeLightbox();
    } else {
      setDragY(0);
    }
  };

  if (media.length === 0) {
    return (
      <>
        <div className="slide-eyebrow">{slide.eyebrow || 'Memories'}</div>
        <h2>{slide.title || ''}</h2>
        <p style={{ opacity: 0.6 }}>[add photos or videos]</p>
      </>
    );
  }

  // Pad up to 9 by repeating
  const padded: MediaItem[] = [...media];
  while (padded.length < 9) padded.push(media[padded.length % media.length]);

  return (
    <>
      <div className="slide-eyebrow">{slide.eyebrow || 'Memories'}</div>
      <h2>{slide.title || ''}</h2>
      <div className="photo-mosaic">
        {padded.slice(0, 9).map((item, i) => (
          <MosaicCell
            key={i}
            item={item}
            onClick={() => setExpandedItem(item)}
          />
        ))}
      </div>
      {slide.sub && <p>{slide.sub}</p>}

      {expandedItem && (
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
            {expandedItem.kind === 'video' ? (
              <video
                src={expandedItem.src}
                muted
                autoPlay
                loop
                playsInline
                draggable={false}
              />
            ) : (
              <img src={expandedItem.src} alt="" draggable={false} />
            )}
            <div className="photo-lightbox-hint">Swipe down to exit view! ⬇️</div>
          </div>
        </div>
      )}
    </>
  );
}

/** Single cell of the mosaic — image or muted-autoplay-loop video. */
function MosaicCell({ item, onClick }: { item: MediaItem; onClick: () => void }) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };
  if (item.kind === 'video') {
    return (
      <video
        src={item.src}
        muted
        autoPlay
        loop
        playsInline
        onClick={handleClick}
      />
    );
  }
  return <img src={item.src} alt="" onClick={handleClick} />;
}
