import { SLIDE_TYPES } from '../../utils/constants';
import type { SlideType } from '../../types';

interface Props {
  onPick: (type: SlideType) => void;
}

export function AddSlideMenu({ onPick }: Props) {
  return (
    <div className="add-slide-menu">
      <h4>Pick a slide type</h4>
      <div className="slide-type-grid">
        {(Object.entries(SLIDE_TYPES) as [SlideType, typeof SLIDE_TYPES[SlideType]][]).map(
          ([key, t]) => (
            <button key={key} className="slide-type-option" onClick={() => onPick(key)}>
              <span className="emoji">{t.emoji}</span>
              {t.label}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
