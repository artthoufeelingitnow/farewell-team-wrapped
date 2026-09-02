import type { Colleague } from '../../types';

interface Props {
  colleagues: Colleague[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onAddWallOnly: () => void;
}

/** The ⚠️ means "no password, so no deck ships". It's meaningless for wall-only
 *  people — they're never meant to have one — so they get 🖼 instead and the
 *  warning stays a real warning. */
function statusFor(c: Colleague): string {
  if (c.galleryOnly) return '🖼';
  return c.password ? '🔒' : '⚠️';
}

export function ColleagueList({ colleagues, selectedId, onSelect, onAdd, onAddWallOnly }: Props) {
  return (
    <div className="colleague-list">
      <h3>Colleagues ({colleagues.length})</h3>
      {colleagues.map((c) => (
        <div
          key={c.id}
          className={`col-item ${c.id === selectedId ? 'active' : ''}`}
          onClick={() => onSelect(c.id)}
        >
          <span>
            {c.name || '(unnamed)'}
            {c.inGallery && (
              <span className="col-item-wall" title="On the polaroid wall">
                {' '}
                📌
              </span>
            )}
          </span>
          <span className="meta">
            {c.galleryOnly ? 'wall only' : `${c.slides?.length || 0} slides`} {statusFor(c)}
          </span>
        </div>
      ))}
      <button className="add-colleague-btn" onClick={onAdd}>
        + Add colleague
      </button>
      <button className="add-colleague-btn add-colleague-btn-alt" onClick={onAddWallOnly}>
        + Add wall-only person
      </button>
    </div>
  );
}
