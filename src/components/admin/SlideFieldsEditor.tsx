import { useRef, useState } from 'react';
import type {
  Slide,
  PodiumSlide,
  MosaicSlide,
  PhotoSlide,
  MediaItem,
  PodiumItem,
  SpiritAnimalSlide,
  SpiritAnimalSection,
  SoundtrackSlide,
  MemeSlide,
  TitleFontKind,
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
    case 'spirit-animal':
      return <SpiritAnimalFields slide={slide} onPatch={onPatch} />;
    case 'soundtrack':
      return <SoundtrackFields slide={slide} colleague={colleague} onPatch={onPatch} />;
    case 'meme':
      return <MemeFields slide={slide} onPatch={onPatch} />;
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
    // GIFs go through unchanged — running them through compressImage()'s
    // canvas → JPEG pipeline strips the animation. Other image types get
    // compressed to 900px JPEG to keep the export blob small.
    const src = file.type === 'image/gif' ? dataUrl : await compressImage(dataUrl, 900);
    onPatch({ media: { kind: 'image', src } });
    e.target.value = '';
  };

  const handleVideoUrl = () => {
    const url = prompt(
      'Paste video/GIF URL (e.g. https://artthoufeelingitnow.github.io/farewell-team-wrapped/videos/clip.mp4):',
    );
    if (!url) return;
    const trimmed = url.trim();
    if (!trimmed) return;
    onPatch({ media: { kind: 'video', src: trimmed } });
  };

  const media = slide.media;

  return (
    <div className="slide-fields">
      <div className="full">
        {media && (
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
            {media.kind === 'video' ? (
              <video
                className="photo-thumb"
                src={media.src}
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <img className="photo-thumb" src={media.src} />
            )}
            <button
              className="icon-btn danger"
              style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, fontSize: 12 }}
              onClick={() => onPatch({ media: undefined })}
              title="Remove media"
            >
              ×
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <label className="photo-upload" style={{ flex: 1 }}>
            <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
            {media?.kind === 'image' ? '🔁 Replace image / GIF' : '📷 Image / GIF'}
          </label>
          <button
            type="button"
            className="photo-upload"
            style={{ flex: 1, fontFamily: 'inherit' }}
            onClick={handleVideoUrl}
          >
            {media?.kind === 'video' ? '🔁 Change video URL' : '🎥 Video URL'}
          </button>
        </div>
      </div>
      <Field label="Eyebrow" value={slide.eyebrow ?? ''} placeholder="a moment in time" onChange={(v) => onPatch({ eyebrow: v })} />
      <Field label="Caption (under media)" value={slide.caption ?? ''} placeholder="that time when..." onChange={(v) => onPatch({ caption: v })} />
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

function SoundtrackFields({
  slide,
  colleague,
  onPatch,
}: {
  slide: SoundtrackSlide;
  colleague: Colleague;
  onPatch: (patch: Partial<Slide>) => void;
}) {
  const allSongs = getSoundtrack(colleague);
  const allKeys = new Set(allSongs.map((t) => t.key));
  // `undefined` means "auto-pick first 5". As soon as the user touches the
  // picker we materialize that auto pick into a concrete array so toggles read
  // intuitively (everything pre-selected, click to opt out).
  // Stored keys are also filtered against the current song list — orphaned
  // keys (from songs that were renamed or removed elsewhere in the deck) get
  // pruned so the "N/5" counter stays accurate.
  const stored = slide.featuredTrackKeys?.filter((k) => allKeys.has(k));
  const featured = stored ?? allSongs.slice(0, MAX_FEATURED_TRACKS).map((t) => t.key);
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

  // Swap the song at `key` with its neighbor in the given direction. Promotes
  // an auto-pick into a stored order (same way `toggle` does) the moment the
  // user nudges an item.
  const moveBy = (key: string, delta: -1 | 1) => {
    const idx = featured.indexOf(key);
    if (idx === -1) return;
    const target = idx + delta;
    if (target < 0 || target >= featured.length) return;
    const next = [...featured];
    [next[idx], next[target]] = [next[target], next[idx]];
    onPatch({ featuredTrackKeys: next });
  };

  const resetToAuto = () => onPatch({ featuredTrackKeys: undefined });

  const isAuto = slide.featuredTrackKeys === undefined;

  // Map for key → track lookup. Featured rows render in `featured` order
  // (user-chosen sequence), unfeatured rows fall back to deck order via
  // `allSongs`.
  const trackByKey = new Map(allSongs.map((t) => [t.key, t]));
  const featuredTracks = featured
    .map((k) => trackByKey.get(k))
    .filter((t): t is (typeof allSongs)[number] => !!t);
  const unfeaturedTracks = allSongs.filter((t) => !featuredSet.has(t.key));

  return (
    <div className="slide-fields">
      <Field
        label="Eyebrow (small caps)"
        value={slide.eyebrow ?? ''}
        placeholder="your soundtrack"
        onChange={(v) => onPatch({ eyebrow: v })}
        full
      />
      <Field
        label="Title (optional, below eyebrow)"
        value={slide.title ?? ''}
        placeholder="vibes for [name]"
        onChange={(v) => onPatch({ title: v })}
        full
      />

      <TitleFontPicker
        value={slide.titleFont}
        onChange={(titleFont) => onPatch({ titleFont })}
      />

      <Field
        label="Tagline (italic, at bottom)"
        value={slide.tagline ?? ''}
        placeholder="e.g. on repeat all year"
        onChange={(v) => onPatch({ tagline: v })}
        full
      />

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
            {featuredTracks.map((t, i) => (
              <label key={t.key} className="wrapped-track-row is-checked">
                <input
                  type="checkbox"
                  checked
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
                <div className="wrapped-track-row-reorder">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={(e) => { e.stopPropagation(); moveBy(t.key, -1); }}
                    title="Move up"
                  >↑</button>
                  <button
                    type="button"
                    disabled={i === featuredTracks.length - 1}
                    onClick={(e) => { e.stopPropagation(); moveBy(t.key, +1); }}
                    title="Move down"
                  >↓</button>
                </div>
              </label>
            ))}

            {featuredTracks.length > 0 && unfeaturedTracks.length > 0 && (
              <div className="wrapped-track-divider">add more</div>
            )}

            {unfeaturedTracks.map((t) => {
              const disabled = isAtCap;
              return (
                <label
                  key={t.key}
                  className={`wrapped-track-row${disabled ? ' is-disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={false}
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

function MemeFields({
  slide,
  onPatch,
}: {
  slide: MemeSlide;
  onPatch: (patch: Partial<Slide>) => void;
}) {
  const handleVideoUrl = () => {
    const url = prompt(
      'Paste video URL (e.g. https://artthoufeelingitnow.github.io/farewell-team-wrapped/videos/meme.mp4):',
      slide.videoUrl ?? '',
    );
    if (url === null) return;
    const trimmed = url.trim();
    onPatch({ videoUrl: trimmed || undefined });
  };

  const handleClearVideo = () => onPatch({ videoUrl: undefined });

  return (
    <div className="slide-fields">
      <Field
        label="Eyebrow (small caps)"
        value={slide.eyebrow ?? ''}
        placeholder="before we continue, here's a meme..."
        onChange={(v) => onPatch({ eyebrow: v })}
        full
      />

      <div className="full">
        <label className="field-label">Video</label>
        {slide.videoUrl ? (
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <video
              src={slide.videoUrl}
              autoPlay
              muted
              loop
              playsInline
              style={{
                width: '100%', maxHeight: 220, borderRadius: 8,
                background: '#000', objectFit: 'contain', display: 'block',
              }}
            />
            <button
              className="icon-btn danger"
              style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, fontSize: 12 }}
              onClick={handleClearVideo}
              title="Remove video"
            >
              ×
            </button>
          </div>
        ) : (
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.45)',
              fontStyle: 'italic',
              marginBottom: 8,
            }}
          >
            No video yet — paste a hosted MP4 URL.
          </div>
        )}
        <button
          type="button"
          className="photo-upload"
          style={{ width: '100%', fontFamily: 'inherit' }}
          onClick={handleVideoUrl}
        >
          {slide.videoUrl ? '🔁 Change video URL' : '🎥 Paste video URL'}
        </button>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
          Download the TikTok/IG, convert to MP4 (H.264), drop into
          public/videos/, commit, then paste the GitHub Pages URL.
        </div>
      </div>

      <Field
        label="Tagline (italic, at bottom)"
        value={slide.tagline ?? ''}
        placeholder="e.g. iykyk"
        onChange={(v) => onPatch({ tagline: v })}
        full
      />
    </div>
  );
}

function SpiritAnimalFields({
  slide,
  onPatch,
}: {
  slide: SpiritAnimalSlide;
  onPatch: (patch: Partial<Slide>) => void;
}) {
  const updateSection = (side: 'left' | 'right', patch: Partial<SpiritAnimalSection>) => {
    const current = slide[side] ?? {};
    const next: SpiritAnimalSection = { ...current, ...patch };
    // Drop empty section if everything is cleared.
    const hasAnyValue = !!(next.media || next.caption || next.mediaPosition);
    onPatch({ [side]: hasAnyValue ? next : undefined } as Partial<SpiritAnimalSlide>);
  };

  return (
    <div className="slide-fields">
      <Field
        label="Eyebrow (small caps)"
        value={slide.eyebrow ?? ''}
        placeholder="this is you if you were a cat..."
        onChange={(v) => onPatch({ eyebrow: v })}
        full
      />
      <Field
        label="Title (optional)"
        value={slide.title ?? ''}
        placeholder="drowning cat of awareness & realisation"
        onChange={(v) => onPatch({ title: v })}
        full
      />

      <TitleFontPicker
        value={slide.titleFont}
        onChange={(titleFont) => onPatch({ titleFont })}
      />

      <div className="full">
        <div className="spirit-fields-grid">
          <SectionEditor
            label="Left section"
            section={slide.left}
            onChange={(patch) => updateSection('left', patch)}
          />
          <SectionEditor
            label="Right section"
            section={slide.right}
            onChange={(patch) => updateSection('right', patch)}
          />
        </div>
      </div>

      <Field
        label="Tagline"
        value={slide.tagline ?? ''}
        placeholder="you realised you deserved better..."
        onChange={(v) => onPatch({ tagline: v })}
        type="textarea"
        full
      />
      <Field
        label="Caption (optional)"
        value={slide.caption ?? ''}
        placeholder="a small note below the tagline"
        onChange={(v) => onPatch({ caption: v })}
        full
      />
    </div>
  );
}

function SectionEditor({
  label,
  section,
  onChange,
}: {
  label: string;
  section: SpiritAnimalSection | undefined;
  onChange: (patch: Partial<SpiritAnimalSection>) => void;
}) {
  const FRAME_PX = 130;
  const media = section?.media;
  const pos = section?.mediaPosition ?? { x: 50, y: 50 };
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 50, posY: 50 });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataURL(file);
    // GIFs go through unchanged — running them through compressImage()'s
    // canvas → JPEG pipeline strips the animation.
    const src = file.type === 'image/gif' ? dataUrl : await compressImage(dataUrl, 700);
    onChange({ media: { kind: 'image', src }, mediaPosition: undefined });
    e.target.value = '';
  };

  const handleVideoUrl = () => {
    const url = prompt(
      'Paste video/GIF URL (e.g. https://artthoufeelingitnow.github.io/farewell-team-wrapped/videos/cat.mp4):',
    );
    if (!url) return;
    const trimmed = url.trim();
    if (!trimmed) return;
    onChange({ media: { kind: 'video', src: trimmed }, mediaPosition: undefined });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!media) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
    setDragging(true);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const x = Math.max(0, Math.min(100, dragStartRef.current.posX - (dx / FRAME_PX) * 100));
    const y = Math.max(0, Math.min(100, dragStartRef.current.posY - (dy / FRAME_PX) * 100));
    onChange({ mediaPosition: { x, y } });
  };
  const handlePointerUp = () => setDragging(false);

  const objectPosition = `${pos.x}% ${pos.y}%`;
  const dragStyle: React.CSSProperties = {
    objectPosition,
    cursor: dragging ? 'grabbing' : 'grab',
    touchAction: 'none',
  };

  return (
    <div className="spirit-section-editor">
      <div className="field-label" style={{ marginBottom: 6 }}>{label}</div>
      <div className="spirit-section-editor-frame">
        {media ? (
          media.kind === 'video' ? (
            <video
              src={media.src}
              autoPlay
              muted
              loop
              playsInline
              draggable={false}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={dragStyle}
            />
          ) : (
            <img
              src={media.src}
              alt=""
              draggable={false}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={dragStyle}
            />
          )
        ) : (
          <div className="spirit-section-editor-empty">No media</div>
        )}
      </div>
      {media && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 4, textAlign: 'center' }}>
          Drag to reposition
          {section?.mediaPosition && (
            <button
              type="button"
              onClick={() => onChange({ mediaPosition: undefined })}
              style={{
                marginLeft: 6, background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                fontSize: 10, padding: 0, textDecoration: 'underline',
              }}
            >
              ↺ center
            </button>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <label className="photo-upload" style={{ flex: 1, fontSize: 11, padding: '6px 8px' }}>
          <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
          📷 Image / GIF
        </label>
        <button
          type="button"
          className="photo-upload"
          style={{ flex: 1, fontFamily: 'inherit', fontSize: 11, padding: '6px 8px' }}
          onClick={handleVideoUrl}
        >
          🎥 Video URL
        </button>
      </div>
      {media && (
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          style={{ fontSize: 11, marginTop: 6, width: '100%' }}
          onClick={() => onChange({ media: undefined, mediaPosition: undefined })}
        >
          Remove media
        </button>
      )}
      <input
        type="text"
        className="field-input"
        value={section?.caption ?? ''}
        placeholder="Caption"
        style={{ marginTop: 8, fontSize: 13 }}
        onChange={(e) => onChange({ caption: e.target.value })}
      />
    </div>
  );
}

/** Two-button picker for the keepsake title font. Used by both the soundtrack
 *  and spirit-animal slide editors. `undefined` means "use default" (display). */
function TitleFontPicker({
  value,
  onChange,
}: {
  value: TitleFontKind | undefined;
  onChange: (v: TitleFontKind | undefined) => void;
}) {
  const isDisplay = (value ?? 'display') === 'display';
  const isSpotify = value === 'spotify';
  return (
    <div className="full">
      <label className="field-label">Title font</label>
      <div className="title-font-picker">
        <button
          type="button"
          className={`title-font-option${isDisplay ? ' is-active' : ''}`}
          onClick={() => onChange(undefined)}
        >
          <span className="title-font-sample" style={{ fontFamily: "'Jua', sans-serif" }}>Aa</span>
          <span className="title-font-label">Display</span>
        </button>
        <button
          type="button"
          className={`title-font-option${isSpotify ? ' is-active' : ''}`}
          onClick={() => onChange('spotify')}
        >
          <span
            className="title-font-sample"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 900,
              letterSpacing: '-0.02em',
              textTransform: 'lowercase',
            }}
          >
            aa
          </span>
          <span className="title-font-label">Spotify</span>
        </button>
      </div>
    </div>
  );
}
