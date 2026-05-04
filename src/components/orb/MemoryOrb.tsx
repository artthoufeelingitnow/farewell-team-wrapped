import { useRef, useState } from 'react';
import type { Colleague, OrbConfig } from '../../types';
import { showToast } from '../../store/toastStore';
import { OrbScene } from './OrbScene';
import { useOrbSeed } from './useOrbSeed';
import { usePalette } from './usePalette';
import { saveOrbImage } from './saveOrbImage';
import { saveOrbVideo } from './saveOrbVideo';
import { playSaveChime } from './playSaveChime';

interface Props {
  colleague: Colleague;
  config?: OrbConfig;
}

const VIDEO_DURATION_MS = 6000;

/**
 * The finale memory orb. Renders a deterministic 3D shape parameterized by the
 * colleague's name (seed) + their photos (color palette), with a title overlay
 * and two save options: PNG keepsake and short webm video.
 */
export function MemoryOrb({ colleague, config }: Props) {
  const seed = useOrbSeed(colleague.name);
  const { hex: palette, loading } = usePalette(colleague);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [savedAt, setSavedAt] = useState(0);
  const [recordingMsLeft, setRecordingMsLeft] = useState<number | null>(null);

  const isRecording = recordingMsLeft !== null;

  const handleSavePng = () => {
    if (!canvasRef.current) return;
    saveOrbImage(canvasRef.current, colleague.name || 'guest');
    playSaveChime();
    setSavedAt(Date.now());
    window.setTimeout(() => setSavedAt(0), 2000);
  };

  const handleSaveVideo = async () => {
    if (!canvasRef.current || isRecording) return;
    setRecordingMsLeft(VIDEO_DURATION_MS);
    try {
      await saveOrbVideo(canvasRef.current, colleague.name || 'guest', {
        durationMs: VIDEO_DURATION_MS,
        onProgress: (remaining) => setRecordingMsLeft(remaining),
      });
      playSaveChime();
      setSavedAt(Date.now());
      window.setTimeout(() => setSavedAt(0), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not record video.';
      showToast(msg);
    } finally {
      setRecordingMsLeft(null);
    }
  };

  const justSaved = Date.now() - savedAt < 2000;
  const recordingLabel = isRecording
    ? `Recording… ${Math.ceil((recordingMsLeft ?? 0) / 1000)}s`
    : 'Save as video';

  return (
    <div className="memory-orb">
      <div className="memory-orb-stage">
        {!loading && (
          <OrbScene
            palette={palette}
            seed={seed}
            config={config}
            onCanvasCreated={(c) => {
              canvasRef.current = c;
            }}
          />
        )}
      </div>
      <div className="memory-orb-text">
        <h2 className="memory-orb-title">{colleague.name || 'your'}'s Wrapped</h2>
        <div className="memory-orb-actions">
          <button
            type="button"
            className="memory-orb-save"
            onClick={handleSavePng}
            disabled={loading || !canvasRef.current || isRecording}
          >
            {justSaved && !isRecording ? 'Saved!' : 'Save my wrapped'}
          </button>
          <button
            type="button"
            className="memory-orb-save memory-orb-save-secondary"
            onClick={handleSaveVideo}
            disabled={loading || !canvasRef.current || isRecording}
          >
            {recordingLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
