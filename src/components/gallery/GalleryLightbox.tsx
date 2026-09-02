import { useEffect, useRef, useState } from 'react';
import type { SpiritAnimalSlide } from '../../types';
import { saveCardAsPng } from '../../utils/wrapped';
import { showToast } from '../../store/toastStore';
import { SpiritAnimalCard } from '../slides/SpiritAnimalCard';

/**
 * Tap a polaroid → the card it came from, full size.
 *
 * Renders the same <SpiritAnimalCard> the player does, so what someone sees on
 * the wall is literally their deck's card and not a lookalike. Dismiss by
 * dragging down (the mosaic lightbox's gesture), tapping the scrim, or Escape.
 *
 * Opens before the card exists: the wall only holds cover images up front, so
 * `slide` arrives once that person's blob is fetched and decrypted. Some are
 * 25 MB, so the wait is real and gets a spinner rather than a frozen tap.
 */

const DISMISS_PX = 110;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_LABEL: Record<SaveState, string> = {
  idle: '⬇ Save to gallery',
  saving: 'Saving…',
  saved: 'Saved!',
  error: "Couldn't save — try again?",
};

interface Props {
  /** Known from the index, so the card can be titled while it loads. */
  name: string;
  /** null while the card is still in flight. */
  slide: SpiritAnimalSlide | null;
  failed?: boolean;
  onClose: () => void;
}

export function GalleryLightbox({ name, slide, failed, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Freeze the wall behind the overlay so a drag doesn't scroll both.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const handleSave = async () => {
    if (!cardRef.current || saveState === 'saving') return;
    setSaveState('saving');
    try {
      await saveCardAsPng(cardRef.current, name || 'cat', 'spirit-animal');
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (err) {
      console.error('Failed to save card:', err);
      setSaveState('error');
      showToast("Couldn't save — try again?");
      setTimeout(() => setSaveState('idle'), 2200);
    }
  };

  return (
    <div
      className="wall-lightbox"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ opacity: 1 - Math.min(dragY / (DISMISS_PX * 2.2), 0.55) }}
    >
      <div
        className="wall-lightbox-inner"
        style={{ transform: `translateY(${dragY}px)` }}
        onPointerDown={(e) => {
          startYRef.current = e.clientY;
        }}
        onPointerMove={(e) => {
          if (startYRef.current === null) return;
          // Downward only — an upward drag shouldn't peel the card off screen.
          setDragY(Math.max(0, e.clientY - startYRef.current));
        }}
        onPointerUp={() => {
          if (dragY > DISMISS_PX) onClose();
          else setDragY(0);
          startYRef.current = null;
        }}
        onPointerCancel={() => {
          setDragY(0);
          startYRef.current = null;
        }}
      >
        {slide ? (
          <SpiritAnimalCard slide={slide} cardRef={cardRef} />
        ) : (
          <div className="wall-card-placeholder">
            {failed ? (
              <p>Couldn't load this one — tap to close and try again.</p>
            ) : (
              <>
                <span className="wall-card-spinner" aria-hidden="true" />
                <p>{name}</p>
              </>
            )}
          </div>
        )}

        <div className="wall-lightbox-actions" data-html-to-image-ignore>
          {slide && (
            <button
              className="keepsake-save"
              onClick={() => void handleSave()}
              disabled={saveState === 'saving'}
            >
              {SAVE_LABEL[saveState]}
            </button>
          )}
          <button className="wall-lightbox-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
