import { useRef, useState } from 'react';
import type { Colleague, WrappedFinaleSlide } from '../../types';
import { getFeaturedSoundtrack, saveWrappedAsPng } from '../../utils/wrapped';
import { showToast } from '../../store/toastStore';

interface Props {
  slide: WrappedFinaleSlide;
  colleague: Colleague;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_LABEL: Record<SaveState, string> = {
  idle: 'Save my wrapped',
  saving: 'Saving…',
  saved: 'Saved!',
  error: "Couldn't save — try again?",
};

export function WrappedFinaleSlideView({ slide, colleague }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const tracks = getFeaturedSoundtrack(colleague, slide.featuredTrackKeys);
  const hasAnimal = !!(colleague.spiritAnimalMedia && colleague.spiritAnimalName);
  const animalPos = colleague.spiritAnimalPosition ?? { x: 50, y: 50 };
  const animalObjectPosition = `${animalPos.x}% ${animalPos.y}%`;

  const handleSave = async () => {
    if (!cardRef.current || saveState === 'saving') return;
    setSaveState('saving');
    try {
      await saveWrappedAsPng(cardRef.current, colleague.name || 'wrapped');
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (err) {
      console.error('Failed to save wrapped:', err);
      setSaveState('error');
      showToast("Couldn't save — try again?");
      setTimeout(() => setSaveState('idle'), 2200);
    }
  };

  return (
    <div className="wrapped-finale">
      <div className="wrapped-finale-card" ref={cardRef}>
        <div className="wrapped-finale-section">
          <div className="wrapped-finale-animal">
            {hasAnimal && colleague.spiritAnimalMedia ? (
              colleague.spiritAnimalMedia.kind === 'video' ? (
                <video
                  className="wrapped-finale-animal-img"
                  src={colleague.spiritAnimalMedia.src}
                  autoPlay
                  muted
                  loop
                  playsInline
                  /* crossOrigin needed so html-to-image can read the frame; the
                     hosted videos are same-origin in production but this keeps
                     it from tainting the export canvas if anything moves. */
                  crossOrigin="anonymous"
                  style={{ objectPosition: animalObjectPosition }}
                />
              ) : (
                <img
                  className="wrapped-finale-animal-img"
                  src={colleague.spiritAnimalMedia.src}
                  alt={colleague.spiritAnimalName ?? 'Spirit animal'}
                  style={{ objectPosition: animalObjectPosition }}
                />
              )
            ) : (
              <div className="wrapped-finale-animal-placeholder" aria-hidden="true">
                <span>★</span>
              </div>
            )}
          </div>
          <div className="wrapped-finale-eyebrow">Your spirit animal</div>
          <div className="wrapped-finale-name">{colleague.spiritAnimalName || 'Yet to be discovered'}</div>
          {colleague.spiritAnimalTagline && (
            <div className="wrapped-finale-tagline">{colleague.spiritAnimalTagline}</div>
          )}
        </div>

        {tracks.length > 0 && (
          <div className="wrapped-finale-section">
            <div className="wrapped-finale-divider" />
            <div className="wrapped-finale-eyebrow">Your soundtrack</div>
            <ol className="wrapped-finale-tracks">
              {tracks.map((t, i) => (
                <li className="wrapped-finale-track" key={t.key}>
                  <span className="wrapped-finale-track-num">{String(i + 1).padStart(2, '0')}</span>
                  {t.art ? (
                    <img className="wrapped-finale-track-art" src={t.art} alt="" />
                  ) : (
                    <div className="wrapped-finale-track-art wrapped-finale-track-art-empty" />
                  )}
                  <div className="wrapped-finale-track-meta">
                    <div className="wrapped-finale-track-name">{t.name}</div>
                    {t.artist && <div className="wrapped-finale-track-artist">{t.artist}</div>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="wrapped-finale-footer">
          made with care, for {colleague.name || 'you'}
        </div>
      </div>

      <div className="wrapped-finale-actions" data-html-to-image-ignore>
        <button
          className="wrapped-finale-save"
          onClick={() => void handleSave()}
          disabled={saveState === 'saving'}
        >
          {SAVE_LABEL[saveState]}
        </button>
      </div>
    </div>
  );
}
