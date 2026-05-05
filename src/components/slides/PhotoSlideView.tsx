import type { PhotoSlide } from '../../types';

export function PhotoSlideView({ slide }: { slide: PhotoSlide }) {
  return (
    <>
      <div className="slide-eyebrow">{slide.eyebrow || 'A moment'}</div>
      {slide.media ? (
        <div className="photo-frame">
          {slide.media.kind === 'video' ? (
            <video src={slide.media.src} autoPlay muted loop playsInline />
          ) : (
            <img src={slide.media.src} alt="" />
          )}
          {slide.caption && <div className="photo-caption">{slide.caption}</div>}
        </div>
      ) : (
        <div style={{ opacity: 0.5 }}>[no media]</div>
      )}
      {slide.sub && <p>{slide.sub}</p>}
    </>
  );
}
