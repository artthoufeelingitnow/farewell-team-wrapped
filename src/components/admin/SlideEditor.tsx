import type { Slide } from '../../types';
import { SLIDE_TYPES } from '../../utils/constants';
import { SlideFieldsEditor } from './SlideFieldsEditor';
import { SongPicker } from './SongPicker';

interface Props {
  slide: Slide;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onPatch: (patch: Partial<Slide>) => void;
  onMove: (dir: 'up' | 'down') => void;
  onDelete: () => void;
}

export function SlideEditor({ slide, index, isFirst, isLast, onPatch, onMove, onDelete }: Props) {
  const t = SLIDE_TYPES[slide.type];

  return (
    <div className="slide-item">
      <div className="slide-item-header">
        <div className="slide-item-title">
          <span className="slide-num">#{index + 1}</span>
          <span className="slide-type-badge">
            {t.emoji} {t.label}
          </span>
          {slide.songName && (
            <span
              className="slide-type-badge"
              style={{ background: 'rgba(78,205,196,0.2)', color: '#4ECDC4' }}
            >
              🎵 {slide.songName.length > 20 ? slide.songName.slice(0, 20) + '…' : slide.songName}
            </span>
          )}
        </div>
        <div className="slide-actions">
          <button
            className="icon-btn"
            onClick={() => onMove('up')}
            disabled={isFirst}
            title="Move up"
          >
            ↑
          </button>
          <button
            className="icon-btn"
            onClick={() => onMove('down')}
            disabled={isLast}
            title="Move down"
          >
            ↓
          </button>
          <button
            className="icon-btn danger"
            onClick={() => {
              if (confirm('Delete this slide?')) onDelete();
            }}
            title="Delete"
          >
            ×
          </button>
        </div>
      </div>

      <SlideFieldsEditor slide={slide} onPatch={onPatch} />
      <SongPicker slide={slide} slideIndex={index} onPatch={onPatch} />
    </div>
  );
}
