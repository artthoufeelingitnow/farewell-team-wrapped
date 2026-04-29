import type { SignoffSlide } from '../../types';

interface Props {
  slide: SignoffSlide;
  onReplay: () => void;
  onClose: () => void;
}

export function SignoffSlideView({ slide, onReplay, onClose }: Props) {
  return (
    <>
      <div className="slide-eyebrow">{slide.eyebrow || 'Until next time'}</div>
      <h2>{slide.title || 'Thank you'}</h2>
      {slide.sub && <p>{slide.sub}</p>}
      <div className="end-actions">
        <button onClick={onReplay}>Replay</button>
        <button onClick={onClose}>Close</button>
      </div>
    </>
  );
}
