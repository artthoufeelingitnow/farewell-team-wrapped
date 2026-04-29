import type { MosaicSlide } from '../../types';

export function MosaicSlideView({ slide }: { slide: MosaicSlide }) {
  const photos = (slide.photos || []).filter(Boolean);

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
          <img key={i} src={p} alt="" />
        ))}
      </div>
      {slide.sub && <p>{slide.sub}</p>}
    </>
  );
}
