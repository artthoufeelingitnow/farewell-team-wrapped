import type { PhotoSlide } from '../../types';

export function PhotoSlideView({ slide }: { slide: PhotoSlide }) {
  return (
    <>
      <div className="slide-eyebrow">{slide.eyebrow || 'A moment'}</div>
      {slide.photoData ? (
        <div className="photo-frame">
          <img src={slide.photoData} alt="" />
          {slide.caption && <div className="photo-caption">{slide.caption}</div>}
        </div>
      ) : (
        <div style={{ opacity: 0.5 }}>[no photo]</div>
      )}
      {slide.sub && <p>{slide.sub}</p>}
    </>
  );
}
