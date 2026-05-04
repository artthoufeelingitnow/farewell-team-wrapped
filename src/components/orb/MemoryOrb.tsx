import { useRef, useState } from 'react';
import type { Colleague } from '../../types';
import { OrbScene } from './OrbScene';
import { useOrbSeed } from './useOrbSeed';
import { usePalette } from './usePalette';
import { saveOrbImage } from './saveOrbImage';

interface Props {
  colleague: Colleague;
}

/**
 * The finale memory orb. Renders a deterministic 3D icosahedron parameterized
 * by the colleague's name (seed) + their photos (color palette), with a title
 * + caption overlay and a "Save my wrapped" button that exports a PNG keepsake.
 */
export function MemoryOrb({ colleague }: Props) {
  const seed = useOrbSeed(colleague.name);
  const { hex: palette, loading } = usePalette(colleague);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  const handleSave = () => {
    if (!canvasRef.current) return;
    saveOrbImage(canvasRef.current, colleague.name || 'guest');
    setSavedAt(Date.now());
    // Reset the "Saved!" label after 2s.
    window.setTimeout(() => setSavedAt(0), 2000);
  };

  const justSaved = Date.now() - savedAt < 2000;

  return (
    <div className="memory-orb">
      <div className="memory-orb-stage">
        {!loading && (
          <OrbScene
            palette={palette}
            seed={seed}
            onCanvasCreated={(c) => {
              canvasRef.current = c;
            }}
          />
        )}
      </div>
      <div className="memory-orb-text">
        <h2 className="memory-orb-title">{colleague.name || 'your'}'s Wrapped 2026</h2>
        <p className="memory-orb-caption">made with care</p>
        <button
          type="button"
          className="memory-orb-save"
          onClick={handleSave}
          disabled={loading || !canvasRef.current}
        >
          {justSaved ? 'Saved!' : 'Save my wrapped'}
        </button>
      </div>
    </div>
  );
}
