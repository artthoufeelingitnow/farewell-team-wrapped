import type { PodiumSlide } from '../../types';

export function PodiumSlideView({ slide }: { slide: PodiumSlide }) {
  const items = (slide.items || []).slice(0, 3);
  // Visual order: 2nd, 1st, 3rd
  const arr = [items[1], items[0], items[2]].filter(Boolean);

  return (
    <>
      {slide.eyebrow && <div className="slide-eyebrow">{slide.eyebrow}</div>}
      <h2>{slide.title || ''}</h2>
      <div className="podium">
        {arr.map((item) => {
          const idx = items.indexOf(item) + 1;
          const cls = idx === 1 ? 's1' : idx === 2 ? 's2' : 's3';
          return (
            <div key={idx} className={`podium-step ${cls}`}>
              <div className="rank">#{idx}</div>
              <div className="name">{item.name || ''}</div>
              {item.count && <div className="count">{item.count}</div>}
            </div>
          );
        })}
      </div>
      {slide.sub && <p>{slide.sub}</p>}
    </>
  );
}
