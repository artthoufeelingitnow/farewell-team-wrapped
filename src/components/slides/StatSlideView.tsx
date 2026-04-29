import type { StatSlide } from '../../types';

export function StatSlideView({ slide }: { slide: StatSlide }) {
  return (
    <>
      <div className="slide-eyebrow">{slide.eyebrow || ''}</div>
      <div className="big-number">{slide.bigNumber || '0'}</div>
      {slide.label && <h2 style={{ fontSize: 'clamp(28px, 5.5vw, 44px)' }}>{slide.label}</h2>}
      {slide.sub && <p>{slide.sub}</p>}
    </>
  );
}
