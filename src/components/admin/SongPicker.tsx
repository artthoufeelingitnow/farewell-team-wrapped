import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Slide, ItunesResult } from '../../types';
import { useItunesSearch } from '../../hooks/useItunesSearch';
import {
  previewSong,
  stopPreviewAudio,
  getPreviewKey,
  seekPreviewAudio,
} from '../../hooks/audioEngine';
import { showToast } from '../../store/toastStore';
import { DEFAULT_SLIDE_DURATION } from '../../utils/constants';

const PREVIEW_TOTAL_SEC = 30;
const DURATION_OPTIONS_SEC = [5, 7, 10, 12, 15, 20, 25, 30];
const WAVEFORM_BAR_COUNT = 56;

// Deterministic pseudo-random heights so the decorative waveform stays stable
// across renders. Same shape regardless of song.
function generateBarHeights(count: number): number[] {
  const arr: number[] = [];
  let seed = 12345;
  for (let i = 0; i < count; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const r = seed / 233280;
    arr.push(0.3 + r * 0.7);
  }
  return arr;
}

interface StartWindowSliderProps {
  start: number; // seconds
  durationMs: number;
  songUrl: string;
  previewKey: string;
  onCommit: (sec: number) => void;
  onPreviewStateChange: () => void;
}

function StartWindowSlider({
  start,
  durationMs,
  songUrl,
  previewKey,
  onCommit,
  onPreviewStateChange,
}: StartWindowSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [localStart, setLocalStart] = useState(start);

  const durSec = durationMs / 1000;
  const maxStart = Math.max(0, PREVIEW_TOTAL_SEC - durSec);

  // Resync from prop whenever the committed value changes externally (e.g. duration
  // change forced a clamp, or a different slide selected). Skip while user is dragging.
  useEffect(() => {
    if (!dragging) setLocalStart(Math.min(start, maxStart));
  }, [start, dragging, maxStart]);

  const startPct = (localStart / PREVIEW_TOTAL_SEC) * 100;
  const windowPct = (durSec / PREVIEW_TOTAL_SEC) * 100;

  const heights = useMemo(() => generateBarHeights(WAVEFORM_BAR_COUNT), []);

  const secFromClientX = (clientX: number): number => {
    const track = trackRef.current;
    if (!track) return localStart;
    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return localStart;
    const ratio = (clientX - rect.left) / rect.width;
    // Center the window on the cursor, IG-style.
    const sec = ratio * PREVIEW_TOTAL_SEC - durSec / 2;
    return Math.max(0, Math.min(maxStart, sec));
  };

  const ensurePreviewAt = (sec: number) => {
    if (getPreviewKey() === previewKey) {
      seekPreviewAudio(sec);
    } else {
      previewSong(songUrl, sec, previewKey, onPreviewStateChange);
      onPreviewStateChange();
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (maxStart === 0) return; // window fills the bar — nothing to drag
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    const sec = secFromClientX(e.clientX);
    setLocalStart(sec);
    ensurePreviewAt(sec);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const sec = secFromClientX(e.clientX);
    setLocalStart(sec);
    if (getPreviewKey() === previewKey) seekPreviewAudio(sec);
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    onCommit(Math.round(localStart * 10) / 10);
  };

  return (
    <div className="song-start-slider">
      <div
        ref={trackRef}
        className={`song-start-track${maxStart === 0 ? ' is-locked' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <div className="song-start-bars">
          {heights.map((h, i) => {
            const barCenterPct = ((i + 0.5) / WAVEFORM_BAR_COUNT) * 100;
            const inWindow =
              barCenterPct >= startPct && barCenterPct <= startPct + windowPct;
            return (
              <span
                key={i}
                className={`song-start-bar${inWindow ? ' in-window' : ''}`}
                style={{ height: `${h * 100}%` }}
              />
            );
          })}
        </div>
        <div
          className="song-start-window"
          style={{ left: `${startPct}%`, width: `${windowPct}%` }}
        />
      </div>
      <div className="song-start-meta">
        <span>{localStart.toFixed(1)}s</span>
        <span>{(localStart + durSec).toFixed(1)}s</span>
      </div>
    </div>
  );
}

interface Props {
  slide: Slide;
  slideIndex: number;
  onPatch: (patch: Partial<Slide>) => void;
}

export function SongPicker({ slide, slideIndex, onPatch }: Props) {
  // Picker visibility kept locally; original held it in slide.showSongPicker but it's transient UI state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [, refresh] = useReducer((x: number) => x + 1, 0); // re-render after imperative preview state changes

  const { results, searching } = useItunesSearch(query);

  if (!pickerOpen && !slide.songUrl) {
    return (
      <button className="song-add-btn" onClick={() => setPickerOpen(true)}>
        🎵 Add a song
      </button>
    );
  }

  const duration = slide.songDuration || DEFAULT_SLIDE_DURATION;
  const start = slide.songStart || 0;
  const currentKey = `current-${slideIndex}`;
  const isPreviewingCurrent = getPreviewKey() === currentKey;

  const removeSong = () => {
    stopPreviewAudio();
    onPatch({
      songUrl: undefined,
      songName: undefined,
      songArtist: undefined,
      songArt: undefined,
      songStart: undefined,
      songDuration: undefined,
    });
    setPickerOpen(false);
  };

  const pickResult = (r: ItunesResult) => {
    stopPreviewAudio();
    onPatch({
      songUrl: r.previewUrl,
      songName: r.trackName,
      songArtist: r.artistName,
      songArt: r.artworkUrl100 || r.artworkUrl60,
      songStart: 0,
      songDuration: slide.songDuration || DEFAULT_SLIDE_DURATION,
    });
    showToast(`Added: ${r.trackName}`);
    setPickerOpen(false);
  };

  const previewCurrent = () => {
    if (!slide.songUrl) return;
    previewSong(slide.songUrl, slide.songStart || 0, currentKey, refresh);
    refresh();
  };

  const previewResult = (r: ItunesResult, ri: number) => {
    if (!r.previewUrl) return;
    const key = `result-${slideIndex}-${ri}`;
    previewSong(r.previewUrl, 0, key, refresh);
    refresh();
  };

  return (
    <div className="song-picker">
      {slide.songUrl && (
        <>
          <div className="song-current">
            {slide.songArt && <img src={slide.songArt} alt="" />}
            <div className="info">
              <div className="t">{slide.songName || ''}</div>
              <div className="a">{slide.songArtist || ''}</div>
            </div>
            <button className="song-result-preview" onClick={previewCurrent} title="Preview">
              {isPreviewingCurrent ? '⏸' : '▶'}
            </button>
            <button className="icon-btn danger" onClick={removeSong} title="Remove">
              ×
            </button>
          </div>
          <div className="song-controls">
            <div className="song-control-row row-inline">
              <label>Slide duration</label>
              <select
                className="song-duration-select"
                value={Math.round(duration / 1000)}
                onChange={(e) => {
                  const newSec = parseInt(e.target.value, 10);
                  const newMs = newSec * 1000;
                  const maxStart = Math.max(0, PREVIEW_TOTAL_SEC - newSec);
                  if (start > maxStart) {
                    onPatch({ songDuration: newMs, songStart: maxStart });
                  } else {
                    onPatch({ songDuration: newMs });
                  }
                }}
              >
                {DURATION_OPTIONS_SEC.map((s) => (
                  <option key={s} value={s}>
                    {s}s
                  </option>
                ))}
              </select>
            </div>
            <div className="song-control-row">
              <label>Start position</label>
              <StartWindowSlider
                start={start}
                durationMs={duration}
                songUrl={slide.songUrl}
                previewKey={currentKey}
                onCommit={(sec) => onPatch({ songStart: sec })}
                onPreviewStateChange={refresh}
              />
            </div>
          </div>
        </>
      )}

      {pickerOpen ? (
        <>
          <div className="song-search-row" style={{ marginTop: slide.songUrl ? '10px' : '0' }}>
            <input
              type="text"
              placeholder="Search songs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <button className="btn btn-sm btn-ghost" onClick={() => setPickerOpen(false)}>
              Done
            </button>
          </div>
          <div className="song-results">
            {searching && <div className="song-loading">Searching iTunes…</div>}
            {results.map((r, ri) => {
              const key = `result-${slideIndex}-${ri}`;
              const isPreviewingThis = getPreviewKey() === key;
              return (
                <div key={ri} className="song-result" onClick={() => pickResult(r)}>
                  <img src={r.artworkUrl60 || ''} alt="" />
                  <div className="song-result-info">
                    <div className="song-result-title">{r.trackName}</div>
                    <div className="song-result-artist">{r.artistName}</div>
                  </div>
                  <button
                    className="song-result-preview"
                    onClick={(e) => {
                      e.stopPropagation();
                      previewResult(r, ri);
                    }}
                    title="Preview"
                  >
                    {isPreviewingThis ? '⏸' : '▶'}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="itunes-credit">Previews provided courtesy of iTunes</div>
        </>
      ) : (
        slide.songUrl && (
          <button
            className="song-add-btn"
            style={{ marginTop: '10px' }}
            onClick={() => setPickerOpen(true)}
          >
            🔁 Change song
          </button>
        )
      )}
    </div>
  );
}
