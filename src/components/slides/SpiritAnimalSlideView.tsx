import { useRef, useState } from 'react';
import type { Colleague, SpiritAnimalSlide, SpiritAnimalSection, MediaItem } from '../../types';
import { saveCardAsPng } from '../../utils/wrapped';
import { showToast } from '../../store/toastStore';

interface Props {
  slide: SpiritAnimalSlide;
  colleague: Colleague;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_LABEL: Record<SaveState, string> = {
  idle: '⬇ Save to gallery',
  saving: 'Saving…',
  saved: 'Saved!',
  error: "Couldn't save — try again?",
};

export function SpiritAnimalSlideView({ slide, colleague }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const eyebrow = slide.eyebrow?.trim() || 'this is you if you were a cat...';
  const title = slide.title?.trim() ? slide.title : '';
  const titleClass = `keepsake-title${slide.titleFont === 'spotify' ? ' font-spotify' : ''}`;

  const handleSave = async () => {
    if (!cardRef.current || saveState === 'saving') return;
    setSaveState('saving');
    try {
      await saveCardAsPng(cardRef.current, colleague.name || 'wrapped', 'spirit-animal');
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (err) {
      console.error('Failed to save spirit animal:', err);
      setSaveState('error');
      showToast("Couldn't save — try again?");
      setTimeout(() => setSaveState('idle'), 2200);
    }
  };

  return (
    <div className="keepsake">
      <div className="keepsake-card keepsake-card-spirit-animal" ref={cardRef}>
        {eyebrow && <div className="keepsake-eyebrow">{eyebrow}</div>}
        {title && <div className={titleClass}>{title}</div>}

        <div className="spirit-sections">
          <Section section={slide.left} side="left" />
          <Section section={slide.right} side="right" />
        </div>

        {slide.tagline && (
          <div className="keepsake-tagline">{slide.tagline}</div>
        )}
        {slide.caption && (
          <div className="keepsake-caption">{slide.caption}</div>
        )}
      </div>

      <div className="keepsake-actions" data-html-to-image-ignore>
        <button
          className="keepsake-save"
          onClick={() => void handleSave()}
          disabled={saveState === 'saving'}
        >
          {SAVE_LABEL[saveState]}
        </button>
      </div>
    </div>
  );
}

function Section({ section, side }: { section: SpiritAnimalSection | undefined; side: 'left' | 'right' }) {
  const media = section?.media;
  const pos = section?.mediaPosition ?? { x: 50, y: 50 };
  const objectPosition = `${pos.x}% ${pos.y}%`;

  return (
    <div className={`spirit-section spirit-section-${side}`}>
      <div className="spirit-section-media">
        {media ? (
          <SectionMedia media={media} objectPosition={objectPosition} />
        ) : (
          <div className="spirit-section-empty" aria-hidden="true">
            <span>★</span>
          </div>
        )}
      </div>
      {section?.caption && <div className="spirit-section-caption">{section.caption}</div>}
    </div>
  );
}

function SectionMedia({ media, objectPosition }: { media: MediaItem; objectPosition: string }) {
  if (media.kind === 'video') {
    return (
      <video
        className="spirit-section-img"
        src={media.src}
        autoPlay
        muted
        loop
        playsInline
        crossOrigin="anonymous"
        style={{ objectPosition }}
      />
    );
  }
  return (
    <img
      className="spirit-section-img"
      src={media.src}
      alt=""
      style={{ objectPosition }}
    />
  );
}
