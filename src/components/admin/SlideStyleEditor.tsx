import { useRef, useState } from 'react';
import type {
  Slide,
  SlideBg,
  FragmentType,
  FragmentDensity,
  FragmentPattern,
  BgConfig,
  GradientBg,
  LavaBg,
  TextColor,
  LavaSpeed,
} from '../../types';
import {
  SLIDE_BG_OPTIONS,
  FRAGMENT_PRESETS,
  FRAGMENT_TYPE_ORDER,
  FRAGMENT_PATTERNS,
  FRAGMENT_PATTERN_ORDER,
  DEFAULT_FRAGMENT_PATTERN_BY_TYPE,
  DEFAULT_LAVA_BG,
  PRESET_BG_GRADIENTS,
} from '../../utils/constants';
import { readFileAsDataURL, compressImage, gradientFromPreset } from '../../utils';

interface Props {
  slide: Slide;
  onPatch: (patch: Partial<Slide>) => void;
}

const DENSITIES: FragmentDensity[] = ['sparse', 'medium', 'dense'];
const LAVA_SPEEDS: LavaSpeed[] = ['slow', 'medium', 'fast'];
const MIN_BLOBS = 2;
const MAX_BLOBS = 6;

export function SlideStyleEditor({ slide, onPatch }: Props) {
  return (
    <>
      <div className="style-editor">
        <BgEditor bg={slide.bg} onPatch={(bg) => onPatch({ bg })} />
      </div>
      <div className="style-editor">
        <FragmentEditor
          fragments={slide.fragments}
          onPatch={(fragments) => onPatch({ fragments })}
        />
      </div>
    </>
  );
}

// ============================================================
// BG EDITOR (Preset / Custom / Lava tabs)
// ============================================================

function BgEditor({ bg, onPatch }: { bg: BgConfig; onPatch: (bg: BgConfig) => void }) {
  const [tab, setTab] = useState<BgConfig['kind']>(bg.kind);

  const switchTab = (next: BgConfig['kind']) => {
    setTab(next);
    if (next === bg.kind) return;
    if (next === 'preset') {
      const preset: SlideBg = bg.kind === 'preset' ? bg.preset : 'bg-pink';
      onPatch({ kind: 'preset', preset });
    } else if (next === 'gradient') {
      const seed: GradientBg =
        bg.kind === 'preset' ? gradientFromPreset(bg.preset) : gradientFromPreset('bg-pink');
      onPatch(seed);
    } else {
      onPatch({ ...DEFAULT_LAVA_BG });
    }
  };

  /** Customize a preset's `from` color via the native picker.
   *  Flips bg from preset → gradient with the new `from` and the preset's original `to`,
   *  and bumps the tab to Custom so the user can keep editing. */
  const customizePreset = (preset: SlideBg, newFrom: string) => {
    const grad = gradientFromPreset(preset);
    onPatch({ ...grad, from: newFrom });
    setTab('gradient');
  };

  return (
    <>
      <label className="field-label">Background</label>
      <div className="bg-tabs">
        <button type="button" className={`bg-tab${tab === 'preset' ? ' active' : ''}`} onClick={() => switchTab('preset')}>Preset</button>
        <button type="button" className={`bg-tab${tab === 'gradient' ? ' active' : ''}`} onClick={() => switchTab('gradient')}>Custom</button>
        <button type="button" className={`bg-tab${tab === 'lava' ? ' active' : ''}`} onClick={() => switchTab('lava')}>Lava</button>
      </div>

      {bg.kind === 'preset' && <PresetTab bg={bg} onPatch={onPatch} onCustomize={customizePreset} />}
      {bg.kind === 'gradient' && <GradientTab bg={bg} onPatch={onPatch} />}
      {bg.kind === 'lava' && <LavaTab bg={bg} onPatch={onPatch} />}
    </>
  );
}

function PresetTab({
  bg,
  onPatch,
  onCustomize,
}: {
  bg: { kind: 'preset'; preset: SlideBg };
  onPatch: (bg: BgConfig) => void;
  onCustomize: (preset: SlideBg, newFrom: string) => void;
}) {
  return (
    <div className="preset-grid">
      {SLIDE_BG_OPTIONS.map((preset) => (
        <PresetTile
          key={preset}
          preset={preset}
          active={bg.preset === preset}
          onSelect={() => onPatch({ kind: 'preset', preset })}
          onCustomize={(newFrom) => onCustomize(preset, newFrom)}
        />
      ))}
    </div>
  );
}

/** A single Canva-style preset tile: full-area click selects the preset; a hover-revealed
 *  pencil icon opens the native color picker via a hidden input, letting the user replace
 *  the gradient's first stop. */
function PresetTile({
  preset,
  active,
  onSelect,
  onCustomize,
}: {
  preset: SlideBg;
  active: boolean;
  onSelect: () => void;
  onCustomize: (hex: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const presetMeta = PRESET_BG_GRADIENTS[preset];

  return (
    <div className={`preset-tile ${preset}${active ? ' active' : ''}`}>
      <button
        type="button"
        className="preset-tile-select"
        onClick={onSelect}
        title={preset.replace('bg-', '')}
        aria-label={`Background ${preset.replace('bg-', '')}`}
      />
      <button
        type="button"
        className="preset-tile-edit"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
        title="Customize colors"
        aria-label="Customize colors"
      >
        ✎
      </button>
      <input
        ref={inputRef}
        type="color"
        defaultValue={presetMeta.from}
        onChange={(e) => onCustomize(e.target.value)}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1, top: 0, left: 0 }}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

function GradientTab({ bg, onPatch }: { bg: GradientBg; onPatch: (bg: BgConfig) => void }) {
  const update = (patch: Partial<GradientBg>) => onPatch({ ...bg, ...patch });

  return (
    <>
      <div className="gradient-stops-row">
        <span className="stop-label">From</span>
        <input
          type="color"
          value={bg.from}
          onChange={(e) => update({ from: e.target.value })}
        />
        <span className="stop-arrow">→</span>
        <span className="stop-label">To</span>
        <input
          type="color"
          value={bg.to}
          onChange={(e) => update({ to: e.target.value })}
        />
      </div>
      <div className="slider-row">
        <span>Shape</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <ToggleBtn active={bg.shape === 'linear'} onClick={() => update({ shape: 'linear' })}>Linear</ToggleBtn>
          <ToggleBtn active={bg.shape === 'radial'} onClick={() => update({ shape: 'radial' })}>Radial</ToggleBtn>
        </div>
        <span />
      </div>
      {bg.shape === 'linear' && (
        <div className="slider-row">
          <span>Angle</span>
          <input
            type="range"
            min={0}
            max={360}
            step={5}
            value={bg.angle}
            onChange={(e) => update({ angle: parseInt(e.target.value) })}
          />
          <span>{bg.angle}°</span>
        </div>
      )}
      <TextColorToggle value={bg.textColor} onChange={(textColor) => update({ textColor })} />
    </>
  );
}

function LavaTab({ bg, onPatch }: { bg: LavaBg; onPatch: (bg: BgConfig) => void }) {
  const update = (patch: Partial<LavaBg>) => onPatch({ ...bg, ...patch });
  const updateBlob = (i: number, color: string) => {
    const next = bg.blobs.map((b, idx) => (idx === i ? { color } : b));
    update({ blobs: next });
  };
  const addBlob = () => {
    if (bg.blobs.length >= MAX_BLOBS) return;
    update({ blobs: [...bg.blobs, { color: '#FF6B9D' }] });
  };
  const removeBlob = (i: number) => {
    if (bg.blobs.length <= MIN_BLOBS) return;
    update({ blobs: bg.blobs.filter((_, idx) => idx !== i) });
  };

  return (
    <>
      <ColorRow label="Base" hex={bg.baseColor} onChange={(baseColor) => update({ baseColor })} />

      <div className="slider-row" style={{ gridTemplateColumns: '80px 1fr' }}>
        <span>Blobs</span>
        <span>{bg.blobs.length} / {MAX_BLOBS}</span>
      </div>
      <div className="blobs-grid">
        {bg.blobs.map((blob, i) => (
          <div key={i} className="blob-row">
            <ColorRow
              label={`#${i + 1}`}
              hex={blob.color}
              onChange={(c) => updateBlob(i, c)}
            />
            <button
              type="button"
              className="icon-btn danger"
              onClick={() => removeBlob(i)}
              disabled={bg.blobs.length <= MIN_BLOBS}
              title="Remove blob"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="add-blob-btn"
        onClick={addBlob}
        disabled={bg.blobs.length >= MAX_BLOBS}
      >
        + Add blob
      </button>

      <div className="slider-row">
        <span>Speed</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {LAVA_SPEEDS.map((s) => (
            <ToggleBtn key={s} active={bg.speed === s} onClick={() => update({ speed: s })}>
              {s}
            </ToggleBtn>
          ))}
        </div>
        <span />
      </div>
      <div className="slider-row">
        <span>Blur</span>
        <input
          type="range"
          min={20}
          max={150}
          step={5}
          value={bg.blur}
          onChange={(e) => update({ blur: parseInt(e.target.value) })}
        />
        <span>{bg.blur}px</span>
      </div>
      <TextColorToggle value={bg.textColor} onChange={(textColor) => update({ textColor })} />
    </>
  );
}

// ============================================================
// FRAGMENT EDITOR (source / pattern / density)
// ============================================================

function FragmentEditor({
  fragments,
  onPatch,
}: {
  fragments: Slide['fragments'];
  onPatch: (f: Slide['fragments']) => void;
}) {
  const setPresetSource = (type: FragmentType) => {
    if (fragments?.source.kind === 'preset' && fragments.source.type === type) {
      onPatch(undefined); // toggle off
      return;
    }
    onPatch({
      source: { kind: 'preset', type },
      pattern: fragments?.pattern ?? DEFAULT_FRAGMENT_PATTERN_BY_TYPE[type],
      density: fragments?.density ?? 'medium',
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const compressed: string[] = [];
    for (const f of files) {
      const dataUrl = await readFileAsDataURL(f);
      compressed.push(await compressImage(dataUrl, 200));
    }
    const existing = fragments?.source.kind === 'image' ? fragments.source.dataUrls : [];
    onPatch({
      source: { kind: 'image', dataUrls: [...existing, ...compressed] },
      pattern: fragments?.pattern ?? 'fall',
      density: fragments?.density ?? 'medium',
    });
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    if (fragments?.source.kind !== 'image') return;
    const next = fragments.source.dataUrls.filter((_, i) => i !== idx);
    if (next.length === 0) {
      onPatch(undefined); // last image removed → no fragments
    } else {
      onPatch({ ...fragments, source: { kind: 'image', dataUrls: next } });
    }
  };

  const setPattern = (pattern: FragmentPattern) => {
    if (!fragments) return;
    onPatch({ ...fragments, pattern });
  };

  const setDensity = (density: FragmentDensity) => {
    if (!fragments) return;
    onPatch({ ...fragments, density });
  };

  const isPresetActive = (type: FragmentType) =>
    fragments?.source.kind === 'preset' && fragments.source.type === type;

  return (
    <>
      <label className="field-label">Floating fragments</label>
      <div className="fragment-picker-row">
        <button
          type="button"
          className={`fragment-option${!fragments ? ' active' : ''}`}
          onClick={() => onPatch(undefined)}
        >
          None
        </button>
        {FRAGMENT_TYPE_ORDER.map((type) => {
          const preset = FRAGMENT_PRESETS[type];
          return (
            <button
              key={type}
              type="button"
              className={`fragment-option${isPresetActive(type) ? ' active' : ''}`}
              onClick={() => setPresetSource(type)}
              title={preset.label}
            >
              <span className="frag-emoji">{preset.emoji}</span>
              {preset.label}
            </button>
          );
        })}
        <label
          className={`fragment-option${fragments?.source.kind === 'image' ? ' active' : ''}`}
          style={{ cursor: 'pointer' }}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />
          📤 {fragments?.source.kind === 'image' ? 'Add more' : 'Upload images'}
        </label>
      </div>

      {fragments?.source.kind === 'image' && (
        <div className="fragment-image-gallery">
          {fragments.source.dataUrls.map((src, i) => (
            <div key={i} className="fragment-image-cell">
              <img src={src} alt="" />
              <button
                type="button"
                className="icon-btn danger"
                onClick={() => removeImage(i)}
                title="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {fragments && (
        <>
          <div className="slider-row" style={{ gridTemplateColumns: '80px 1fr' }}>
            <span>Motion</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {FRAGMENT_PATTERN_ORDER.map((p) => (
                <ToggleBtn
                  key={p}
                  active={fragments.pattern === p}
                  onClick={() => setPattern(p)}
                  title={FRAGMENT_PATTERNS[p].hint}
                >
                  {FRAGMENT_PATTERNS[p].label}
                </ToggleBtn>
              ))}
            </div>
          </div>
          <div className="density-row">
            <span>Density:</span>
            {DENSITIES.map((d) => (
              <button
                key={d}
                type="button"
                className={`density-btn${fragments.density === d ? ' active' : ''}`}
                onClick={() => setDensity(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ============================================================
// Small primitives
// ============================================================

function ColorRow({
  label,
  hex,
  onChange,
}: {
  label?: string;
  hex: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="color-row">
      {label && <label>{label}</label>}
      <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`density-btn${active ? ' active' : ''}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

function TextColorToggle({ value, onChange }: { value: TextColor; onChange: (v: TextColor) => void }) {
  return (
    <div className="slider-row">
      <span>Text color</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <ToggleBtn active={value === 'light'} onClick={() => onChange('light')}>Light</ToggleBtn>
        <ToggleBtn active={value === 'dark'} onClick={() => onChange('dark')}>Dark</ToggleBtn>
      </div>
      <span />
    </div>
  );
}
