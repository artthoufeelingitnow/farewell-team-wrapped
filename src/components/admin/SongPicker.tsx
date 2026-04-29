import { useEffect, useReducer, useState } from 'react';
import type { Slide, ItunesResult } from '../../types';
import { useItunesSearch } from '../../hooks/useItunesSearch';
import { previewSong, stopPreviewAudio, getPreviewKey } from '../../hooks/audioEngine';
import { showToast } from '../../store/toastStore';
import { DEFAULT_SLIDE_DURATION } from '../../utils/constants';

/**
 * Number input that lets the user clear/edit freely, only clamping + committing on blur.
 * Reverts to the last committed value if the user blurs with an empty/invalid input.
 */
function ClampedNumberInput({
  value,
  min,
  max,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (val: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  // Resync if the committed value changes from outside (e.g., picking a new song).
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.max(min, Math.min(max, parsed));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={1}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
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
            <div>
              <label>Start at (sec, 0–25)</label>
              <ClampedNumberInput
                value={start}
                min={0}
                max={25}
                onCommit={(v) => onPatch({ songStart: v })}
              />
            </div>
            <div>
              <label>Slide duration (sec)</label>
              <ClampedNumberInput
                value={Math.round(duration / 1000)}
                min={3}
                max={30}
                onCommit={(v) => onPatch({ songDuration: v * 1000 })}
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
