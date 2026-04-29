import type { LetterSlide } from '../../types';

export function LetterSlideView({ slide }: { slide: LetterSlide }) {
  return (
    <div className="letter-wrap">
      {slide.greeting && <div className="letter-greeting">{slide.greeting}</div>}
      <div className="letter-body">{slide.body || ''}</div>
      {slide.signoff && <div className="letter-signoff">{slide.signoff}</div>}
    </div>
  );
}
