import type { Colleague, OrbFinaleSlide } from '../../types';
import { MemoryOrb } from '../orb/MemoryOrb';

export function OrbFinaleSlideView({
  colleague,
}: {
  slide: OrbFinaleSlide;
  colleague: Colleague;
}) {
  return <MemoryOrb colleague={colleague} />;
}
