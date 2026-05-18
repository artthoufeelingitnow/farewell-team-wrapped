import { useRef, useState } from 'react';
import type { Colleague, SoundtrackSlide } from '../../types';
import { getFeaturedSoundtrack, saveCardAsPng } from '../../utils/wrapped';
import { showToast } from '../../store/toastStore';

interface Props {
  slide: SoundtrackSlide;
  colleague: Colleague;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_LABEL: Record<SaveState, string> = {
  idle: '⬇ Save to gallery',
  saving: 'Saving…',
  saved: 'Saved!',
  error: "Couldn't save — try again?",
};

export function SoundtrackSlideView({ slide, colleague }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const tracks = getFeaturedSoundtrack(colleague, slide.featuredTrackKeys);
  const eyebrow = slide.eyebrow || 'your soundtrack';
  const title = slide.title?.trim() ? slide.title : '';
  const titleClass = `keepsake-title${slide.titleFont === 'spotify' ? ' font-spotify' : ''}`;

  const handleSave = async () => {
    if (!cardRef.current || saveState === 'saving') return;
    setSaveState('saving');
    try {
      await saveCardAsPng(cardRef.current, colleague.name || 'wrapped', 'soundtrack');
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (err) {
      console.error('Failed to save soundtrack:', err);
      setSaveState('error');
      showToast("Couldn't save — try again?");
      setTimeout(() => setSaveState('idle'), 2200);
    }
  };

  return (
    <div className="keepsake">
      <div className="keepsake-card keepsake-card-soundtrack" ref={cardRef}>
        <div className="keepsake-eyebrow">{eyebrow}</div>
        {title && <div className={titleClass}>{title}</div>}

        {tracks.length > 0 ? (
          <ol className="keepsake-tracks">
            {tracks.map((t, i) => (
              <li className="keepsake-track" key={t.key}>
                <span className="keepsake-track-num">{String(i + 1).padStart(2, '0')}</span>
                {t.art ? (
                  <img className="keepsake-track-art" src={t.art} alt="" />
                ) : (
                  <div className="keepsake-track-art keepsake-track-art-empty" />
                )}
                <div className="keepsake-track-meta">
                  <div className="keepsake-track-name">{t.name}</div>
                  {t.artist && <div className="keepsake-track-artist">{t.artist}</div>}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="keepsake-tracks-empty">(this one was wordless)</div>
        )}

        {slide.tagline && (
          <div className="keepsake-tagline">{slide.tagline}</div>
        )}
      </div>

      <div className="keepsake-actions" data-html-to-image-ignore>
        <button
          className="keepsake-save"
          onClick={() => void handleSave()}
          disabled={saveState === 'saving'}
        >
          {SAVE_LABEL[saveState]}
        </button>
      </div>
    </div>
  );
}
