import { useEffect, useRef, useState } from 'react';
import type { GalleryEntry } from '../../types';
import { saveCardAsPng } from '../../utils/wrapped';
import { showToast } from '../../store/toastStore';
import { SpiritAnimalCard } from '../slides/SpiritAnimalCard';

/**
 * Tap a polaroid → the card it came from, full size.
 *
 * Renders the same <SpiritAnimalCard> the player does, so what someone sees on
 * the wall is literally their deck's card and not a lookalike. Dismiss by
 * dragging down (the mosaic lightbox's gesture), tapping the scrim, or Escape.
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
  entry: GalleryEntry;
  onClose: () => void;
}

export function GalleryLightbox({ entry, onClose }: Props) {
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
      await saveCardAsPng(cardRef.current, entry.name || 'cat', 'spirit-animal');
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
        <SpiritAnimalCard slide={entry.slide} cardRef={cardRef} />

        <div className="wall-lightbox-actions" data-html-to-image-ignore>
          <button
            className="keepsake-save"
            onClick={() => void handleSave()}
            disabled={saveState === 'saving'}
          >
            {SAVE_LABEL[saveState]}
          </button>
          <button className="wall-lightbox-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
