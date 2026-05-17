import type { Slide, Colleague } from '../../types';
import { FragmentLayer } from './FragmentLayer';
import { SlideBackground, bgNeedsDarkText } from './SlideBackground';
import { IntroSlideView } from './IntroSlideView';
import { StatSlideView } from './StatSlideView';
import { PhotoSlideView } from './PhotoSlideView';
import { QuoteSlideView } from './QuoteSlideView';
import { PodiumSlideView } from './PodiumSlideView';
import { LetterSlideView } from './LetterSlideView';
import { MosaicSlideView } from './MosaicSlideView';
import { SpiritAnimalSlideView } from './SpiritAnimalSlideView';
import { SoundtrackSlideView } from './SoundtrackSlideView';
import { MemeSlideView } from './MemeSlideView';
import { SignoffSlideView } from './SignoffSlideView';

interface Props {
  slide: Slide;
  colleague: Colleague;
  onReplay: () => void;
  onClose: () => void;
}

export function SlideRenderer({ slide, colleague, onReplay, onClose }: Props) {
  const darkText = bgNeedsDarkText(slide.bg);

  return (
    <div className={`slide slide-${slide.type}${darkText ? ' text-dark' : ''}`}>
      <SlideBackground config={slide.bg} />
      <FragmentLayer config={slide.fragments} />
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
    case 'spirit-animal': return <SpiritAnimalSlideView slide={slide} colleague={colleague} />;
    case 'soundtrack': return <SoundtrackSlideView slide={slide} colleague={colleague} />;
    case 'meme': return <MemeSlideView slide={slide} colleague={colleague} />;
    case 'signoff': return <SignoffSlideView slide={slide} onReplay={onReplay} onClose={onClose} />;
  }
}
