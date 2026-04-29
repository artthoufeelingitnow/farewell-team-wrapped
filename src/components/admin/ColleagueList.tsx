import type { Colleague } from '../../types';

interface Props {
  colleagues: Colleague[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function ColleagueList({ colleagues, selectedId, onSelect, onAdd }: Props) {
  return (
    <div className="colleague-list">
      <h3>Colleagues ({colleagues.length})</h3>
      {colleagues.map((c) => (
        <div
          key={c.id}
          className={`col-item ${c.id === selectedId ? 'active' : ''}`}
          onClick={() => onSelect(c.id)}
        >
          <span>{c.name || '(unnamed)'}</span>
          <span className="meta">
            {c.slides?.length || 0} slides {c.passwordHash ? '🔒' : ''}
          </span>
        </div>
      ))}
      <button className="add-colleague-btn" onClick={onAdd}>
        + Add colleague
      </button>
    </div>
  );
}
