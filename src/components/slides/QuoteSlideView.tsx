import type { QuoteSlide } from '../../types';

export function QuoteSlideView({ slide }: { slide: QuoteSlide }) {
  return (
    <>
      {slide.eyebrow && <div className="slide-eyebrow">{slide.eyebrow}</div>}
      <div className="quote-frame">
        <span className="quote-mark quote-mark-open" aria-hidden="true">&quot;</span>
        <div className="quote-body">{slide.body || ''}</div>
        <span className="quote-mark quote-mark-close" aria-hidden="true">&quot;</span>
      </div>
      {slide.attrib && <div className="quote-attrib">{slide.attrib}</div>}
    </>
  );
}
