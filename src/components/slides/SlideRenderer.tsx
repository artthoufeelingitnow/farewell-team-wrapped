import type { Slide, Colleague } from '../../types';
import { SLIDE_TYPES } from '../../utils/constants';
import { IntroSlideView } from './IntroSlideView';
import { StatSlideView } from './StatSlideView';
import { PhotoSlideView } from './PhotoSlideView';
import { QuoteSlideView } from './QuoteSlideView';
import { PodiumSlideView } from './PodiumSlideView';
import { LetterSlideView } from './LetterSlideView';
import { MosaicSlideView } from './MosaicSlideView';
import { SignoffSlideView } from './SignoffSlideView';

interface Props {
  slide: Slide;
  colleague: Colleague;
  onReplay: () => void;
  onClose: () => void;
}

export function SlideRenderer({ slide, colleague, onReplay, onClose }: Props) {
  const bg = slide.bg || SLIDE_TYPES[slide.type]?.bg || 'bg-dark';

  return (
    <div className={`slide ${bg}`}>
      <SlideContent slide={slide} colleague={colleague} onReplay={onReplay} onClose={onClose} />
    </div>
  );
}

function SlideContent({ slide, colleague, onReplay, onClose }: Props) {
  switch (slide.type) {
    case 'intro': return <IntroSlideView slide={slide} colleague={colleague} />;
    case 'stat': return <StatSlideView slide={slide} />;
    case 'photo': return <PhotoSlideView slide={slide} />;
    case 'quote': return <QuoteSlideView slide={slide} />;
    case 'podium': return <PodiumSlideView slide={slide} />;
    case 'letter': return <LetterSlideView slide={slide} />;
    case 'mosaic': return <MosaicSlideView slide={slide} />;
    case 'signoff': return <SignoffSlideView slide={slide} onReplay={onReplay} onClose={onClose} />;
  }
}
