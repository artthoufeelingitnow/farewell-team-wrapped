import { useMemo } from 'react';
import type { FragmentConfig } from '../../types';
import { FRAGMENT_PRESETS, FRAGMENT_DENSITY_COUNTS } from '../../utils/constants';

interface Props {
  config: FragmentConfig | undefined;
}

interface Particle {
  left: number;
  top: number; // only matters for in-place "twinkle" types and `drift` start position
  delay: number;
  duration: number;
  scale: number;
  drift: number;
  imageIndex: number; // which uploaded image to use (image source only)
}

export function FragmentLayer({ config }: Props) {
  const particles = useMemo<Particle[]>(() => {
    if (!config) return [];
    const count = FRAGMENT_DENSITY_COUNTS[config.density];
    const imageCount =
      config.source.kind === 'image' ? Math.max(1, config.source.dataUrls.length) : 1;
    // Seeded RNG so positions stay stable across re-renders for a given config.
    const seedKey =
      config.source.kind === 'preset'
        ? config.source.type + config.pattern + config.density
        : 'image' + imageCount + config.pattern + config.density;
    let seed = 0;
    for (let i = 0; i < seedKey.length; i++) seed = (seed * 31 + seedKey.charCodeAt(i)) % 2147483647;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: count }, () => ({
      left: rand() * 100,
      top: rand() * 100,
      delay: rand() * 8,
      duration: 6 + rand() * 8,
      scale: 0.7 + rand() * 0.8,
      drift: (rand() - 0.5) * 80,
      imageIndex: Math.floor(rand() * imageCount),
    }));
  }, [config]);

  if (!config) return null;

  const isImage = config.source.kind === 'image';
  const images = config.source.kind === 'image' ? config.source.dataUrls : [];
  const emoji = config.source.kind === 'preset' ? FRAGMENT_PRESETS[config.source.type].emoji : null;

  return (
    <div className={`fragment-layer fragment-pattern-${config.pattern}`} aria-hidden="true">
      {particles.map((p, i) => {
        const baseStyle: React.CSSProperties = {
          left: `${p.left}%`,
          top: `${p.top}%`,
          animationDelay: `-${p.delay}s`,
          animationDuration: `${p.duration}s`,
          ['--drift' as string]: `${p.drift}px`,
        };
        if (isImage && images.length > 0) {
          return (
            <img
              key={i}
              src={images[p.imageIndex] ?? images[0]}
              alt=""
              className="fragment fragment-img"
              style={{ ...baseStyle, width: `${p.scale * 32}px`, height: 'auto' }}
            />
          );
        }
        return (
          <span
            key={i}
            className="fragment"
            style={{ ...baseStyle, fontSize: `${p.scale * 24}px` }}
          >
            {emoji}
          </span>
        );
      })}
    </div>
  );
}
