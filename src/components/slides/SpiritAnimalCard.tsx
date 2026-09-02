import type { RefObject } from 'react';
import type { SpiritAnimalSlide, SpiritAnimalSection, MediaItem } from '../../types';

/**
 * The spirit-animal keepsake card itself — the node html-to-image captures.
 *
 * Extracted from SpiritAnimalSlideView so the polaroid wall can render the
 * identical card when a photo is tapped. Two copies of this markup would drift
 * the moment either card's typography changed, and the whole promise of the
 * wall is that it shows the *same* card the deck does.
 *
 * The `.keepsake` shell (absolute, inset 0) stays with each caller: in the
 * player it fills the slide, on the wall it sits inside the lightbox.
 */
interface Props {
  slide: SpiritAnimalSlide;
  /** The captured node, when the caller offers a "save as PNG" button. */
  cardRef?: RefObject<HTMLDivElement | null>;
}

export const DEFAULT_SPIRIT_EYEBROW = 'this is you if you were a cat...';

export function SpiritAnimalCard({ slide, cardRef }: Props) {
  const eyebrow = slide.eyebrow?.trim() || DEFAULT_SPIRIT_EYEBROW;
  const title = slide.title?.trim() ? slide.title : '';
  const titleClass = `keepsake-title${slide.titleFont === 'spotify' ? ' font-spotify' : ''}`;

  return (
    <div className="keepsake-card keepsake-card-spirit-animal" ref={cardRef}>
      {eyebrow && <div className="keepsake-eyebrow">{eyebrow}</div>}
      {title && <div className={titleClass}>{title}</div>}

      <div className="spirit-sections">
        <Section section={slide.left} side="left" />
        <Section section={slide.right} side="right" />
      </div>

      {slide.tagline && <div className="keepsake-tagline">{slide.tagline}</div>}
      {slide.caption && <div className="keepsake-caption">{slide.caption}</div>}
    </div>
  );
}

function Section({
  section,
  side,
}: {
  section: SpiritAnimalSection | undefined;
  side: 'left' | 'right';
}) {
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
  return <img className="spirit-section-img" src={media.src} alt="" style={{ objectPosition }} />;
}
