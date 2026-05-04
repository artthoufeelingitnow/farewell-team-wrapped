import { useEffect, useRef, useState } from 'react';
import type { Slide, Colleague } from '../../types';
import { SlideRenderer } from '../slides/SlideRenderer';

interface Props {
  slide: Slide;
  colleague: Colleague;
}

const NATURAL_W = 1200;
const NATURAL_H = 675;

/**
 * Live, non-interactive miniature of a slide. Renders SlideRenderer at its
 * natural 1200×675 size into a stage, then scales the stage down to fit the
 * editor pane via a ResizeObserver-computed transform. The slide's clamp()/vw
 * font sizes still resolve correctly — they just paint smaller.
 */
export function SlidePreview({ slide, colleague }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? wrapper.clientWidth;
      if (w > 0) setScale(w / NATURAL_W);
    });
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="slide-preview" ref={wrapperRef}>
      <div
        className="slide-preview-stage"
        style={{
          width: NATURAL_W,
          height: NATURAL_H,
          transform: `scale(${scale})`,
        }}
      >
        <SlideRenderer
          slide={slide}
          colleague={colleague}
          onReplay={() => {}}
          onClose={() => {}}
        />
      </div>
    </div>
  );
}
