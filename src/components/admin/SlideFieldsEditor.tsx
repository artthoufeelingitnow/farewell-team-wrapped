import type { Slide, PodiumSlide, MosaicSlide, PhotoSlide } from '../../types';
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
          <Field label="Eyebrow" value={slide.eyebrow ?? ''} placeholder="For [name]" onChange={(v) => onPatch({ eyebrow: v })} />
          <Field label="Title" value={slide.title ?? ''} placeholder="A wrapped, just for you" onChange={(v) => onPatch({ title: v })} />
          <Field label="Subtitle" value={slide.sub ?? ''} placeholder="A short opening line" onChange={(v) => onPatch({ sub: v })} type="textarea" full />
        </div>
      );
    case 'stat':
      return (
        <div className="slide-fields">
          <Field label="Eyebrow" value={slide.eyebrow ?? ''} placeholder="Together we..." onChange={(v) => onPatch({ eyebrow: v })} />
          <Field label="Big number/text" value={slide.bigNumber ?? ''} placeholder='e.g. 247 or "infinite"' onChange={(v) => onPatch({ bigNumber: v })} />
          <Field label="Label below number" value={slide.label ?? ''} placeholder="lessons taught" onChange={(v) => onPatch({ label: v })} />
          <Field label="Caption" value={slide.sub ?? ''} placeholder="Optional context" onChange={(v) => onPatch({ sub: v })} type="textarea" full />
        </div>
      );
    case 'photo':
      return <PhotoFields slide={slide} onPatch={onPatch} />;
    case 'quote':
      return (
        <div className="slide-fields">
          <Field label="Eyebrow" value={slide.eyebrow ?? ''} placeholder="Optional" onChange={(v) => onPatch({ eyebrow: v })} />
          <Field label="Quote" value={slide.body ?? ''} placeholder="You always said..." onChange={(v) => onPatch({ body: v })} type="textarea" full />
          <Field label="Attribution" value={slide.attrib ?? ''} placeholder="— Marcus, probably" onChange={(v) => onPatch({ attrib: v })} />
        </div>
      );
    case 'podium':
      return <PodiumFields slide={slide} onPatch={onPatch} />;
    case 'letter':
      return (
        <div className="slide-fields">
          <Field label="Greeting" value={slide.greeting ?? ''} placeholder="LS," onChange={(v) => onPatch({ greeting: v })} />
          <Field label="Letter body" value={slide.body ?? ''} placeholder="Working with you has..." onChange={(v) => onPatch({ body: v })} type="textarea" full />
          <Field label="Sign off" value={slide.signoff ?? ''} placeholder="— Michael" onChange={(v) => onPatch({ signoff: v })} />
        </div>
      );
    case 'mosaic':
      return <MosaicFields slide={slide} onPatch={onPatch} />;
    case 'signoff':
      return (
        <div className="slide-fields">
          <Field label="Eyebrow" value={slide.eyebrow ?? ''} placeholder="Until next time" onChange={(v) => onPatch({ eyebrow: v })} />
          <Field label="Title" value={slide.title ?? ''} placeholder="Thank you" onChange={(v) => onPatch({ title: v })} />
          <Field label="Subtitle" value={slide.sub ?? ''} placeholder="Stay in touch." onChange={(v) => onPatch({ sub: v })} type="textarea" full />
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
      <Field label="Eyebrow" value={slide.eyebrow ?? ''} placeholder="A moment" onChange={(v) => onPatch({ eyebrow: v })} />
      <Field label="Caption (under photo)" value={slide.caption ?? ''} placeholder="That time we..." onChange={(v) => onPatch({ caption: v })} />
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

  const updateItem = (idx: number, field: 'name' | 'count', val: string) => {
    const nextItems = [...items];
    while (nextItems.length <= idx) nextItems.push({ name: '', count: '' });
    nextItems[idx] = { ...nextItems[idx], [field]: val };
    onPatch({ items: nextItems });
  };

  return (
    <div className="slide-fields">
      <Field label="Eyebrow" value={slide.eyebrow ?? ''} placeholder="The top 3..." onChange={(v) => onPatch({ eyebrow: v })} />
      <Field label="Title" value={slide.title ?? ''} placeholder="Things I'll miss most" onChange={(v) => onPatch({ title: v })} />
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: 'contents' }}>
          <div>
            <label className="field-label">#{i + 1} Name</label>
            <input
              type="text"
              className="field-input"
              value={items[i]?.name ?? ''}
              placeholder={`Item ${i + 1}`}
              onChange={(e) => updateItem(i, 'name', e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">#{i + 1} Subtitle</label>
            <input
              type="text"
              className="field-input"
              value={items[i]?.count ?? ''}
              placeholder="e.g. every Tuesday"
              onChange={(e) => updateItem(i, 'count', e.target.value)}
            />
          </div>
        </div>
      ))}
      <Field label="Caption below" value={slide.sub ?? ''} placeholder="Optional" onChange={(v) => onPatch({ sub: v })} full />
    </div>
  );
}

function MosaicFields({ slide, onPatch }: { slide: MosaicSlide; onPatch: (patch: Partial<Slide>) => void }) {
  const photos = slide.photos ?? [];

  const handleAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const next = [...photos];
    for (const f of files) {
      if (next.length >= 9) break;
      const dataUrl = await readFileAsDataURL(f);
      const compressed = await compressImage(dataUrl, 700);
      next.push(compressed);
    }
    onPatch({ photos: next });
    // Allow re-uploading same file
    e.target.value = '';
  };

  const handleRemove = (idx: number) => {
    onPatch({ photos: photos.filter((_, i) => i !== idx) });
  };

  return (
    <div className="slide-fields">
      <div className="full">
        {photos.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
              gap: '6px',
              marginBottom: '8px',
            }}
          >
            {photos.map((p, pi) => (
              <div key={pi} style={{ position: 'relative', aspectRatio: '1' }}>
                <img src={p} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
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
        <label className="photo-upload">
          <input type="file" accept="image/*" multiple onChange={handleAdd} style={{ display: 'none' }} />
          📷 Add photos (up to 9)
        </label>
      </div>
      <Field label="Eyebrow" value={slide.eyebrow ?? ''} placeholder="Memories" onChange={(v) => onPatch({ eyebrow: v })} />
      <Field label="Title" value={slide.title ?? ''} placeholder="Bits and pieces" onChange={(v) => onPatch({ title: v })} />
      <Field label="Caption" value={slide.sub ?? ''} placeholder="Optional" onChange={(v) => onPatch({ sub: v })} />
    </div>
  );
}
