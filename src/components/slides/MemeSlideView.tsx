import { useEffect, useRef, useState } from 'react';
import type { Colleague, MemeSlide } from '../../types';
import { usePlayerStore } from '../../store/playerStore';
import { saveVideoToGallery } from '../../utils/wrapped';
import { showToast } from '../../store/toastStore';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_LABEL: Record<SaveState, string> = {
  idle: '⬇ Save to gallery',
  saving: 'Saving…',
  saved: 'Saved!',
  error: "Couldn't save",
};

/** Meme-video keepsake slide. Same card shell as Soundtrack (no title), with
 *  a single autoplaying TikTok/IG-style video as the focal content.
 *
 *  Audio: the video plays its own audio (the meme IS the punchline). The
 *  slide has no `songUrl` so the audio engine fades the deck's bg song to 0
 *  for the duration via its existing "no songUrl → fade current out" path.
 *
 *  Duration: the slide view reports the video's intrinsic length up to
 *  `playerStore.memeVideoDurationMs`; the Player's auto-advance timer reads
 *  that to make the progress bar track the video. Video `loop`s as a grace
 *  buffer so a 3-second meme isn't gone before the user notices it. */
export function MemeSlideView({ slide, colleague }: { slide: MemeSlide; colleague: Colleague }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioEnabled = usePlayerStore((s) => s.audioEnabled);
  const paused = usePlayerStore((s) => s.paused);
  const pausedByVisibility = usePlayerStore((s) => s.pausedByVisibility);
  const setMemeVideoDurationMs = usePlayerStore((s) => s.setMemeVideoDurationMs);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Wipe any prior meme's duration on mount/src-change; report this video's
  // length once metadata loads. Reset on unmount so a subsequent non-meme
  // slide doesn't accidentally inherit it.
  useEffect(() => {
    setMemeVideoDurationMs(null);
    return () => setMemeVideoDurationMs(null);
  }, [slide.videoUrl, setMemeVideoDurationMs]);

  // Hold-to-pause + tab-hidden should also halt the video, mirroring the
  // audio engine's pause behavior for songs.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused || pausedByVisibility) {
      try { v.pause(); } catch { /* ignore */ }
    } else {
      void v.play().catch(() => { /* autoplay may fail before user gesture; that's fine */ });
    }
  }, [paused, pausedByVisibility]);

  const eyebrow = slide.eyebrow || 'before we continue, here\'s a meme...';

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
    setMemeVideoDurationMs(v.duration * 1000);
  };

  const handleSave = async () => {
    if (!slide.videoUrl || saveState === 'saving') return;
    setSaveState('saving');
    try {
      await saveVideoToGallery(slide.videoUrl, colleague.name || 'meme', 'meme');
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (err) {
      console.error('Failed to save meme video:', err);
      setSaveState('error');
      showToast("Couldn't save — try again?");
      setTimeout(() => setSaveState('idle'), 2200);
    }
  };

  const handleFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    // iOS Safari only supports fullscreen on <video> via the prefixed call;
    // requestFullscreen() rejects there. Try iOS path first, fall back to the
    // standard Fullscreen API for desktop / Android.
    const iosFs = (v as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen;
    if (typeof iosFs === 'function') {
      iosFs.call(v);
      return;
    }
    if (typeof v.requestFullscreen === 'function') {
      v.requestFullscreen().catch(() => {
        /* user denied or unsupported — silent, no fallback needed */
      });
    }
  };

  return (
    <div className="keepsake">
      <div className="keepsake-card keepsake-card-meme">
        <div className="keepsake-eyebrow">{eyebrow}</div>

        <div className="meme-video-wrap">
          {slide.videoUrl ? (
            <video
              ref={videoRef}
              className="meme-video"
              src={slide.videoUrl}
              autoPlay
              loop
              playsInline
              muted={!audioEnabled}
              onLoadedMetadata={handleLoadedMetadata}
              onClick={(e) => {
                e.stopPropagation();
                handleFullscreen();
              }}
              draggable={false}
            />
          ) : (
            <div className="meme-video-empty">No video yet</div>
          )}
        </div>

        {slide.tagline && (
          <div className="keepsake-tagline">{slide.tagline}</div>
        )}
      </div>

      {slide.videoUrl && (
        <div className="keepsake-actions">
          <button
            className="keepsake-save"
            disabled={saveState === 'saving'}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              void handleSave();
            }}
          >
            {SAVE_LABEL[saveState]}
          </button>
        </div>
      )}
    </div>
  );
}
