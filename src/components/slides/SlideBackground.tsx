import type { BgConfig, GradientBg, LavaBg, PresetBg } from '../../types';
import { LAVA_SPEED_DURATION_S, PRESET_BG_GRADIENTS } from '../../utils/constants';

interface Props {
  config: BgConfig;
}

/**
 * Renders the slide background as the first layer inside `.slide`.
 * Three modes (discriminated by `kind`):
 *   - preset: classic predefined gradient (uses the bg-* CSS class)
 *   - gradient: custom 2-stop linear/radial gradient via inline style
 *   - lava: animated colored blobs over a base color
 */
export function SlideBackground({ config }: Props) {
  if (config.kind === 'preset') return <PresetBackground config={config} />;
  if (config.kind === 'gradient') return <GradientBackground config={config} />;
  return <LavaBackground config={config} />;
}

function PresetBackground({ config }: { config: PresetBg }) {
  return <div className={`slide-bg ${config.preset}`} />;
}

function GradientBackground({ config }: { config: GradientBg }) {
  const css =
    config.shape === 'radial'
      ? `radial-gradient(circle at center, ${config.from} 0%, ${config.to} 100%)`
      : `linear-gradient(${config.angle}deg, ${config.from} 0%, ${config.to} 100%)`;
  return <div className="slide-bg" style={{ background: css }} />;
}

function LavaBackground({ config }: { config: LavaBg }) {
  const durationS = LAVA_SPEED_DURATION_S[config.speed];
  return (
    <div className="slide-bg lava-bg" style={{ backgroundColor: config.baseColor }}>
      <div className="lava-blobs" style={{ filter: `blur(${config.blur}px)` }}>
        {config.blobs.map((b, i) => (
          <div
            key={i}
            className={`lava-blob lava-blob-${i % 5}`}
            style={{
              backgroundColor: b.color,
              animationDuration: `${durationS}s`,
              animationDelay: `-${(i * durationS) / Math.max(1, config.blobs.length)}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** True if the bg config asks for dark text (e.g. cream / yellow). Used by SlideRenderer
 *  to set a `text-dark` class on the slide. */
export function bgNeedsDarkText(config: BgConfig): boolean {
  if (config.kind === 'preset') return PRESET_BG_GRADIENTS[config.preset].textColor === 'dark';
  return config.textColor === 'dark';
}
