import type { IntroSlide, Colleague } from '../../types';

export function IntroSlideView({ slide, colleague }: { slide: IntroSlide; colleague: Colleague }) {
  return (
    <>
      <div className="slide-eyebrow">{slide.eyebrow || `For ${colleague.name}`}</div>
      <h2>{slide.title || 'A wrapped, just for you'}</h2>
      {slide.sub && <p>{slide.sub}</p>}
    </>
  );
}
