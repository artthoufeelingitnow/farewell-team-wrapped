import { useRef, useState } from 'react';
import type { Colleague, SpiritAnimalSlide } from '../../types';
import { saveCardAsPng } from '../../utils/wrapped';
import { showToast } from '../../store/toastStore';
import { SpiritAnimalCard } from './SpiritAnimalCard';

interface Props {
  slide: SpiritAnimalSlide;
  colleague: Colleague;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_LABEL: Record<SaveState, string> = {
  idle: '⬇ Save to gallery',
  saving: 'Saving…',
  saved: 'Saved!',
  error: "Couldn't save — try again?",
};

export function SpiritAnimalSlideView({ slide, colleague }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const handleSave = async () => {
    if (!cardRef.current || saveState === 'saving') return;
    setSaveState('saving');
    try {
      await saveCardAsPng(cardRef.current, colleague.name || 'wrapped', 'spirit-animal');
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (err) {
      console.error('Failed to save spirit animal:', err);
      setSaveState('error');
      showToast("Couldn't save — try again?");
      setTimeout(() => setSaveState('idle'), 2200);
    }
  };

  return (
    <div className="keepsake">
      <SpiritAnimalCard slide={slide} cardRef={cardRef} />

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
