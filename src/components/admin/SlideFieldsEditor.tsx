import type {
  Slide,
  PodiumSlide,
  MosaicSlide,
  PhotoSlide,
  MediaItem,
  PodiumItem,
  OrbFinaleSlide,
  OrbConfig,
  OrbGeometryPreset,
} from '../../types';
import { readFileAsDataURL, compressImage } from '../../utils';

interface Props {
  slide: Slide;
  onPatch: (patch: Partial<Slide>) => void;
}

export function SlideFieldsEditor({ slide, onPatch }: Props) {
  switch (slide.type) {
    case 'intro':
      return (
        <div className="slide-fields">
          <Field label="Eyebrow" value={slide.eyebrow ?? ''} placeholder="for [name]" onChange={(v) => onPatch({ eyebrow: v })} />
          <Field label="Title" value={slide.title ?? ''} placeholder="a wrapped, just for you" onChange={(v) => onPatch({ title: v })} />
          <Field label="Subtitle" value={slide.sub ?? ''} placeholder="a short opening line" onChange={(v) => onPatch({ sub: v })} type="textarea" full />
        </div>
      );
    case 'stat':
      return (
        <div className="slide-fields">
          <Field label="Eyebrow" value={slide.eyebrow ?? ''} placeholder="so, this is the amount of times..." onChange={(v) => onPatch({ eyebrow: v })} />
          <Field label="Big number/text" value={slide.bigNumber ?? ''} placeholder='e.g. 24/7 or "infinite"' onChange={(v) => onPatch({ bigNumber: v })} />
          <Field label="Label below number" value={slide.label ?? ''} placeholder="something" onChange={(v) => onPatch({ label: v })} />
          <Field label="Caption" value={slide.sub ?? ''} placeholder="some other context if needed haha" onChange={(v) => onPatch({ sub: v })} type="textarea" full />
        </div>
      );
    case 'photo':
      return <PhotoFields slide={slide} onPatch={onPatch} />;
    case 'quote':
      return (
        <div className="slide-fields">
          <Field label="Eyebrow" value={slide.eyebrow ?? ''} placeholder="Optional" onChange={(v) => onPatch({ eyebrow: v })} />
          <Field label="Quote" value={slide.body ?? ''} placeholder="you always said this..." onChange={(v) => onPatch({ body: v })} type="textarea" full />
          <Field label="Attribution" value={slide.attrib ?? ''} placeholder="— Bobby, probably" onChange={(v) => onPatch({ attrib: v })} />
        </div>
      );
    case 'podium':
      return <PodiumFields slide={slide} onPatch={onPatch} />;
    case 'letter':
      return (
        <div className="slide-fields">
          <Field label="Greeting" value={slide.greeting ?? ''} placeholder="greetings," onChange={(v) => onPatch({ greeting: v })} />
          <Field label="Letter body" value={slide.body ?? ''} placeholder="insert long, emotional message" onChange={(v) => onPatch({ body: v })} type="textarea" full />
          <Field label="Sign off" value={slide.signoff ?? ''} placeholder="— mic" onChange={(v) => onPatch({ signoff: v })} />
        </div>
      );
    case 'mosaic':
      return <MosaicFields slide={slide} onPatch={onPatch} />;
    case 'orb-finale':
      return <OrbFinaleFields slide={slide} onPatch={onPatch} />;
    case 'signoff':
      return (
        <div className="slide-fields">
          <Field label="Eyebrow" value={slide.eyebrow ?? ''} placeholder="until next time" onChange={(v) => onPatch({ eyebrow: v })} />
          <Field label="Title" value={slide.title ?? ''} placeholder="thank you" onChange={(v) => onPatch({ title: v })} />
          <Field label="Subtitle" value={slide.sub ?? ''} placeholder="have a good life." onChange={(v) => onPatch({ sub: v })} type="textarea" full />
        </div>
      );
  }
}

interface FieldProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (val: string) => void;
  type?: 'input' | 'textarea';
  full?: boolean;
}

function Field({ label, value, placeholder, onChange, type = 'input', full }: FieldProps) {
  const cls = full ? 'full' : '';
  return (
    <div className={cls}>
      <label className="field-label">{label}</label>
      {type === 'textarea' ? (
        <textarea
          className="field-textarea"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type="text"
          className="field-input"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function PhotoFields({ slide, onPatch }: { slide: PhotoSlide; onPatch: (patch: Partial<Slide>) => void }) {
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataURL(file);
    const compressed = await compressImage(dataUrl, 900);
    onPatch({ photoData: compressed });
  };

  return (
    <div className="slide-fields">
      <div className="full">
        {slide.photoData && <img className="photo-thumb" src={slide.photoData} />}
        <label className="photo-upload">
          <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
          {slide.photoData ? '🔁 Replace photo' : '📷 Upload photo'}
        </label>
      </div>
      <Field label="Eyebrow" value={slide.eyebrow ?? ''} placeholder="a moment in time" onChange={(v) => onPatch({ eyebrow: v })} />
      <Field label="Caption (under photo)" value={slide.caption ?? ''} placeholder="that time when..." onChange={(v) => onPatch({ caption: v })} />
      <Field label="Subtitle below" value={slide.sub ?? ''} placeholder="Optional" onChange={(v) => onPatch({ sub: v })} />
    </div>
  );
}

function PodiumFields({ slide, onPatch }: { slide: PodiumSlide; onPatch: (patch: Partial<Slide>) => void }) {
  const items = slide.items ?? [
    { name: '', count: '' },
    { name: '', count: '' },
    { name: '', count: '' },
  ];

  const updateItem = (idx: number, patch: Partial<PodiumItem>) => {
    const nextItems = [...items];
    while (nextItems.length <= idx) nextItems.push({ name: '', count: '' });
    nextItems[idx] = { ...nextItems[idx], ...patch };
    onPatch({ items: nextItems });
  };

  const handlePhotoUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataURL(file);
    const compressed = await compressImage(dataUrl, 700);
    updateItem(idx, { media: { kind: 'image', src: compressed } });
    e.target.value = '';
  };

  const handleVideoUrl = (idx: number) => {
    const url = prompt('Paste video URL:');
    if (!url) return;
    const trimmed = url.trim();
    if (!trimmed) return;
    updateItem(idx, { media: { kind: 'video', src: trimmed } });
  };

  const handleRemoveMedia = (idx: number) => {
    updateItem(idx, { media: undefined });
  };

  return (
    <div className="slide-fields">
      <Field label="Eyebrow" value={slide.eyebrow ?? ''} placeholder="the top 3..." onChange={(v) => onPatch({ eyebrow: v })} />
      <Field label="Title" value={slide.title ?? ''} placeholder="things or whatever..." onChange={(v) => onPatch({ title: v })} />
      {[0, 1, 2].map((i) => {
        const item = items[i] ?? { name: '', count: '' };
        const media = item.media;
        return (
          <div key={i} className="full" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, marginTop: 4 }}>
            <label className="field-label" style={{ marginBottom: 8 }}>#{i + 1}</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
              <input
                type="text"
                className="field-input"
                value={item.name}
                placeholder={`Item ${i + 1}`}
                onChange={(e) => updateItem(i, { name: e.target.value })}
              />
              <input
                type="text"
                className="field-input"
                value={item.count}
                placeholder="e.g. every Tuesday"
                onChange={(e) => updateItem(i, { count: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {media && (
                <div style={{ position: 'relative', width: 60, height: 45, borderRadius: 6, overflow: 'hidden', background: '#000', flexShrink: 0 }}>
                  {media.kind === 'video' ? (
                    <video src={media.src} muted autoPlay loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <img src={media.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                  <button
                    className="icon-btn danger"
                    style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, fontSize: 10 }}
                    onClick={() => handleRemoveMedia(i)}
                  >
                    ×
                  </button>
                </div>
              )}
              <label className="photo-upload" style={{ flex: 1, fontSize: 12, padding: '8px 10px' }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(i, e)}
                  style={{ display: 'none' }}
                />
                {media?.kind === 'image' ? '🔁 Replace photo' : '📷 Photo'}
              </label>
              <button
                type="button"
                className="photo-upload"
                style={{ flex: 1, fontFamily: 'inherit', fontSize: 12, padding: '8px 10px' }}
                onClick={() => handleVideoUrl(i)}
              >
                {media?.kind === 'video' ? '🔁 Change URL' : '🎥 Video URL'}
              </button>
            </div>
          </div>
        );
      })}
      <Field label="Caption below" value={slide.sub ?? ''} placeholder="Optional" onChange={(v) => onPatch({ sub: v })} full />
    </div>
  );
}

function MosaicFields({ slide, onPatch }: { slide: MosaicSlide; onPatch: (patch: Partial<Slide>) => void }) {
  const media = slide.media ?? [];

  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const next: MediaItem[] = [...media];
    for (const f of files) {
      if (next.length >= 9) break;
      const dataUrl = await readFileAsDataURL(f);
      const compressed = await compressImage(dataUrl, 700);
      next.push({ kind: 'image', src: compressed });
    }
    onPatch({ media: next });
    e.target.value = '';
  };

  const handleAddVideo = () => {
    if (media.length >= 9) return;
    const url = prompt(
      'Paste video URL (e.g. https://artthoufeelingitnow.github.io/farewell-team-wrapped/videos/clip.mp4):',
    );
    if (!url) return;
    const trimmed = url.trim();
    if (!trimmed) return;
    onPatch({ media: [...media, { kind: 'video', src: trimmed }] });
  };

  const handleRemove = (idx: number) => {
    onPatch({ media: media.filter((_, i) => i !== idx) });
  };

  return (
    <div className="slide-fields">
      <div className="full">
        {media.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
              gap: '6px',
              marginBottom: '8px',
            }}
          >
            {media.map((m, pi) => (
              <div key={pi} style={{ position: 'relative', aspectRatio: '1' }}>
                {m.kind === 'video' ? (
                  <video
                    src={m.src}
                    muted
                    autoPlay
                    loop
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', background: '#000' }}
                  />
                ) : (
                  <img src={m.src} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                )}
                {m.kind === 'video' && (
                  <span
                    style={{
                      position: 'absolute', bottom: 4, left: 4,
                      background: 'rgba(0,0,0,0.6)', color: '#fff',
                      padding: '1px 5px', borderRadius: 4,
                      fontSize: 9, fontWeight: 600, letterSpacing: 0.5,
                    }}
                  >
                    VIDEO
                  </span>
                )}
                <button
                  className="icon-btn danger"
                  style={{ position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', fontSize: '11px' }}
                  onClick={() => handleRemove(pi)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="photo-upload" style={{ flex: 1 }}>
            <input type="file" accept="image/*" multiple onChange={handleAddPhotos} style={{ display: 'none' }} />
            📷 Add photos
          </label>
          <button
            type="button"
            className="photo-upload"
            style={{ flex: 1, fontFamily: 'inherit' }}
            onClick={handleAddVideo}
            disabled={media.length >= 9}
          >
            🎥 Add video URL
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
          Up to 9 items total ({media.length}/9). Videos must be MP4/WebM URLs.
        </div>
      </div>
      <Field label="Eyebrow" value={slide.eyebrow ?? ''} placeholder="some pics or stuff" onChange={(v) => onPatch({ eyebrow: v })} />
      <Field label="Title" value={slide.title ?? ''} placeholder="here are the pics" onChange={(v) => onPatch({ title: v })} />
      <Field label="Caption" value={slide.sub ?? ''} placeholder="Optional" onChange={(v) => onPatch({ sub: v })} />
    </div>
  );
}

const ORB_PRESET_OPTIONS: { value: OrbGeometryPreset; label: string }[] = [
  { value: 'classic', label: '🔮 Classic — soft sphere' },
  { value: 'gem', label: '💎 Gem — sharper poles' },
  { value: 'rose', label: '🌸 Rose — pentagonal' },
  { value: 'diamond', label: '💠 Diamond — sharp gemstone (no noise)' },
  { value: 'crystal', label: '🪨 Crystal — chunky lobes' },
  { value: 'smooth', label: '⚪ Smooth — almost glassy' },
];

function OrbFinaleFields({
  slide,
  onPatch,
}: {
  slide: OrbFinaleSlide;
  onPatch: (patch: Partial<Slide>) => void;
}) {
  const orb = slide.orb ?? {};
  const updateOrb = (patch: Partial<OrbConfig>) => {
    const next = { ...orb, ...patch };
    // Strip keys that are explicitly undefined so the stored object stays
    // minimal — `undefined` means "use seed default" and shouldn't persist.
    for (const k of Object.keys(next) as (keyof OrbConfig)[]) {
      if (next[k] === undefined) delete next[k];
    }
    onPatch({ orb: Object.keys(next).length > 0 ? next : undefined });
  };

  return (
    <div className="slide-fields">
      <div className="full" style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.45, marginBottom: 4 }}>
        🔮 The orb is auto-generated from this colleague's name + photos. Override any
        of these to hand-tune their orb. Leave blank for the auto pick.
      </div>

      <div className="full">
        <label className="field-label">Mesh shape</label>
        <select
          className="field-select"
          value={orb.geometry ?? ''}
          onChange={(e) => updateOrb({ geometry: (e.target.value || undefined) as OrbGeometryPreset | undefined })}
        >
          <option value="">Auto (from name)</option>
          {ORB_PRESET_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <OrbSlider
        label="Lumpiness (noise amplitude)"
        value={orb.noiseAmplitude}
        min={0}
        max={0.2}
        step={0.005}
        autoMid={0.07}
        onChange={(v) => updateOrb({ noiseAmplitude: v })}
        format={(v) => v.toFixed(3)}
      />
      <OrbSlider
        label="Lobe size (noise scale)"
        value={orb.noiseScale}
        min={0.5}
        max={3.0}
        step={0.05}
        autoMid={1.2}
        onChange={(v) => updateOrb({ noiseScale: v })}
        format={(v) => v.toFixed(2)}
      />
      <OrbSlider
        label="Vertical offset"
        value={orb.orbY}
        min={-1}
        max={1}
        step={0.05}
        autoMid={0.4}
        onChange={(v) => updateOrb({ orbY: v })}
        format={(v) => v.toFixed(2)}
      />
      <OrbSlider
        label="Camera distance (orb size)"
        value={orb.cameraZ}
        min={2.5}
        max={7}
        step={0.1}
        autoMid={4.5}
        onChange={(v) => updateOrb({ cameraZ: v })}
        format={(v) => v.toFixed(1)}
      />
      <OrbSlider
        label="Particles"
        value={orb.particleCount}
        min={0}
        max={5000}
        step={100}
        autoMid={2500}
        onChange={(v) => updateOrb({ particleCount: v })}
        format={(v) => `${Math.round(v)}`}
      />
    </div>
  );
}

/** A range-slider field that supports an "auto" state (undefined). When auto,
 *  the slider visually parks at `autoMid` and shows "auto" instead of a number;
 *  moving it commits an override. The ↺ button clears the override. */
function OrbSlider({
  label,
  value,
  min,
  max,
  step,
  autoMid,
  onChange,
  format,
}: {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  step: number;
  autoMid: number;
  onChange: (v: number | undefined) => void;
  format: (v: number) => string;
}) {
  const isAuto = value === undefined;
  const sliderValue = value ?? autoMid;
  return (
    <div className="full">
      <label className="field-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{label}</span>
        <span style={{ fontSize: 11, color: isAuto ? 'rgba(255,255,255,0.4)' : '#fff', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {isAuto ? 'auto' : format(sliderValue)}
        </span>
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={sliderValue}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ flex: 1, opacity: isAuto ? 0.55 : 1 }}
        />
        <button
          type="button"
          onClick={() => onChange(undefined)}
          disabled={isAuto}
          title="Reset to auto"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.18)',
            color: '#fff',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 12,
            cursor: isAuto ? 'default' : 'pointer',
            opacity: isAuto ? 0.4 : 1,
          }}
        >
          ↺
        </button>
      </div>
    </div>
  );
}
