import type {
  Slide,
  PodiumSlide,
  MosaicSlide,
  PhotoSlide,
  MediaItem,
  PodiumItem,
  WrappedFinaleSlide,
  Colleague,
} from '../../types';
import { readFileAsDataURL, compressImage } from '../../utils';
import { getSoundtrack, MAX_FEATURED_TRACKS } from '../../utils/wrapped';

interface Props {
  slide: Slide;
  colleague: Colleague;
  onPatch: (patch: Partial<Slide>) => void;
}

export function SlideFieldsEditor({ slide, colleague, onPatch }: Props) {
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
    case 'wrapped-finale':
      return <WrappedFinaleFields slide={slide} colleague={colleague} onPatch={onPatch} />;
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

function WrappedFinaleFields({
  slide,
  colleague,
  onPatch,
}: {
  slide: WrappedFinaleSlide;
  colleague: Colleague;
  onPatch: (patch: Partial<Slide>) => void;
}) {
  const allSongs = getSoundtrack(colleague);
  // `undefined` means "auto-pick first 5". As soon as the user touches the
  // picker we materialize that auto pick into a concrete array so toggles read
  // intuitively (everything pre-selected, click to opt out).
  const featured = slide.featuredTrackKeys ?? allSongs.slice(0, MAX_FEATURED_TRACKS).map((t) => t.key);
  const featuredSet = new Set(featured);
  const isAtCap = featured.length >= MAX_FEATURED_TRACKS;

  const toggle = (key: string) => {
    const next = featuredSet.has(key)
      ? featured.filter((k) => k !== key)
      : isAtCap
        ? featured
        : [...featured, key];
    onPatch({ featuredTrackKeys: next });
  };

  const resetToAuto = () => onPatch({ featuredTrackKeys: undefined });

  const isAuto = slide.featuredTrackKeys === undefined;

  return (
    <div className="slide-fields">
      <div className="full" style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.45 }}>
        🎁 Spirit animal (image, name, tagline) is set at the top of this colleague's editor. Pick which songs to feature on the wrapped card below — capped at {MAX_FEATURED_TRACKS}, just like Spotify Wrapped.
      </div>

      {allSongs.length === 0 ? (
        <div className="full" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
          No songs on any slides yet. Add a song to a slide and it'll appear here.
        </div>
      ) : (
        <div className="full">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label className="field-label" style={{ margin: 0 }}>
              Featured songs ({featured.length}/{MAX_FEATURED_TRACKS})
              {isAuto && <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.5, fontWeight: 400 }}>auto</span>}
            </label>
            {!isAuto && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                style={{ fontSize: 11 }}
                onClick={resetToAuto}
                title="Auto-pick the first 5 songs in the deck"
              >
                ↺ Auto
              </button>
            )}
          </div>
          <div className="wrapped-track-picker">
            {allSongs.map((t) => {
              const checked = featuredSet.has(t.key);
              const disabled = !checked && isAtCap;
              return (
                <label
                  key={t.key}
                  className={`wrapped-track-row${checked ? ' is-checked' : ''}${disabled ? ' is-disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(t.key)}
                  />
                  {t.art ? (
                    <img src={t.art} alt="" className="wrapped-track-row-art" />
                  ) : (
                    <div className="wrapped-track-row-art wrapped-track-row-art-empty" />
                  )}
                  <div className="wrapped-track-row-meta">
                    <div className="wrapped-track-row-name">{t.name}</div>
                    {t.artist && <div className="wrapped-track-row-artist">{t.artist}</div>}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
