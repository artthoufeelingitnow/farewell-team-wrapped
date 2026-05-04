import type { Colleague, OrbFinaleSlide } from '../../types';
import { MemoryOrb } from '../orb/MemoryOrb';

export function OrbFinaleSlideView({
  slide,
  colleague,
}: {
  slide: OrbFinaleSlide;
  colleague: Colleague;
}) {
  return <MemoryOrb colleague={colleague} config={slide.orb} />;
}
