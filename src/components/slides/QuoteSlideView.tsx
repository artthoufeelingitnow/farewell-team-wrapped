import type { QuoteSlide } from '../../types';

export function QuoteSlideView({ slide }: { slide: QuoteSlide }) {
  return (
    <>
      {slide.eyebrow && <div className="slide-eyebrow">{slide.eyebrow}</div>}
      <div className="quote-mark">"</div>
      <div className="quote-body">{slide.body || ''}</div>
      {slide.attrib && <div className="quote-attrib">{slide.attrib}</div>}
    </>
  );
}
